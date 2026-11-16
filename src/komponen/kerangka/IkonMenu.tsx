import {
  BookOpen, Boxes, Calculator, CalendarCheck, ClipboardList, Database, FileMinus, FileSpreadsheet, IdCard, LayoutDashboard,
  Library, Lock, PackageMinus, Scale, Send, ShoppingCart, TrendingDown, UserCog, Users,
} from "lucide-react";
import type { IkonMenu as Kunci } from "@/lib/menu";

const PETA = {
  dashboard: LayoutDashboard,
  "beli-alat": ShoppingCart,
  "beli-lengkap": Boxes,
  "nilai-sisa": ClipboardList,
  penyusutan: TrendingDown,
  "kartu-aset": IdCard,
  pelepasan: PackageMinus,
  presensi: CalendarCheck,
  "hitung-gaji": Calculator,
  distribusi: Send,
  "jurnal-penyesuaian": FileMinus,
  "jurnal-umum": BookOpen,
  "buku-besar": Library,
  "neraca-saldo": Scale,
  "tutup-periode": Lock,
  "master-konversi": Database,
  "master-sdm": Users,
  pengguna: UserCog,
  laporan: FileSpreadsheet,
} as const;

export default function IkonMenu({ nama, className = "size-4" }: { nama: Kunci; className?: string }) {
  const Ikon = PETA[nama];
  return <Ikon className={className} aria-hidden />;
}
