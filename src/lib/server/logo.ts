import fs from "node:fs";
import path from "node:path";

/** true bila public/logo.svg sudah ada. Dicek sekali per proses. */
let cache: boolean | null = null;
export function adaLogo(): boolean {
  if (cache === null || process.env.NODE_ENV !== "production") cache = fs.existsSync(path.join(process.cwd(), "public", "logo.svg"));
  return cache;
}
