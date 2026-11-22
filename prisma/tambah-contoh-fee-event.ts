/*
 * Menambahkan data contoh fee event ke database yang sudah berisi data contoh Oktober 2026
 * (misalnya server yang di-seed sebelum modul fee event ada). Data lain tidak diubah dan tidak ada jurnal baru.
 * Menolak jalan bila sudah ada event, karyawan KRY-06 sampai KRY-12, atau akun kapten.
 *
 * Jalankan: npx tsx prisma/tambah-contoh-fee-event.ts
 * Dengan SANDI_ACAK=1, akun kapten diberi kata sandi acak kuat yang dicetak sekali di akhir.
 */
import "dotenv/config";
import crypto from "node:crypto";
import { db } from "../src/lib/server/db";
import { PENGGUNA_KAPTEN, seedFeeEvent } from "./seed-fee-event";

async function main() {
  const kodeCrew = ["KRY-06", "KRY-07", "KRY-08", "KRY-09", "KRY-10", "KRY-11", "KRY-12"];
  const [event, karyawan, kapten] = await Promise.all([
    db.event.count(),
    db.karyawan.count({ where: { kode: { in: kodeCrew } } }),
    db.pengguna.count({ where: { namaPengguna: { in: PENGGUNA_KAPTEN.map((k) => k.namaPengguna) } } }),
  ]);
  if (event + karyawan + kapten > 0) {
    throw new Error(`Dibatalkan: sudah ada ${event} event, ${karyawan} karyawan KRY-06 s.d. KRY-12, dan ${kapten} akun kapten.`);
  }
  const hrd = await db.pengguna.findUnique({ where: { namaPengguna: "hrd" }, select: { id: true } });
  if (!hrd) throw new Error("Dibatalkan: akun hrd tidak ditemukan.");

  const sandiKapten: Record<string, string> = {};
  if (process.env.SANDI_ACAK === "1") {
    for (const k of PENGGUNA_KAPTEN) sandiKapten[k.namaPengguna] = crypto.randomBytes(15).toString("base64url");
  }
  // Satu transaksi: bila gagal di tengah, tidak ada data setengah jadi.
  await db.$transaction((tx) => seedFeeEvent(tx, { hrd: hrd.id }, sandiKapten), { timeout: 60_000 });
  for (const k of PENGGUNA_KAPTEN) console.log(`Akun kapten: ${k.namaPengguna} / ${sandiKapten[k.namaPengguna] ?? k.sandi}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
