"use server";

/*
 * Server action data master (supplier, peralatan, perlengkapan, kategori, akun, karyawan, jabatan, golongan,
 * tunjangan, jadwal kerja, setting gaji) dan profil usaha.
 * Master tidak pernah dihapus, hanya dinonaktifkan, supaya transaksi lama tetap terbaca.
 * Izin per jenis ada di DEF_MASTER (lihat src/lib/skema/master.ts), nonaktifkan hanya Owner.
 */
import { db, type Tx } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { AWALAN, kodeBerikutnya } from "@/lib/server/nomor";
import { catatLog } from "@/lib/server/log";
import { DEF_MASTER, skemaIsiMaster, skemaProfil, skemaSimpanMaster, skemaStatusMaster, type JenisMaster } from "@/lib/skema/master";
import type { SaldoNormal, StatusPtkp, TipeAkun } from "@/generated/prisma/enums";

type Nilai = Record<string, string | number | string[]>;

const kosongJadiNull = (v: unknown) => (String(v ?? "").trim() === "" ? null : String(v).trim());

/** Memastikan master rujukan ada dan aktif (kecuali memang sudah dipakai data ini sebelumnya). */
async function pastikanRujukan(daftar: { ada: boolean; aktif: boolean; label: string; lama?: boolean; isian: string }[]) {
  for (const r of daftar) {
    if (!r.ada) throw new GalatAksi(`${r.label} tidak ditemukan.`, { [r.isian]: `${r.label} tidak ditemukan.` });
    if (!r.aktif && !r.lama) throw new GalatAksi(`${r.label} sudah dinonaktifkan.`, { [r.isian]: `${r.label} nonaktif.` });
  }
}

async function simpan(tx: Tx, jenis: JenisMaster, kodeLama: string | null, v: Nilai): Promise<string> {
  const baru = kodeLama === null;
  const s = (k: string) => String(v[k] ?? "");
  const n = (k: string) => Number(v[k] ?? 0);
  const ada = async (model: "kategoriAset" | "akun" | "jabatan" | "golongan" | "karyawan", kode: string, label: string, isian: string, lama?: boolean) => {
    const x = await (tx[model] as unknown as { findUnique: (a: unknown) => Promise<{ aktif: boolean } | null> }).findUnique({ where: { kode } });
    return { ada: !!x, aktif: !!x?.aktif, label, isian, lama };
  };

  switch (jenis) {
    case "supplier": {
      const npwp = kosongJadiNull(v.npwp);
      if (npwp) {
        const bentrok = await tx.supplier.findFirst({ where: { npwp, ...(kodeLama ? { kode: { not: kodeLama } } : {}) }, select: { kode: true } });
        if (bentrok) throw new GalatAksi("NPWP sudah dipakai supplier lain.", { npwp: "NPWP sudah dipakai supplier lain." });
      }
      const data = { nama: s("nama"), alamat: s("alamat"), telepon: s("telepon"), email: s("email"), npwp };
      if (baru) return (await tx.supplier.create({ data: { kode: await kodeBerikutnya(tx, AWALAN.SUPPLIER), ...data } })).kode;
      await tx.supplier.update({ where: { kode: kodeLama }, data });
      return kodeLama;
    }
    case "peralatan": {
      const lama = kodeLama ? await tx.peralatan.findUnique({ where: { kode: kodeLama }, select: { kategoriKode: true } }) : null;
      await pastikanRujukan([await ada("kategoriAset", s("kategoriKode"), "Kategori aset", "kategoriKode", lama?.kategoriKode === s("kategoriKode"))]);
      const data = { nama: s("nama"), satuan: s("satuan"), kategoriKode: s("kategoriKode") };
      if (baru) return (await tx.peralatan.create({ data: { kode: await kodeBerikutnya(tx, AWALAN.PERALATAN), ...data } })).kode;
      await tx.peralatan.update({ where: { kode: kodeLama }, data });
      return kodeLama;
    }
    case "perlengkapan": {
      const data = { nama: s("nama"), satuan: s("satuan") };
      if (baru) return (await tx.perlengkapan.create({ data: { kode: await kodeBerikutnya(tx, AWALAN.PERLENGKAPAN), ...data } })).kode;
      await tx.perlengkapan.update({ where: { kode: kodeLama }, data });
      return kodeLama;
    }
    case "kategori": {
      const lama = kodeLama ? await tx.kategoriAset.findUnique({ where: { kode: kodeLama } }) : null;
      await pastikanRujukan([
        await ada("akun", s("akunAsetKode"), "Akun aset", "akunAsetKode", lama?.akunAsetKode === s("akunAsetKode")),
        await ada("akun", s("akunAkumulasiKode"), "Akun akumulasi", "akunAkumulasiKode", lama?.akunAkumulasiKode === s("akunAkumulasiKode")),
        await ada("akun", s("akunBebanKode"), "Akun biaya", "akunBebanKode", lama?.akunBebanKode === s("akunBebanKode")),
      ]);
      const data = { nama: s("nama"), masaManfaatBulan: n("masaManfaatBulan"), persenResidu: n("persenResidu"), akunAsetKode: s("akunAsetKode"), akunAkumulasiKode: s("akunAkumulasiKode"), akunBebanKode: s("akunBebanKode") };
      if (baru) return (await tx.kategoriAset.create({ data: { kode: await kodeBerikutnya(tx, AWALAN.KATEGORI), ...data } })).kode;
      await tx.kategoriAset.update({ where: { kode: kodeLama }, data });
      return kodeLama;
    }
    case "akun": {
      const tipe = s("tipe") as TipeAkun;
      const saldoNormal = s("saldoNormal") as SaldoNormal;
      if (baru) {
        const kode = s("kode");
        if (await tx.akun.findUnique({ where: { kode }, select: { kode: true } })) throw new GalatAksi("Kode akun sudah ada.", { kode: "Kode akun sudah ada." });
        await tx.akun.create({ data: { kode, nama: s("nama"), tipe, saldoNormal } });
        return kode;
      }
      const lama = await tx.akun.findUnique({ where: { kode: kodeLama } });
      if (!lama) throw new GalatAksi("Akun tidak ditemukan.");
      if ((lama.tipe !== tipe || lama.saldoNormal !== saldoNormal) && (await tx.detailJurnal.count({ where: { akunKode: kodeLama } })) > 0) {
        throw new GalatAksi("Akun ini sudah dipakai di jurnal, jadi tipe dan saldo normalnya tidak bisa diubah. Nama masih boleh.", { tipe: "Sudah dipakai di jurnal." });
      }
      await tx.akun.update({ where: { kode: kodeLama }, data: { nama: s("nama"), tipe, saldoNormal } });
      return kodeLama;
    }
    case "karyawan": {
      const data = { nama: s("nama"), statusPtkp: s("statusPtkp") as StatusPtkp, bank: s("bank"), noRek: s("noRek") };
      if (baru) return (await tx.karyawan.create({ data: { kode: await kodeBerikutnya(tx, AWALAN.KARYAWAN), ...data } })).kode;
      await tx.karyawan.update({ where: { kode: kodeLama }, data });
      return kodeLama;
    }
    case "jabatan": {
      const lama = kodeLama ? await tx.jabatan.findUnique({ where: { kode: kodeLama }, select: { akunBebanKode: true } }) : null;
      await pastikanRujukan([await ada("akun", s("akunBebanKode"), "Akun biaya gaji", "akunBebanKode", lama?.akunBebanKode === s("akunBebanKode"))]);
      const data = { nama: s("nama"), tunjJabatan: n("tunjJabatan"), tunjKeluarga: n("tunjKeluarga"), akunBebanKode: s("akunBebanKode") };
      if (baru) return (await tx.jabatan.create({ data: { kode: await kodeBerikutnya(tx, AWALAN.JABATAN), ...data } })).kode;
      await tx.jabatan.update({ where: { kode: kodeLama }, data });
      return kodeLama;
    }
    case "golongan": {
      const data = { nama: s("nama"), jumlah: n("jumlah") };
      if (baru) return (await tx.golongan.create({ data: { kode: await kodeBerikutnya(tx, AWALAN.GOLONGAN), ...data } })).kode;
      await tx.golongan.update({ where: { kode: kodeLama }, data });
      return kodeLama;
    }
    case "tunjangan": {
      const data = { nama: s("nama"), nominal: n("nominal") };
      if (baru) return (await tx.tunjangan.create({ data: { kode: await kodeBerikutnya(tx, AWALAN.TUNJANGAN), ...data } })).kode;
      await tx.tunjangan.update({ where: { kode: kodeLama }, data });
      return kodeLama;
    }
    case "jadwal": {
      const lama = kodeLama ? await tx.jadwalKerja.findUnique({ where: { kode: kodeLama }, select: { jabatanKode: true } }) : null;
      await pastikanRujukan([await ada("jabatan", s("jabatanKode"), "Jabatan", "jabatanKode", lama?.jabatanKode === s("jabatanKode"))]);
      const bentrok = await tx.jadwalKerja.findFirst({ where: { jabatanKode: s("jabatanKode"), ...(kodeLama ? { kode: { not: kodeLama } } : {}) }, select: { kode: true } });
      if (bentrok) throw new GalatAksi("Jabatan ini sudah punya jadwal kerja.", { jabatanKode: "Jabatan ini sudah punya jadwal kerja." });
      const data = { jabatanKode: s("jabatanKode"), jamMasuk: s("jamMasuk"), jamKeluar: s("jamKeluar"), hariKerja: n("hariKerja") };
      if (baru) return (await tx.jadwalKerja.create({ data: { kode: await kodeBerikutnya(tx, AWALAN.JADWAL_KERJA), ...data } })).kode;
      await tx.jadwalKerja.update({ where: { kode: kodeLama }, data });
      return kodeLama;
    }
    case "setgaji": {
      const lama = kodeLama ? await tx.settingGaji.findUnique({ where: { kode: kodeLama }, include: { tunjangan: true } }) : null;
      const kodeTunj = [...new Set((v.tunjanganKodes as string[] | undefined) ?? [])];
      const tunjDb = kodeTunj.length ? await tx.tunjangan.findMany({ where: { kode: { in: kodeTunj } }, select: { kode: true, aktif: true } }) : [];
      if (tunjDb.length !== kodeTunj.length) throw new GalatAksi("Ada tunjangan yang tidak ditemukan.", { tunjanganKodes: "Tunjangan tidak ditemukan." });
      const dipakai = new Set(lama?.tunjangan.map((t) => t.tunjanganKode));
      if (tunjDb.some((t) => !t.aktif && !dipakai.has(t.kode))) throw new GalatAksi("Ada tunjangan yang sudah dinonaktifkan.", { tunjanganKodes: "Tunjangan nonaktif dipilih." });
      await pastikanRujukan([
        await ada("karyawan", s("karyawanKode"), "Karyawan", "karyawanKode", lama?.karyawanKode === s("karyawanKode")),
        await ada("jabatan", s("jabatanKode"), "Jabatan", "jabatanKode", lama?.jabatanKode === s("jabatanKode")),
        await ada("golongan", s("golonganKode"), "Gaji pokok", "golonganKode", lama?.golonganKode === s("golonganKode")),
      ]);
      const bentrok = await tx.settingGaji.findFirst({ where: { karyawanKode: s("karyawanKode"), ...(kodeLama ? { kode: { not: kodeLama } } : {}) }, select: { kode: true } });
      if (bentrok) throw new GalatAksi("Karyawan ini sudah punya setting gaji. Ubah data yang ada.", { karyawanKode: "Sudah punya setting gaji." });
      const data = { karyawanKode: s("karyawanKode"), jabatanKode: s("jabatanKode"), golonganKode: s("golonganKode") };
      if (baru) {
        const kode = await kodeBerikutnya(tx, AWALAN.SETTING_GAJI);
        await tx.settingGaji.create({ data: { kode, ...data, tunjangan: { create: kodeTunj.map((tunjanganKode) => ({ tunjanganKode })) } } });
        return kode;
      }
      await tx.settingTunjangan.deleteMany({ where: { settingKode: kodeLama } });
      await tx.settingGaji.update({ where: { kode: kodeLama }, data: { ...data, tunjangan: { create: kodeTunj.map((tunjanganKode) => ({ tunjanganKode })) } } });
      return kodeLama;
    }
  }
}

const MODEL: Record<JenisMaster, string> = {
  supplier: "supplier", peralatan: "peralatan", perlengkapan: "perlengkapan", kategori: "kategoriAset", akun: "akun",
  karyawan: "karyawan", jabatan: "jabatan", golongan: "golongan", tunjangan: "tunjangan", jadwal: "jadwalKerja", setgaji: "settingGaji",
};

/** Tambah (kode kosong) atau ubah data master. Izin menurut jenisnya. */
export async function simpanMaster(input: unknown): Promise<HasilAksi<{ kode: string }>> {
  return aksiAman(async () => {
    const dasar = validasi(skemaSimpanMaster, input);
    const def = DEF_MASTER[dasar.jenis];
    const pengguna = await wajibPeran(IZIN[def.izin]);
    const kodeLama = dasar.kode || null;
    // Kode akun tidak bisa diubah: pada ubah data, abaikan kode kiriman klien.
    const mentah = dasar.jenis === "akun" && kodeLama ? { ...dasar.nilai, kode: kodeLama } : dasar.nilai;
    const v = validasi(skemaIsiMaster(dasar.jenis), mentah) as Nilai;

    const kode = await db.$transaction(async (tx) => {
      if (kodeLama) {
        const ada = await (tx[MODEL[dasar.jenis] as "supplier"] as unknown as { findUnique: (a: unknown) => Promise<unknown> }).findUnique({ where: { kode: kodeLama } });
        if (!ada) throw new GalatAksi(`Data ${kodeLama} tidak ditemukan.`);
      }
      const k = await simpan(tx, dasar.jenis, kodeLama, v);
      await catatLog(tx, pengguna.id, `master.${kodeLama ? "ubah" : "tambah"}`, dasar.jenis, k);
      return k;
    });
    segarkan();
    return { pesan: `${def.label} ${kode} tersimpan.`, data: { kode } };
  });
}

/** Aktifkan atau nonaktifkan data master (hanya Owner). */
export async function ubahStatusMaster(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["master.nonaktifkan"]);
    const { jenis, kode, aktif } = validasi(skemaStatusMaster, input);
    await db.$transaction(async (tx) => {
      const model = tx[MODEL[jenis] as "supplier"] as unknown as { updateMany: (a: unknown) => Promise<{ count: number }> };
      const n = await model.updateMany({ where: { kode }, data: { aktif } });
      if (n.count !== 1) throw new GalatAksi(`Data ${kode} tidak ditemukan.`);
      await catatLog(tx, pengguna.id, aktif ? "master.aktifkan" : "master.nonaktifkan", jenis, kode);
    });
    segarkan();
    return { pesan: `${kode} ${aktif ? "diaktifkan" : "dinonaktifkan"}.` };
  });
}

/** Nama usaha dan keterangan yang tampil di sidebar (hanya Owner). */
export async function simpanProfil(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["profil.ubah"]);
    const d = validasi(skemaProfil, input);
    await db.$transaction(async (tx) => {
      await tx.profilUsaha.upsert({ where: { id: 1 }, create: { id: 1, ...d }, update: d });
      await catatLog(tx, pengguna.id, "profil.ubah", "profil", "1", d.nama);
    });
    segarkan();
    return { pesan: "Profil usaha tersimpan." };
  });
}
