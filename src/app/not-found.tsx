import Link from "next/link";

export default function TidakDitemukan() {
  return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div className="space-y-2">
        <p className="text-5xl font-bold text-slate-300">404</p>
        <h1 className="text-lg font-semibold">Halaman tidak ditemukan</h1>
        <Link href="/" className="tombol tombol-utama">Ke dashboard</Link>
      </div>
    </div>
  );
}
