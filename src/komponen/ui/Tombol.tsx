import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";

export type VarianTombol = "utama" | "gelap" | "garis" | "bahaya" | "hantu";

const kelasTombol = (varian: VarianTombol, kecil?: boolean, tambahan = "") =>
  `tombol tombol-${varian}${kecil ? " tombol-kecil" : ""} ${tambahan}`.trim();

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  varian?: VarianTombol;
  kecil?: boolean;
  /** Menampilkan putaran dan menonaktifkan tombol. */
  memuat?: boolean;
  ikon?: ReactNode;
};

/** Tombol standar. Bawaannya type="button" supaya tidak mengirim form tanpa sengaja. */
export default function Tombol({ varian = "garis", kecil, memuat, ikon, className, children, disabled, type = "button", ...sisa }: Props) {
  return (
    <button type={type} className={kelasTombol(varian, kecil, className)} disabled={disabled || memuat} aria-busy={memuat || undefined} {...sisa}>
      {memuat ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : ikon}
      {children}
    </button>
  );
}

/** Tautan yang tampil seperti tombol. */
export function TautanTombol({ href, varian = "garis", kecil, ikon, className, children }: { href: string; varian?: VarianTombol; kecil?: boolean; ikon?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={kelasTombol(varian, kecil, className)}>
      {ikon}
      {children}
    </Link>
  );
}
