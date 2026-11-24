/*
 * Lencana angka di sidebar: pekerjaan yang menunggu peran pengguna saat ini (seperti app lama).
 */
import { db } from "@/lib/server/db";
import type { Peran } from "@/lib/peran";

export async function hitunganMenu(peran: Peran, penggunaId: number): Promise<Record<string, number>> {
  if (peran === "OWNER") {
    const [jp, lepas, gaji, fee, setoran, setting, nominal] = await Promise.all([
      db.jurnal.count({ where: { jenis: "PENYESUAIAN", status: "DIAJUKAN" } }),
      db.pelepasan.count({ where: { status: "DIAJUKAN" } }),
      db.penggajian.count({ where: { status: "DIAJUKAN" } }),
      db.laporanFee.count({ where: { status: "DIAJUKAN" } }),
      db.investasiKas.count({ where: { status: "DIAJUKAN" } }),
      db.settingGaji.count({ where: { status: "DIAJUKAN" } }),
      db.versiNominal.count({ where: { status: "DIAJUKAN" } }),
    ]);
    return { "/pelaporan/jurnal-penyesuaian": jp, "/konversi/pelepasan": lepas, "/sdm/gaji-bulanan": gaji, "/fee-event/keputusan": fee, "/modal/investasi-kas": setoran, "/sdm/setting-gaji": setting, "/master/sdm": nominal };
  }
  if (peran === "KAPTEN") {
    // Event yang dipegang kapten ini dan masih dalam tahap penilaian.
    const n = await db.event.count({ where: { status: "PENILAIAN", penugasan: { some: { jabatan: { peranEvent: "KAPTEN" }, karyawan: { pengguna: { id: penggunaId } } } } } });
    return { "/kapten": n };
  }
  if (peran === "ADMIN") {
    const [jp, draf] = await Promise.all([
      db.jurnal.count({ where: { jenis: "PENYESUAIAN", status: "DRAFT" } }),
      db.pembelian.groupBy({ by: ["jenis"], where: { status: "DRAFT" }, _count: true }),
    ]);
    const n = (j: string) => draf.find((x) => x.jenis === j)?._count ?? 0;
    return { "/pelaporan/jurnal-penyesuaian": jp, "/konversi/pembelian-peralatan": n("PERALATAN"), "/konversi/pembelian-perlengkapan": n("PERLENGKAPAN") };
  }
  const [slipDraf, tanpaKapten] = await Promise.all([
    db.slipGaji.count({ where: { status: "DRAFT" } }),
    db.event.count({ where: { status: "PENILAIAN", penugasan: { none: { jabatan: { peranEvent: "KAPTEN" } } } } }),
  ]);
  return { "/sdm/gaji-bulanan": slipDraf, "/fee-event/event": tanpaKapten };
}
