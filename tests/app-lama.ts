/*
 * Memuat data contoh dan fungsi inti app lama (versi-statis) ke dalam sandbox vm,
 * supaya tes bisa membandingkan hasil port TypeScript dengan perilaku aslinya.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const AKAR = path.resolve(__dirname, "../versi-statis");

type Dok = Record<string, unknown> & { id: string };
export type SeedLama = Record<string, Record<string, Record<string, unknown>>>;

export function muatSeedLama(): SeedLama {
  const ctx = vm.createContext({ window: {} as { SEED?: SeedLama } });
  vm.runInContext(fs.readFileSync(path.join(AKAR, "data/seed.js"), "utf8"), ctx);
  return (ctx.window as { SEED: SeedLama }).SEED;
}

/** Daftar dokumen satu koleksi, masing-masing diberi `id` dari kunci dokumennya (seperti app lama). */
export const koleksi = <T = Dok>(seed: SeedLama, nama: string): (T & { id: string })[] =>
  Object.entries(seed[nama] ?? {}).map(([id, d]) => ({ id, ...(d as object) }) as T & { id: string });

/** Sandbox berisi core app lama dengan S.data terisi data contoh. Panggil fungsi lama lewat `jalankan("ekspresi")`. */
export function muatAppLama() {
  const seed = muatSeedLama();
  const ctx = vm.createContext({ window: { SEED: seed }, localStorage: { getItem: () => null, setItem: () => {} }, console });
  for (const f of ["core/config.js", "core/utils.js", "core/state.js", "core/penyusutan.js", "core/ledger.js", "core/penggajian.js"]) {
    vm.runInContext(fs.readFileSync(path.join(AKAR, "assets/js", f), "utf8"), ctx, { filename: f });
  }
  ctx.__seed = seed;
  vm.runInContext("COLS.forEach(c=>{S.data[c]=Object.entries(__seed[c]||{}).map(([id,d])=>Object.assign({id},d))})", ctx);
  const jalankan = <T = unknown>(kode: string): T => vm.runInContext(kode, ctx) as T;
  return { seed, jalankan };
}
