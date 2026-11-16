/*
 * Hash kata sandi dengan scrypt bawaan Node (tanpa pustaka luar), garam acak 16 byte per pengguna.
 * Format tersimpan: scrypt$<garam base64url>$<hash base64url>.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (sandi: string, garam: Buffer, panjang: number) => Promise<Buffer>;

export const PANJANG_SANDI_MINIMUM = 8;

export async function hashKataSandi(sandi: string): Promise<string> {
  const garam = randomBytes(16);
  const hash = await scrypt(sandi, garam, 64);
  return `scrypt$${garam.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function cocokKataSandi(sandi: string, tersimpan: string): Promise<boolean> {
  const [algo, garam, hash] = tersimpan.split("$");
  if (algo !== "scrypt" || !garam || !hash) return false;
  const hitung = await scrypt(sandi, Buffer.from(garam, "base64url"), 64);
  const target = Buffer.from(hash, "base64url");
  return hitung.length === target.length && timingSafeEqual(hitung, target);
}

/** Hash tiruan untuk menyamakan waktu respons saat nama pengguna tidak ada. */
export const HASH_TIRUAN = "scrypt$AAAAAAAAAAAAAAAAAAAAAA$" + "A".repeat(86);
