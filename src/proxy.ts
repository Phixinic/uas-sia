/*
 * Proxy (nama baru middleware di Next.js 16): pemeriksaan cepat di tepi. Permintaan tanpa cookie sesi
 * dialihkan ke /masuk tanpa menyentuh database. Tautan lama berparameter ?periode= dialihkan ke ?bulan=&tahun=. Keabsahan sesi dan peran tetap diperiksa di server
 * (layout, halaman, dan setiap server action lewat wajibPeran).
 */
import { NextResponse, type NextRequest } from "next/server";
import { NAMA_COOKIE_SESI, jalurPublik } from "@/lib/peran";
import { cariTanpaPeriodeLama } from "@/lib/inti/tanggal";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // Tautan lama ?periode=2026-11 (atau ?periode=semua) dialihkan ke ?bulan=11&tahun=2026, parameter lain dipertahankan.
  if ((request.method === "GET" || request.method === "HEAD") && !pathname.startsWith("/api/")) {
    const baru = cariTanpaPeriodeLama(search);
    if (baru !== null) {
      const tujuan = request.nextUrl.clone();
      tujuan.search = baru;
      return NextResponse.redirect(tujuan, 307);
    }
  }
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
