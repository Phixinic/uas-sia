import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { penggunaSaatIni } from "@/lib/server/auth";
import { adaLogo } from "@/lib/server/logo";
import { profilUsaha } from "@/lib/data/umum";
import Logo from "@/komponen/kerangka/Logo";
import FormMasuk from "./FormMasuk";

export const metadata: Metadata = { title: "Masuk" };

/**
 * Petunjuk akun demo (sandi bawaan seed) hanya tampil bila TAMPILKAN_AKUN_DEMO=1, yaitu di lingkungan pengembangan
 * dan uji E2E. Di server sungguhan sandinya sudah diganti, jadi petunjuk itu menyesatkan dan bisa membuat akun
 * terkunci 10 menit sesudah 5 kali gagal.
 */
/** TAMPILKAN_AKUN_DEMO=1: akun data uji (prisma/seed.ts, E2E); =setahun: akun data contoh (prisma/seed-setahun.ts, nilai lama dipertahankan). */
const PETUNJUK_DEMO: Record<string, string> = {
  "1": "admin / admin123, hrd / hrd12345, owner / owner123",
  setahun: "admin / adminsia, hrd / hrdsia, owner / ownersia, kapten / kaptensia",
};
const petunjukAkunDemo = () => PETUNJUK_DEMO[process.env.TAMPILKAN_AKUN_DEMO ?? ""] ?? null;

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
        {petunjukAkunDemo() && <p className="text-center text-[12px] text-merek-lembut/80">Akun demo: {petunjukAkunDemo()}</p>}
      </div>
    </div>
  );
}
