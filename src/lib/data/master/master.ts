/*
 * Kueri data master untuk halaman Master Konversi dan Master SDM. Hasil berupa objek biasa untuk komponen klien.
 * Tiap jenis dipetakan ke: kolom tabel (sudah diformat), nilai isian form, dan status aktif.
 */
import { db } from "@/lib/server/db";
import { labelPtkp } from "@/lib/inti/penggajian";
import { angka } from "@/lib/format";
import { periodeIni } from "@/lib/inti/tanggal";
import { saldoBukuLkp } from "@/lib/data/konversi/nilai-sisa";
import { LABEL_TIPE_AKUN } from "@/lib/format";
import { OPSI_STATIS, type JenisMaster, type OpsiMaster } from "@/lib/skema/master";
import { muatPetaNominal } from "@/lib/server/nominal";

export type KolomMaster = { judul: string; angka?: boolean };
export type BarisMaster = { kode: string; nama: string; aktif: boolean; sel: string[]; nilai: Record<string, string | string[]> };
export type DaftarMaster = { kolom: KolomMaster[]; baris: BarisMaster[] };

const str = (x: unknown) => (x == null ? "" : String(x));
const urut = <T extends { kode: string }>(a: T[]) => a.slice().sort((x, y) => x.kode.localeCompare(y.kode));

/** Pilihan dinamis untuk form (kategori, akun, jabatan, karyawan, golongan, tunjangan). Yang nonaktif ditandai. */
export async function opsiMaster(periode = periodeIni()): Promise<OpsiMaster> {
  const [kategori, akun, jabatan, karyawan, golongan, tunjangan, peta] = await Promise.all([
    db.kategoriAset.findMany({ orderBy: { kode: "asc" } }),
    db.akun.findMany({ orderBy: { kode: "asc" } }),
    // Pilihan jabatan dan karyawan dipakai Jadwal kerja dan Setting gaji, jadi hanya yang inhouse.
    db.jabatan.findMany({ where: { kelompok: "INHOUSE" }, orderBy: { kode: "asc" } }),
    db.karyawan.findMany({ where: { jenis: "INHOUSE" }, orderBy: { kode: "asc" } }),
    db.golongan.findMany({ orderBy: { kode: "asc" } }),
    db.tunjangan.findMany({ orderBy: { kode: "asc" } }),
    muatPetaNominal(db),
  ]);
  // Nominal di label = versi yang berlaku bulan berjalan; "belum berlaku" bila nominal awalnya belum disetujui.
  const rp = (n: number | undefined) => (n === undefined ? "belum berlaku" : `Rp${angka(n)}`);
  return {
    ...OPSI_STATIS,
    kategori: kategori.map((x) => ({ nilai: x.kode, label: `${x.kode} · ${x.nama}`, nonaktif: !x.aktif })),
    akun: akun.map((x) => ({ nilai: x.kode, label: `${x.kode} · ${x.nama}`, nonaktif: !x.aktif })),
    jabatan: jabatan.map((x) => ({ nilai: x.kode, label: `${x.kode} · ${x.nama}`, nonaktif: !x.aktif })),
    karyawan: karyawan.map((x) => ({ nilai: x.kode, label: `${x.kode} · ${x.nama}`, nonaktif: !x.aktif })),
    golongan: golongan.map((x) => ({ nilai: x.kode, label: `${x.kode} · ${x.nama} (${rp(peta.pada("GOLONGAN", x.kode, periode)?.nominal)})`, nonaktif: !x.aktif })),
    tunjangan: tunjangan.map((x) => ({ nilai: x.kode, label: `${x.nama} (${rp(peta.pada("TUNJANGAN", x.kode, periode)?.nominal)})`, nonaktif: !x.aktif })),
  };
}

/** Kolom nominal master struktur gaji = versi yang berlaku di periode (bawaan bulan berjalan); "-" bila belum berlaku. */
export async function daftarMaster(jenis: JenisMaster, periode = periodeIni()): Promise<DaftarMaster> {
  const butuhPeta = jenis === "jabatan" || jenis === "jabatanEvent" || jenis === "golongan" || jenis === "tunjangan" || jenis === "setgaji";
  const peta = butuhPeta ? await muatPetaNominal(db) : null;
  const rpAtau = (n: number | undefined) => (n === undefined ? "-" : angka(n));
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
      const [d, saldo] = await Promise.all([db.perlengkapan.findMany(), saldoBukuLkp(db, periodeIni())]);
      const peta = new Map(saldo.map((x) => [x.kode, x.saldoBuku]));
      return { kolom: [{ judul: "Satuan" }, { judul: "Saldo buku (Rp)", angka: true }], baris: urut(d).map((x) => ({ kode: x.kode, nama: x.nama, aktif: x.aktif, sel: [x.satuan, angka(peta.get(x.kode) ?? 0)], nilai: { nama: x.nama, satuan: x.satuan } })) };
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
        kolom: [{ judul: "Jenis" }, { judul: "PTKP" }, { judul: "Rekening" }],
        baris: d.map((x) => ({
          kode: x.kode, nama: x.nama, aktif: x.aktif,
          sel: [x.jenis === "EVENT" ? "Event (fee)" : "Inhouse", labelPtkp(x.statusPtkp), `${x.bank} ${x.noRek}`],
          nilai: { nama: x.nama, statusPtkp: x.statusPtkp, bank: x.bank, noRek: x.noRek, jenis: x.jenis },
        })),
      };
    }
    case "jabatan": {
      const d = urut(await db.jabatan.findMany({ where: { kelompok: "INHOUSE" }, include: { akunBeban: { select: { nama: true } } } }));
      return {
        kolom: [{ judul: "Tunj. jabatan (Rp)", angka: true }, { judul: "Tunj. istri/anak (Rp)", angka: true }, { judul: "Akun biaya" }],
        baris: d.map((x) => {
          const v = peta!.pada("JABATAN", x.kode, periode);
          return {
            kode: x.kode, nama: x.nama, aktif: x.aktif,
            sel: [rpAtau(v?.tunjJabatan), rpAtau(v?.tunjKeluarga), `${x.akunBebanKode} ${x.akunBeban.nama}`],
            nilai: { nama: x.nama, akunBebanKode: x.akunBebanKode },
          };
        }),
      };
    }
    case "jabatanEvent": {
      const d = urut(await db.jabatan.findMany({ where: { kelompok: "EVENT" }, include: { akunBeban: { select: { nama: true } }, _count: { select: { penugasan: true } } } }));
      return {
        kolom: [{ judul: "Peran" }, { judul: "Tarif (Rp)", angka: true }, { judul: "Satuan" }, { judul: "Akun biaya" }, { judul: "Dipakai", angka: true }],
        baris: d.map((x) => ({
          kode: x.kode, nama: x.nama, aktif: x.aktif,
          sel: [x.peranEvent === "KAPTEN" ? "Kapten" : "Crew", rpAtau(peta!.pada("JABATAN_EVENT", x.kode, periode)?.nominal), x.satuanTarif === "HARI" ? "per hari" : "per jam", `${x.akunBebanKode} ${x.akunBeban.nama}`, `${x._count.penugasan} penugasan`],
          nilai: { nama: x.nama, peranEvent: x.peranEvent ?? "", satuanTarif: x.satuanTarif ?? "", akunBebanKode: x.akunBebanKode },
        })),
      };
    }
    case "golongan": {
      const d = urut(await db.golongan.findMany());
      return { kolom: [{ judul: "Gaji pokok (Rp)", angka: true }], baris: d.map((x) => ({ kode: x.kode, nama: x.nama, aktif: x.aktif, sel: [rpAtau(peta!.pada("GOLONGAN", x.kode, periode)?.nominal)], nilai: { nama: x.nama } })) };
    }
    case "tunjangan": {
      const d = urut(await db.tunjangan.findMany());
      return { kolom: [{ judul: "Nominal (Rp)", angka: true }], baris: d.map((x) => ({ kode: x.kode, nama: x.nama, aktif: x.aktif, sel: [rpAtau(peta!.pada("TUNJANGAN", x.kode, periode)?.nominal)], nilai: { nama: x.nama } })) };
    }
    case "jadwal": {
      // Jadwal kerja melekat di jabatan inhouse (kolom jam_masuk, jam_keluar, hari_kerja); kode baris = kode jabatan.
      const d = urut(await db.jabatan.findMany({ where: { kelompok: "INHOUSE", jamMasuk: { not: null } } }));
      return {
        kolom: [{ judul: "Jam kerja" }, { judul: "Hari kerja" }],
        baris: d.map((x) => ({
          kode: x.kode, nama: x.nama, aktif: x.aktif,
          sel: [`${x.jamMasuk} sampai ${x.jamKeluar}`, `${x.hariKerja} hari/bulan`],
          nilai: { jabatanKode: x.kode, jamMasuk: x.jamMasuk ?? "", jamKeluar: x.jamKeluar ?? "", hariKerja: str(x.hariKerja ?? 0) },
        })),
      };
    }
    case "setgaji": {
      const d = urut(await db.settingGaji.findMany({ include: { karyawan: true, jabatan: true, golongan: true, tunjangan: { include: { tunjangan: true } } } }));
      return {
        kolom: [{ judul: "Jabatan" }, { judul: "Gaji pokok" }, { judul: "Tunjangan" }, { judul: "Estimasi bruto (Rp)", angka: true }],
        baris: d.map((x) => {
          const p = x.berlakuMulai > periode ? x.berlakuMulai : periode;
          const vj = peta!.pada("JABATAN", x.jabatanKode, p);
          const lain = x.tunjangan.reduce((s, t) => s + (peta!.pada("TUNJANGAN", t.tunjanganKode, p)?.nominal ?? 0), 0);
          const bruto = (peta!.pada("GOLONGAN", x.golonganKode, p)?.nominal ?? 0) + (vj?.tunjJabatan ?? 0) + (x.karyawan.statusPtkp.startsWith("K") ? vj?.tunjKeluarga ?? 0 : 0) + lain;
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

