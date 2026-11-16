/*
 * Lencana angka di sidebar: pekerjaan yang menunggu peran pengguna saat ini (seperti app lama).
 */
import { db } from "@/lib/server/db";
import type { Peran } from "@/lib/peran";

export async function hitunganMenu(peran: Peran): Promise<Record<string, number>> {
  if (peran === "OWNER") {
    const [jp, lepas, gaji] = await Promise.all([
      db.jurnal.count({ where: { jenis: "PENYESUAIAN", status: "DIAJUKAN" } }),
      db.pelepasan.count({ where: { status: "DIAJUKAN" } }),
      db.penggajian.count({ where: { status: "DIAJUKAN" } }),
    ]);
    return { "/pelaporan/jurnal-penyesuaian": jp, "/konversi/pelepasan": lepas, "/sdm/distribusi": gaji };
  }
  if (peran === "ADMIN") {
    const [jp, draf] = await Promise.all([
      db.jurnal.count({ where: { jenis: "PENYESUAIAN", status: "DRAFT" } }),
      db.pembelian.groupBy({ by: ["jenis"], where: { status: "DRAFT" }, _count: true }),
    ]);
    const n = (j: string) => draf.find((x) => x.jenis === j)?._count ?? 0;
    return { "/pelaporan/jurnal-penyesuaian": jp, "/konversi/pembelian-peralatan": n("PERALATAN"), "/konversi/pembelian-perlengkapan": n("PERLENGKAPAN") };
  }
  const slipDraf = await db.slipGaji.count({ where: { status: "DRAFT" } });
  return { "/sdm/distribusi": slipDraf };
}
