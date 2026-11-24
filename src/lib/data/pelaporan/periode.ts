/*
 * Kueri periode akuntansi: daftar periode yang dikenal dan daftar periksa sebelum periode dikunci
 * (padanan cekPeriode() di versi-statis/assets/js/views/periode.js).
 */
import { db, type DbAtauTx } from "@/lib/server/db";
import { muatJurnalBuku } from "@/lib/server/jurnal";
import { neracaSaldo, type JurnalBuku } from "@/lib/inti/buku-besar";
import { dariDate, hariTerakhir, keDate, labelPeriode, periodeDari, periodeIni } from "@/lib/inti/tanggal";
import { saldoBukuLkp } from "@/lib/data/konversi/nilai-sisa";

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

/**
 * Daftar periksa satu periode. `buku` = jurnal disetujui (dimuat sekali oleh pemanggil bila memeriksa banyak periode).
 * `klien` = transaksi aksi kunci periode, supaya pemeriksaan berjalan di dalam kunci eksklusifnya.
 */
export async function cekPeriode(P: string, buku?: JurnalBuku[], klien: DbAtauTx = db): Promise<ButirPeriksa[]> {
  const awal = keDate(`${P}-01`);
  const akhir = keDate(hariTerakhir(P));
  const [drafBeli, susutBelum, jurnalTunda, pelepasanTunda, saldoLkp, opname, penggajianTunda, daftarAkun, bukuSemua] = await Promise.all([
    klien.pembelian.count({ where: { status: "DRAFT", tanggal: { gte: awal, lte: akhir } } }),
    klien.jadwalPenyusutan.count({ where: { aset: { status: "AKTIF" }, periodeId: { lte: P }, jurnalNo: null } }),
    klien.jurnal.count({ where: { periodeId: P, status: { in: ["DRAFT", "DIAJUKAN"] } } }),
    klien.pelepasan.count({ where: { status: "DIAJUKAN", tanggal: { gte: awal, lte: akhir } } }),
    // Rumus yang sama dengan form nilai sisa: perlengkapan yang masih bersaldo buku di periode P.
    saldoBukuLkp(klien, P),
    klien.opname.findUnique({ where: { periodeId: P }, select: { status: true, _count: { select: { revisi: { where: { status: "DIAJUKAN" } } } } } }),
    klien.penggajian.count({ where: { periodeId: P, status: "DIAJUKAN" } }),
    klien.akun.findMany({ select: { kode: true } }),
    buku ? Promise.resolve(buku) : muatJurnalBuku(klien, P),
  ]);
  const ns = neracaSaldo(bukuSemua.filter((j) => j.periode <= P), daftarAkun.map((a) => a.kode), P);
  // Nilai sisa hanya wajib bila ada perlengkapan yang perlu dihitung. Bulan bersaldo nol tidak bisa diinput
  // ("Tidak ada perlengkapan untuk dihitung"), jadi tidak boleh menahan kunci periode itu dan periode sesudahnya.
  const perluOpname = saldoLkp.length > 0;
  // Draf (termasuk yang dikembalikan Owner untuk revisi) dan revisi yang menunggu Owner belum final.
  const opnameAda = !!opname && opname.status !== "DITOLAK";
  const opnameFinal = opname?.status === "DISETUJUI" && opname._count.revisi === 0;
  return [
    { label: "Semua pembelian periode ini sudah diposting", lulus: drafBeli === 0, catatan: drafBeli ? `${drafBeli} draf` : "" },
    { label: "Penyusutan sudah diproses sampai periode ini", lulus: susutBelum === 0, catatan: susutBelum ? `${susutBelum} baris jadwal belum dijurnal` : "" },
    {
      label: "Nilai sisa perlengkapan sudah diinput",
      lulus: opnameAda ? opnameFinal || opname?.status === "DIAJUKAN" : !perluOpname,
      catatan: opnameAda
        ? opname?.status === "DRAFT" ? "masih draf atau dikembalikan untuk revisi" : opname && opname._count.revisi > 0 ? "revisi menunggu Owner" : ""
        : perluOpname ? "belum ada opname" : "tidak ada saldo perlengkapan",
    },
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
  /** Tombol kunci (periode terbuka) atau buka kunci (periode terkunci) boleh ditampilkan menurut urutan periode. */
  urutanBoleh: boolean;
  /** Alasan tombol ditahan karena urutan periode, misalnya "Kunci Oktober 2026 dulu." */
  tahanUrutan: string | null;
  /** Periode terbuka yang tertutup karena periode sesudahnya sudah dikunci (data lama sebelum aturan berurutan). */
  tertutupOleh: string | null;
};

/**
 * Periode terbaru lebih dulu. Daftar periksa hanya dihitung untuk periode yang masih terbuka.
 * Periode terbuka paling lama selalu ikut ditampilkan walau lebih lama dari `maks` periode terakhir,
 * karena periode itulah yang harus dikunci berikutnya.
 */
export async function dataTutupPeriode(maks = 12): Promise<DataPeriode[]> {
  const [semua, statusSemua] = await Promise.all([
    semuaPeriode(),
    db.periode.findMany({ select: { id: true, status: true }, orderBy: { id: "asc" } }),
  ]);
  const terkunci = statusSemua.filter((p) => p.status === "TERKUNCI").map((p) => p.id);
  const terbukaPertama = statusSemua.find((p) => p.status === "TERBUKA" && p.id <= periodeIni())?.id;
  const ids = semua.reverse().slice(0, maks);
  if (terbukaPertama && !ids.includes(terbukaPertama)) ids.push(terbukaPertama);
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
      let tahanUrutan: string | null = null;
      let tertutupOleh: string | null = null;
      if (status === "TERBUKA") {
        const sebelum = statusSemua.find((x) => x.id < id && x.status === "TERBUKA");
        if (sebelum) tahanUrutan = `Kunci ${labelPeriode(sebelum.id)} dulu`;
        tertutupOleh = terkunci.find((x) => x > id) ?? null;
      } else {
        const sesudah = terkunci.filter((x) => x > id).at(-1);
        if (sesudah) tahanUrutan = `Buka kunci ${labelPeriode(sesudah)} dulu`;
      }
      return {
        id,
        status,
        dikunciOleh: p?.pengunci?.nama ?? null,
        dikunciPada: p?.dikunciPada?.toISOString() ?? null,
        riwayat: (p?.riwayat ?? []).map((r) => ({ aksi: r.aksi, oleh: r.oleh.nama, waktu: r.waktu.toISOString(), alasan: r.alasan })),
        periksa: status === "TERBUKA" ? await cekPeriode(id, buku) : null,
        urutanBoleh: tahanUrutan === null,
        tahanUrutan,
        tertutupOleh,
      };
    }),
  );
}
