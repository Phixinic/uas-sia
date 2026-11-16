/*
 * Kueri periode akuntansi: daftar periode yang dikenal dan daftar periksa sebelum periode dikunci
 * (padanan cekPeriode() di versi-statis/assets/js/views/periode.js).
 */
import { db } from "@/lib/server/db";
import { muatJurnalBuku } from "@/lib/server/jurnal";
import { neracaSaldo, type JurnalBuku } from "@/lib/inti/buku-besar";
import { dariDate, hariTerakhir, keDate, periodeDari, periodeIni } from "@/lib/inti/tanggal";

/** Semua periode yang pernah dipakai (baris periode, jurnal, pembelian) ditambah periode berjalan, urut naik. */
export async function semuaPeriode(): Promise<string[]> {
  const [p, j, b] = await Promise.all([
    db.periode.findMany({ select: { id: true } }),
    db.jurnal.findMany({ distinct: ["periodeId"], select: { periodeId: true } }),
    db.pembelian.findMany({ select: { tanggal: true } }),
  ]);
  const s = new Set<string>([periodeIni()]);
  // Baris periode juga dibuat untuk jadwal penyusutan di masa depan; yang melewati periode berjalan tidak ditampilkan.
  p.filter((x) => x.id <= periodeIni()).forEach((x) => s.add(x.id));
  j.forEach((x) => s.add(x.periodeId));
  b.forEach((x) => s.add(periodeDari(dariDate(x.tanggal))));
  return [...s].filter(Boolean).sort();
}

/** Periode terbaru yang punya jurnal disetujui (bawaan filter laporan), atau periode berjalan bila belum ada. */
export async function periodeLaporanBawaan(): Promise<string> {
  const j = await db.jurnal.findFirst({ where: { status: "DISETUJUI" }, orderBy: { periodeId: "desc" }, select: { periodeId: true } });
  return j?.periodeId ?? periodeIni();
}

export type ButirPeriksa = { label: string; lulus: boolean; catatan: string };

/** Daftar periksa satu periode. `buku` = jurnal disetujui (dimuat sekali oleh pemanggil bila memeriksa banyak periode). */
export async function cekPeriode(P: string, buku?: JurnalBuku[]): Promise<ButirPeriksa[]> {
  const awal = keDate(`${P}-01`);
  const akhir = keDate(hariTerakhir(P));
  const [drafBeli, susutBelum, jurnalTunda, pelepasanTunda, perlengkapanPosting, opname, penggajianTunda, daftarAkun, bukuSemua] = await Promise.all([
    db.pembelian.count({ where: { status: "DRAFT", tanggal: { gte: awal, lte: akhir } } }),
    db.jadwalPenyusutan.count({ where: { aset: { status: "AKTIF" }, periodeId: { lte: P }, jurnalNo: null } }),
    db.jurnal.count({ where: { periodeId: P, status: { in: ["DRAFT", "DIAJUKAN"] } } }),
    db.pelepasan.count({ where: { status: "DIAJUKAN", tanggal: { gte: awal, lte: akhir } } }),
    db.pembelian.count({ where: { jenis: "PERLENGKAPAN", status: "DISETUJUI", tanggal: { lte: akhir } } }),
    db.opname.findUnique({ where: { periodeId: P }, select: { status: true } }),
    db.penggajian.count({ where: { periodeId: P, status: "DIAJUKAN" } }),
    db.akun.findMany({ select: { kode: true } }),
    buku ? Promise.resolve(buku) : muatJurnalBuku(db, P),
  ]);
  const ns = neracaSaldo(bukuSemua.filter((j) => j.periode <= P), daftarAkun.map((a) => a.kode), P);
  const perluOpname = perlengkapanPosting > 0;
  const opnameAda = !!opname && opname.status !== "DITOLAK";
  return [
    { label: "Semua pembelian periode ini sudah diposting", lulus: drafBeli === 0, catatan: drafBeli ? `${drafBeli} draf` : "" },
    { label: "Penyusutan sudah diproses sampai periode ini", lulus: susutBelum === 0, catatan: susutBelum ? `${susutBelum} baris jadwal belum dijurnal` : "" },
    { label: "Nilai sisa perlengkapan sudah diinput", lulus: !perluOpname || opnameAda, catatan: perluOpname && !opnameAda ? "belum ada opname" : "" },
    { label: "Jurnal penyesuaian sudah diputuskan", lulus: jurnalTunda === 0, catatan: jurnalTunda ? `${jurnalTunda} menunggu` : "" },
    { label: "Pengajuan pelepasan sudah diputuskan", lulus: pelepasanTunda === 0, catatan: pelepasanTunda ? `${pelepasanTunda} menunggu` : "" },
    { label: "Pengajuan penggajian sudah diputuskan", lulus: penggajianTunda === 0, catatan: penggajianTunda ? `${penggajianTunda} menunggu` : "" },
    { label: "Neraca saldo seimbang", lulus: ns.seimbang, catatan: ns.seimbang ? "" : `selisih ${Math.abs(ns.debit - ns.kredit).toLocaleString("id-ID")}` },
  ];
}

export type DataPeriode = {
  id: string;
  status: "TERBUKA" | "TERKUNCI";
  dikunciOleh: string | null;
  dikunciPada: string | null;
  riwayat: { aksi: "KUNCI" | "BUKA"; oleh: string; waktu: string; alasan: string | null }[];
  periksa: ButirPeriksa[] | null;
};

/** Periode terbaru lebih dulu. Daftar periksa hanya dihitung untuk periode yang masih terbuka. */
export async function dataTutupPeriode(maks = 12): Promise<DataPeriode[]> {
  const ids = (await semuaPeriode()).reverse().slice(0, maks);
  const [baris, buku] = await Promise.all([
    db.periode.findMany({
      where: { id: { in: ids } },
      include: { pengunci: { select: { nama: true } }, riwayat: { orderBy: { waktu: "desc" }, include: { oleh: { select: { nama: true } } } } },
    }),
    muatJurnalBuku(db),
  ]);
  const peta = new Map(baris.map((p) => [p.id, p]));
  return Promise.all(
    ids.map(async (id) => {
      const p = peta.get(id);
      const status = p?.status ?? "TERBUKA";
      return {
        id,
        status,
        dikunciOleh: p?.pengunci?.nama ?? null,
        dikunciPada: p?.dikunciPada?.toISOString() ?? null,
        riwayat: (p?.riwayat ?? []).map((r) => ({ aksi: r.aksi, oleh: r.oleh.nama, waktu: r.waktu.toISOString(), alasan: r.alasan })),
        periksa: status === "TERBUKA" ? await cekPeriode(id, buku) : null,
      };
    }),
  );
}
