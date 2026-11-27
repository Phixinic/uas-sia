/*
 * Periksa ulang database data contoh tanpa mengubah apa pun: neraca saldo tiap bulan, saldo kas tidak negatif, penghitung
 * nomor cocok, dan ringkasan per tahun. Berguna sesudah hal yang terbuka dicoba lewat UI.
 *   DATABASE_URL=... npx tsx prisma/periksa-data-contoh.ts
 */
import "dotenv/config";
import { db } from "../src/lib/server/db";
import { periksaAkhir, ringkasanPerTahun, wajibLolos } from "./seed-setahun";
import { rupiah } from "../src/lib/format";

async function main() {
  await db.$transaction(async (tx) => {
    const h = await periksaAkhir(tx);
    const tidak = h.seimbang.filter((s) => !s.seimbang);
    console.log(`Neraca saldo: ${h.seimbang.length - 1} bulan dan semua periode, ${tidak.length ? `${tidak.length} TIDAK SEIMBANG` : "semuanya seimbang"}.`);
    console.log(`Saldo kas terendah: ${rupiah(h.kasTerendah.saldo)} sesudah ${h.kasTerendah.no} (${h.kasTerendah.tanggal}).`);
    console.log(`Penghitung nomor: ${h.penghitung.filter((p) => p.nilai !== p.data).length} tidak cocok dari ${h.penghitung.length}.`);
    for (const t of await ringkasanPerTahun(tx)) console.log(`  ${t.tahun}: ${t.jurnal} jurnal, ${t.slip} slip, ${t.event} event, ${t.asetBeli} aset, ${t.asetLepas} dilepas, kas ${rupiah(t.kas)}`);
    wajibLolos(h);
  }, { timeout: 120_000 });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
