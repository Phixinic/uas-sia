/*
 * Tujuan pengalihan sesudah login. Hanya jalur internal yang diterima, supaya parameter ?kembali= tidak bisa dipakai
 * mengalihkan pengguna ke situs lain (termasuk trik "//host", "/\host", dan "/%5Chost").
 */
export function tujuanAman(kembali: string | null | undefined): string {
  if (!kembali || !kembali.startsWith("/")) return "/";
  let mentah = kembali;
  try {
    mentah = decodeURIComponent(kembali);
  } catch {
    return "/";
  }
  if (kembali.includes("\\") || mentah.includes("\\") || mentah.startsWith("//") || /[\u0000-\u001f]/.test(mentah)) return "/";
  let u: URL;
  try {
    u = new URL(kembali, "http://lokal.invalid");
  } catch {
    return "/";
  }
  if (u.origin !== "http://lokal.invalid" || !u.pathname.startsWith("/") || u.pathname.startsWith("//") || u.pathname.includes("\\")) return "/";
  return u.pathname + u.search + u.hash;
}
