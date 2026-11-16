import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { penggunaSaatIni } from "@/lib/server/auth";
import { adaLogo } from "@/lib/server/logo";
import { profilUsaha } from "@/lib/data/umum";
import Logo from "@/komponen/kerangka/Logo";
import FormMasuk from "./FormMasuk";

export const metadata: Metadata = { title: "Masuk" };

export default async function HalamanMasuk({ searchParams }: { searchParams: Promise<{ kembali?: string }> }) {
  if (await penggunaSaatIni()) redirect("/");
  const { kembali } = await searchParams;
  const profil = await profilUsaha();
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-merek via-merek-terang to-aksen-gelap p-4">
      <div className="animasi-muncul w-full max-w-sm space-y-5">
        <div className="flex justify-center">
          <Logo adaLogo={adaLogo()} nama={profil.nama} keterangan={profil.keterangan} gelap />
        </div>
        <div className="kartu space-y-4 p-6">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Masuk</h1>
            <p className="teks-redup">Pakai akun yang diberikan Owner.</p>
          </div>
          <FormMasuk kembali={kembali ?? "/"} />
        </div>
        <p className="text-center text-[12px] text-merek-lembut/80">Akun demo: admin / admin123, hrd / hrd12345, owner / owner123</p>
      </div>
    </div>
  );
}
