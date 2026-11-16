/*
 * Kueri data master untuk halaman Master Konversi dan Master SDM. Hasil berupa objek biasa untuk komponen klien.
 * Tiap jenis dipetakan ke: kolom tabel (sudah diformat), nilai isian form, dan status aktif.
 */
import { db } from "@/lib/server/db";
import { labelPtkp } from "@/lib/inti/penggajian";
import { angka } from "@/lib/format";
import { LABEL_TIPE_AKUN } from "@/lib/format";
import { OPSI_STATIS, type JenisMaster, type OpsiMaster } from "@/lib/skema/master";

export type KolomMaster = { judul: string; angka?: boolean };
export type BarisMaster = { kode: string; nama: string; aktif: boolean; sel: string[]; nilai: Record<string, string | string[]> };
export type DaftarMaster = { kolom: KolomMaster[]; baris: BarisMaster[] };

const str = (x: unknown) => (x == null ? "" : String(x));
const urut = <T extends { kode: string }>(a: T[]) => a.slice().sort((x, y) => x.kode.localeCompare(y.kode));

/** Pilihan dinamis untuk form (kategori, akun, jabatan, karyawan, golongan, tunjangan). Yang nonaktif ditandai. */
export async function opsiMaster(): Promise<OpsiMaster> {
  const [kategori, akun, jabatan, karyawan, golongan, tunjangan] = await Promise.all([
    db.kategoriAset.findMany({ orderBy: { kode: "asc" } }),
    db.akun.findMany({ orderBy: { kode: "asc" } }),
    db.jabatan.findMany({ orderBy: { kode: "asc" } }),
    db.karyawan.findMany({ orderBy: { kode: "asc" } }),
    db.golongan.findMany({ orderBy: { kode: "asc" } }),
    db.tunjangan.findMany({ orderBy: { kode: "asc" } }),
  ]);
  return {
    ...OPSI_STATIS,
    kategori: kategori.map((x) => ({ nilai: x.kode, label: `${x.kode} · ${x.nama}`, nonaktif: !x.aktif })),
    akun: akun.map((x) => ({ nilai: x.kode, label: `${x.kode} · ${x.nama}`, nonaktif: !x.aktif })),
    jabatan: jabatan.map((x) => ({ nilai: x.kode, label: `${x.kode} · ${x.nama}`, nonaktif: !x.aktif })),
    karyawan: karyawan.map((x) => ({ nilai: x.kode, label: `${x.kode} · ${x.nama}`, nonaktif: !x.aktif })),
    golongan: golongan.map((x) => ({ nilai: x.kode, label: `${x.kode} · ${x.nama} (Rp${angka(x.jumlah)})`, nonaktif: !x.aktif })),
    tunjangan: tunjangan.map((x) => ({ nilai: x.kode, label: `${x.nama} (Rp${angka(x.nominal)})`, nonaktif: !x.aktif })),
  };
}

export async function daftarMaster(jenis: JenisMaster): Promise<DaftarMaster> {
  switch (jenis) {
    case "supplier": {
      const d = urut(await db.supplier.findMany());
      return {
        kolom: [{ judul: "Alamat" }, { judul: "Telepon" }, { judul: "NPWP" }],
        baris: d.map((x) => ({ kode: x.kode, nama: x.nama, aktif: x.aktif, sel: [x.alamat, x.telepon, str(x.npwp)], nilai: { nama: x.nama, alamat: x.alamat, telepon: x.telepon, email: x.email, npwp: str(x.npwp) } })),
      };
    }
    case "peralatan": {
      const d = urut(await db.peralatan.findMany({ include: { kategori: { select: { nama: true } } } }));
      return {
        kolom: [{ judul: "Satuan" }, { judul: "Kategori" }],
        baris: d.map((x) => ({ kode: x.kode, nama: x.nama, aktif: x.aktif, sel: [x.satuan, x.kategori.nama], nilai: { nama: x.nama, satuan: x.satuan, kategoriKode: x.kategoriKode } })),
      };
    }
    case "perlengkapan": {
      const d = urut(await db.perlengkapan.findMany());
      return { kolom: [{ judul: "Satuan" }], baris: d.map((x) => ({ kode: x.kode, nama: x.nama, aktif: x.aktif, sel: [x.satuan], nilai: { nama: x.nama, satuan: x.satuan } })) };
    }
    case "kategori": {
      const d = urut(await db.kategoriAset.findMany());
      return {
        kolom: [{ judul: "Masa manfaat" }, { judul: "Residu" }, { judul: "Akun aset / akumulasi / biaya" }],
        baris: d.map((x) => ({
          kode: x.kode, nama: x.nama, aktif: x.aktif,
          sel: [`${x.masaManfaatBulan} bln`, `${x.persenResidu}%`, `${x.akunAsetKode} / ${x.akunAkumulasiKode} / ${x.akunBebanKode}`],
          nilai: { nama: x.nama, masaManfaatBulan: str(x.masaManfaatBulan), persenResidu: str(x.persenResidu), akunAsetKode: x.akunAsetKode, akunAkumulasiKode: x.akunAkumulasiKode, akunBebanKode: x.akunBebanKode },
        })),
      };
    }
    case "akun": {
      const [d, mutasi] = await Promise.all([
        db.akun.findMany({ orderBy: { kode: "asc" } }),
        db.detailJurnal.groupBy({ by: ["akunKode"], where: { jurnal: { status: "DISETUJUI" } }, _sum: { debit: true, kredit: true } }),
      ]);
      const peta = new Map(mutasi.map((m) => [m.akunKode, (m._sum.debit ?? 0) - (m._sum.kredit ?? 0)]));
      return {
        kolom: [{ judul: "Tipe" }, { judul: "Saldo normal" }, { judul: "Saldo (Rp)", angka: true }],
        baris: d.map((x) => {
          const net = peta.get(x.kode) ?? 0;
          return {
            kode: x.kode, nama: x.nama, aktif: x.aktif,
            sel: [LABEL_TIPE_AKUN[x.tipe], x.saldoNormal === "K" ? "Kredit" : "Debit", angka(x.saldoNormal === "D" ? net : -net)],
            nilai: { kode: x.kode, nama: x.nama, tipe: x.tipe, saldoNormal: x.saldoNormal },
          };
        }),
      };
    }
    case "karyawan": {
      const d = urut(await db.karyawan.findMany());
      return {
        kolom: [{ judul: "PTKP" }, { judul: "Rekening" }],
        baris: d.map((x) => ({ kode: x.kode, nama: x.nama, aktif: x.aktif, sel: [labelPtkp(x.statusPtkp), `${x.bank} ${x.noRek}`], nilai: { nama: x.nama, statusPtkp: x.statusPtkp, bank: x.bank, noRek: x.noRek } })),
      };
    }
    case "jabatan": {
      const d = urut(await db.jabatan.findMany({ include: { akunBeban: { select: { nama: true } } } }));
      return {
        kolom: [{ judul: "Tunj. jabatan (Rp)", angka: true }, { judul: "Tunj. istri/anak (Rp)", angka: true }, { judul: "Akun biaya" }],
        baris: d.map((x) => ({
          kode: x.kode, nama: x.nama, aktif: x.aktif,
          sel: [angka(x.tunjJabatan), angka(x.tunjKeluarga), `${x.akunBebanKode} ${x.akunBeban.nama}`],
          nilai: { nama: x.nama, tunjJabatan: str(x.tunjJabatan), tunjKeluarga: str(x.tunjKeluarga), akunBebanKode: x.akunBebanKode },
        })),
      };
    }
    case "golongan": {
      const d = urut(await db.golongan.findMany());
      return { kolom: [{ judul: "Gaji pokok (Rp)", angka: true }], baris: d.map((x) => ({ kode: x.kode, nama: x.nama, aktif: x.aktif, sel: [angka(x.jumlah)], nilai: { nama: x.nama, jumlah: str(x.jumlah) } })) };
    }
    case "tunjangan": {
      const d = urut(await db.tunjangan.findMany());
      return { kolom: [{ judul: "Nominal (Rp)", angka: true }], baris: d.map((x) => ({ kode: x.kode, nama: x.nama, aktif: x.aktif, sel: [angka(x.nominal)], nilai: { nama: x.nama, nominal: str(x.nominal) } })) };
    }
    case "jadwal": {
      const d = urut(await db.jadwalKerja.findMany({ include: { jabatan: { select: { nama: true } } } }));
      return {
        kolom: [{ judul: "Jam kerja" }, { judul: "Hari kerja" }],
        baris: d.map((x) => ({
          kode: x.kode, nama: x.jabatan.nama, aktif: x.aktif,
          sel: [`${x.jamMasuk} sampai ${x.jamKeluar}`, `${x.hariKerja} hari/bulan`],
          nilai: { jabatanKode: x.jabatanKode, jamMasuk: x.jamMasuk, jamKeluar: x.jamKeluar, hariKerja: str(x.hariKerja) },
        })),
      };
    }
    case "setgaji": {
      const d = urut(await db.settingGaji.findMany({ include: { karyawan: true, jabatan: true, golongan: true, tunjangan: { include: { tunjangan: true } } } }));
      return {
        kolom: [{ judul: "Jabatan" }, { judul: "Gaji pokok" }, { judul: "Tunjangan" }, { judul: "Estimasi bruto (Rp)", angka: true }],
        baris: d.map((x) => {
          const lain = x.tunjangan.reduce((s, t) => s + t.tunjangan.nominal, 0);
          const bruto = x.golongan.jumlah + x.jabatan.tunjJabatan + (x.karyawan.statusPtkp.startsWith("K") ? x.jabatan.tunjKeluarga : 0) + lain;
          return {
            kode: x.kode, nama: x.karyawan.nama, aktif: x.aktif,
            sel: [x.jabatan.nama, x.golongan.nama, x.tunjangan.map((t) => t.tunjangan.nama).join(", ") || "-", angka(bruto)],
            nilai: { karyawanKode: x.karyawanKode, jabatanKode: x.jabatanKode, golonganKode: x.golonganKode, tunjanganKodes: x.tunjangan.map((t) => t.tunjanganKode) },
          };
        }),
      };
    }
  }
}

