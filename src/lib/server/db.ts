/*
 * Satu PrismaClient untuk seluruh proses (adapter pg). Di mode dev disimpan di globalThis supaya
 * hot reload tidak membuka koneksi baru terus-menerus.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalUntukPrisma = globalThis as unknown as { prisma?: PrismaClient };

function buatKlien() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DB_POOL_MAX ?? 5) });
  return new PrismaClient({ adapter });
}

export const db = globalUntukPrisma.prisma ?? buatKlien();
if (process.env.NODE_ENV !== "production") globalUntukPrisma.prisma = db;

/** Klien di dalam db.$transaction(async (tx) => ...). */
export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
/** Fungsi yang bisa dipakai di dalam atau di luar transaksi. */
export type DbAtauTx = typeof db | Tx;
