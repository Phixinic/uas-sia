import { redirect } from "next/navigation";
import Kerangka from "@/komponen/kerangka/Kerangka";
import { PenyediaToast } from "@/komponen/ui/Toast";
import { penggunaSaatIni } from "@/lib/server/auth";
import { adaLogo } from "@/lib/server/logo";
import { hitunganMenu } from "@/lib/server/menu";
import { profilUsaha } from "@/lib/data/umum";

/*
 * Semua halaman aplikasi butuh sesi sah. Layout tidak dirender ulang di setiap navigasi klien,
 * jadi tiap halaman TETAP memanggil wajibMasuk()/wajibPeranHalaman() sendiri.
 */
export default async function TataLetakAplikasi({ children }: { children: React.ReactNode }) {
  const pengguna = await penggunaSaatIni();
  if (!pengguna) redirect("/masuk");
  const [profil, hitungan] = await Promise.all([profilUsaha(), hitunganMenu(pengguna.peran, pengguna.id)]);
  return (
    <PenyediaToast>
      <Kerangka pengguna={pengguna} namaUsaha={profil.nama} keteranganUsaha={profil.keterangan} adaLogo={adaLogo()} hitungan={hitungan}>
        {children}
      </Kerangka>
    </PenyediaToast>
  );
}
