import {
  BookOpen, Boxes, Calculator, CalendarCheck, CalendarRange, ClipboardCheck, ClipboardList, Database, FileMinus, FileSpreadsheet, HandCoins, IdCard,
  LayoutDashboard, Library, Lock, BadgeDollarSign, PackageMinus, Scale, Send, ShoppingCart, TrendingDown, UserCog, Users, Wallet,
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
  "setting-gaji": BadgeDollarSign,
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
  event: CalendarRange,
  "fee-event": HandCoins,
  penilaian: ClipboardCheck,
  "investasi-kas": Wallet,
} as const;

export default function IkonMenu({ nama, className = "size-4" }: { nama: Kunci; className?: string }) {
  const Ikon = PETA[nama];
  return <Ikon className={className} aria-hidden />;
}
