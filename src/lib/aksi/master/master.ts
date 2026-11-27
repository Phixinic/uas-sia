"use server";

/*
 * Server action data master (supplier, peralatan, perlengkapan, kategori, akun, karyawan, jabatan, golongan,
 * tunjangan, jadwal kerja, setting gaji) dan profil usaha.
 * Master tidak pernah dihapus, hanya dinonaktifkan, supaya transaksi lama tetap terbaca.
 * Izin per jenis ada di DEF_MASTER (lihat src/lib/skema/master.ts), nonaktifkan hanya Owner. Struktur gaji (jabatan,
 * jabatan event, golongan, tunjangan) hanya ditambah dan diubah HRD.
 * Nominal jabatan, jabatan event, golongan, dan tunjangan berversi (tabel versi_nominal): data baru langsung membuat
 * pengajuan nominal awal dengan bulan berlaku, ubah data hanya mengubah atribut lain (nama, akun biaya, peran, satuan).
 * Perubahan nominal sesudahnya lewat ajukanNominal (src/lib/aksi/master/nominal.ts).
 */
import { db, type Tx } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { AWALAN, kodeBerikutnya } from "@/lib/server/nomor";
import { catatLog } from "@/lib/server/log";
import { DEF_MASTER, NOMINAL_STRUKTUR, skemaIsiMaster, skemaProfil, skemaSimpanMaster, skemaStatusMaster, termasukStruktur, type JenisMaster } from "@/lib/skema/master";
import { ajukanNominalDalam } from "@/lib/server/nominal";
import { labelPeriode, periodeDariBulanTahun } from "@/lib/inti/tanggal";
import type { JenisKaryawan, PeranEvent, SaldoNormal, SatuanTarif, StatusPtkp, TipeAkun } from "@/generated/prisma/enums";

type Nilai = Record<string, string | number | string[]>;

const kosongJadiNull = (v: unknown) => (String(v ?? "").trim() === "" ? null : String(v).trim());

/** Memastikan master rujukan ada dan aktif (kecuali memang sudah dipakai data ini sebelumnya). */
async function pastikanRujukan(daftar: { ada: boolean; aktif: boolean; label: string; lama?: boolean; isian: string }[]) {
  for (const r of daftar) {
    if (!r.ada) throw new GalatAksi(`${r.label} tidak ditemukan.`, { [r.isian]: `${r.label} tidak ditemukan.` });
    if (!r.aktif && !r.lama) throw new GalatAksi(`${r.label} sudah dinonaktifkan.`, { [r.isian]: `${r.label} nonaktif.` });
  }
}

/** Setting gaji dan jadwal kerja hanya untuk karyawan dan jabatan inhouse (crew event dibayar lewat fee event). */
async function pastikanInhouse(tx: Tx, r: { karyawanKode?: string; jabatanKode?: string }) {
  if (r.karyawanKode) {
    const k = await tx.karyawan.findUnique({ where: { kode: r.karyawanKode }, select: { jenis: true } });
    if (k?.jenis === "EVENT") throw new GalatAksi("Karyawan event tidak memakai setting gaji. Fee-nya dihitung di menu Fee event.", { karyawanKode: "Karyawan event." });
  }
  if (r.jabatanKode) {
    const j = await tx.jabatan.findUnique({ where: { kode: r.jabatanKode }, select: { kelompok: true } });
    if (j?.kelompok === "EVENT") throw new GalatAksi("Jabatan event tidak dipakai untuk gaji inhouse.", { jabatanKode: "Jabatan event." });
  }
}

/** Pengajuan nominal awal data master baru: versi DIAJUKAN dengan bulan berlaku dari form, diputuskan Owner. */
async function ajukanNominalAwal(tx: Tx, penggunaId: number, jenis: JenisMaster, kode: string, v: Nilai) {
  if (!termasukStruktur(jenis)) return null;
  const berlaku = periodeDariBulanTahun(v.bulan, v.tahun);
  if (!berlaku) throw new GalatAksi("Pilih bulan dan tahun berlaku nominal awal.", { bulan: "Pilih bulan berlaku.", tahun: "Pilih tahun berlaku." });
  const n = (k: string) => Number(v[k] ?? 0);
  const jenisNominal = NOMINAL_STRUKTUR[jenis];
  const nominal = jenis === "golongan" ? n("jumlah") : jenis === "tunjangan" ? n("nominal") : jenis === "jabatanEvent" ? n("tarif") : 0;
  const h = await ajukanNominalDalam(tx, penggunaId, {
    jenis: jenisNominal,
    itemKode: kode,
    nominal,
    tunjJabatan: jenis === "jabatan" ? n("tunjJabatan") : 0,
    tunjKeluarga: jenis === "jabatan" ? n("tunjKeluarga") : 0,
    berlaku,
    alasan: "Nominal awal data baru.",
  });
  return { kode: h.kode, berlaku };
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
      // Isian jenis kosong (form lama atau kiriman tanpa jenis) dianggap Inhouse, sama dengan nilai bawaan kolomnya.
      const jenisBaru = (s("jenis") || "INHOUSE") as JenisKaryawan;
      const data = { nama: s("nama"), statusPtkp: s("statusPtkp") as StatusPtkp, bank: s("bank"), noRek: s("noRek"), jenis: jenisBaru };
      if (baru) return (await tx.karyawan.create({ data: { kode: await kodeBerikutnya(tx, AWALAN.KARYAWAN), ...data } })).kode;
      const lama = await tx.karyawan.findUniqueOrThrow({ where: { kode: kodeLama }, select: { jenis: true, _count: { select: { settingGaji: true, presensi: true, slipGaji: true, penugasan: true, kehadiran: true } }, pengguna: { select: { id: true } } } });
      if (lama.jenis !== jenisBaru) {
        const c = lama._count;
        if (jenisBaru === "EVENT" && (c.settingGaji || c.presensi || c.slipGaji)) {
          throw new GalatAksi("Karyawan ini sudah punya setting gaji, presensi, atau slip gaji inhouse, jadi jenisnya tidak bisa diubah menjadi Event. Buat data karyawan baru untuk crew event.", { jenis: "Sudah dipakai di gaji inhouse." });
        }
        if (jenisBaru === "INHOUSE" && (c.penugasan || c.kehadiran || lama.pengguna)) {
          throw new GalatAksi("Karyawan ini sudah ditugaskan di event atau ditautkan ke akun kapten, jadi jenisnya tidak bisa diubah menjadi Inhouse.", { jenis: "Sudah dipakai di fee event." });
        }
      }
      await tx.karyawan.update({ where: { kode: kodeLama }, data });
      return kodeLama;
    }
    case "jabatan": {
      const lama = kodeLama ? await tx.jabatan.findUnique({ where: { kode: kodeLama }, select: { akunBebanKode: true, kelompok: true } }) : null;
      if (lama && lama.kelompok !== "INHOUSE") throw new GalatAksi("Jabatan ini jabatan event. Ubah lewat tab Jabatan event.");
      await pastikanRujukan([await ada("akun", s("akunBebanKode"), "Akun biaya gaji", "akunBebanKode", lama?.akunBebanKode === s("akunBebanKode"))]);
      // Tunjangan jabatan dan istri/anak tidak disimpan di jabatan, tetapi di versi nominal (lihat ajukanNominalAwal).
      const data = { nama: s("nama"), akunBebanKode: s("akunBebanKode") };
      if (baru) return (await tx.jabatan.create({ data: { kode: await kodeBerikutnya(tx, AWALAN.JABATAN), ...data, kelompok: "INHOUSE" } })).kode;
      await tx.jabatan.update({ where: { kode: kodeLama }, data });
      return kodeLama;
    }
    case "jabatanEvent": {
      const lama = kodeLama ? await tx.jabatan.findUnique({ where: { kode: kodeLama }, select: { akunBebanKode: true, kelompok: true, peranEvent: true, satuanTarif: true, _count: { select: { penugasan: true } } } }) : null;
      if (lama && lama.kelompok !== "EVENT") throw new GalatAksi("Jabatan ini jabatan inhouse. Ubah lewat tab Jabatan.");
      await pastikanRujukan([await ada("akun", s("akunBebanKode"), "Akun biaya fee", "akunBebanKode", lama?.akunBebanKode === s("akunBebanKode"))]);
      const peranEvent = s("peranEvent") as PeranEvent;
      if (lama && lama.peranEvent !== peranEvent && lama._count.penugasan) {
        throw new GalatAksi("Jabatan ini sudah dipakai di penugasan event, jadi perannya (Kapten atau Crew) tidak bisa diubah. Buat jabatan baru.", { peranEvent: "Sudah dipakai di penugasan." });
      }
      // Satuan tarif menentukan arti angka tarif di semua versi (per hari atau per jam), jadi dikunci begitu jabatan dipakai.
      if (lama && lama.satuanTarif !== s("satuanTarif") && lama._count.penugasan) {
        throw new GalatAksi("Jabatan ini sudah dipakai di penugasan event, jadi satuan tarifnya (per hari atau per jam) tidak bisa diubah. Buat jabatan baru.", { satuanTarif: "Sudah dipakai di penugasan." });
      }
      const data = { nama: s("nama"), peranEvent, satuanTarif: s("satuanTarif") as SatuanTarif, akunBebanKode: s("akunBebanKode") };
      if (baru) return (await tx.jabatan.create({ data: { kode: await kodeBerikutnya(tx, AWALAN.JABATAN), ...data, kelompok: "EVENT" } })).kode;
      await tx.jabatan.update({ where: { kode: kodeLama }, data });
      return kodeLama;
    }
    case "golongan": {
      const data = { nama: s("nama") };
      if (baru) return (await tx.golongan.create({ data: { kode: await kodeBerikutnya(tx, AWALAN.GOLONGAN), ...data } })).kode;
      await tx.golongan.update({ where: { kode: kodeLama }, data });
      return kodeLama;
    }
    case "tunjangan": {
      const data = { nama: s("nama") };
      if (baru) return (await tx.tunjangan.create({ data: { kode: await kodeBerikutnya(tx, AWALAN.TUNJANGAN), ...data } })).kode;
      await tx.tunjangan.update({ where: { kode: kodeLama }, data });
      return kodeLama;
    }
    case "jadwal": {
      // Jadwal kerja adalah kolom jabatan inhouse (dulu tabel jadwal_kerja 1:1). Kode baris = kode jabatan.
      const tujuan = s("jabatanKode");
      await pastikanRujukan([await ada("jabatan", tujuan, "Jabatan", "jabatanKode", kodeLama === tujuan)]);
      await pastikanInhouse(tx, { jabatanKode: tujuan });
      const sasaran = await tx.jabatan.findUniqueOrThrow({ where: { kode: tujuan }, select: { jamMasuk: true } });
      if (sasaran.jamMasuk && tujuan !== kodeLama) throw new GalatAksi("Jabatan ini sudah punya jadwal kerja.", { jabatanKode: "Jabatan ini sudah punya jadwal kerja." });
      // Jadwal dipindah ke jabatan lain: jabatan lama tidak lagi punya jadwal.
      if (kodeLama && kodeLama !== tujuan) await tx.jabatan.update({ where: { kode: kodeLama }, data: { jamMasuk: null, jamKeluar: null, hariKerja: null } });
      await tx.jabatan.update({ where: { kode: tujuan }, data: { jamMasuk: s("jamMasuk"), jamKeluar: s("jamKeluar"), hariKerja: n("hariKerja") } });
      return tujuan;
    }
    case "setgaji":
      // Setting gaji tidak pernah ditimpa: setiap versi lewat pengajuan dan persetujuan Owner (src/lib/aksi/master/setting-gaji.ts).
      throw new GalatAksi("Setting gaji diubah lewat pengajuan di tab Setting gaji, lalu disetujui Owner.");
  }
}

const MODEL: Record<JenisMaster, string> = {
  supplier: "supplier", peralatan: "peralatan", perlengkapan: "perlengkapan", kategori: "kategoriAset", akun: "akun",
  karyawan: "karyawan", jabatan: "jabatan", jabatanEvent: "jabatan", golongan: "golongan", tunjangan: "tunjangan", jadwal: "jabatan", setgaji: "settingGaji",
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
    // Ubah data tidak memuat isian nominal: nominal berversi diubah lewat pengajuan perubahan nominal.
    const v = validasi(skemaIsiMaster(dasar.jenis, { baru: !kodeLama }), mentah) as Nilai;

    const hasil = await db.$transaction(async (tx) => {
      if (kodeLama) {
        const ada = await (tx[MODEL[dasar.jenis] as "supplier"] as unknown as { findUnique: (a: unknown) => Promise<unknown> }).findUnique({ where: { kode: kodeLama } });
        if (!ada) throw new GalatAksi(`Data ${kodeLama} tidak ditemukan.`);
      }
      const k = await simpan(tx, dasar.jenis, kodeLama, v);
      await catatLog(tx, pengguna.id, `master.${kodeLama ? "ubah" : "tambah"}`, dasar.jenis, k);
      const nominal = kodeLama ? null : await ajukanNominalAwal(tx, pengguna.id, dasar.jenis, k, v);
      return { kode: k, nominal };
    });
    segarkan();
    const kode = hasil.kode;
    const tambahan = hasil.nominal ? ` Nominal awal ${hasil.nominal.kode} (berlaku ${labelPeriode(hasil.nominal.berlaku)}) menunggu persetujuan Owner.` : "";
    return { pesan: `${def.label} ${kode} tersimpan.${tambahan}`, data: { kode } };
  });
}

/** Aktifkan atau nonaktifkan data master (hanya Owner). */
export async function ubahStatusMaster(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["master.nonaktifkan"]);
    const { jenis, kode, aktif } = validasi(skemaStatusMaster, input);
    if (jenis === "setgaji") throw new GalatAksi("Versi setting gaji tidak dinonaktifkan. Ajukan perubahan setting, atau nonaktifkan karyawannya.");
    if (jenis === "jadwal") throw new GalatAksi("Jadwal kerja melekat pada jabatan, jadi tidak dinonaktifkan sendiri. Ubah jamnya, atau nonaktifkan jabatannya di tab Struktur gaji.");
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
