/*
 * Proxy (nama baru middleware di Next.js 16): pemeriksaan cepat di tepi. Permintaan tanpa cookie sesi
 * dialihkan ke /masuk tanpa menyentuh database. Keabsahan sesi dan peran tetap diperiksa di server
 * (layout, halaman, dan setiap server action lewat wajibPeran).
 */
import { NextResponse, type NextRequest } from "next/server";
import { NAMA_COOKIE_SESI, jalurPublik } from "@/lib/peran";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (jalurPublik(pathname)) return NextResponse.next();
  if (!request.cookies.has(NAMA_COOKIE_SESI)) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ galat: "Belum masuk" }, { status: 401 });
    const tujuan = new URL("/masuk", request.url);
    if (pathname !== "/") tujuan.searchParams.set("kembali", pathname + search);
    return NextResponse.redirect(tujuan);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|logo\\.svg|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)"],
};
