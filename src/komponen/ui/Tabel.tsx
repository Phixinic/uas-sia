import type { ReactNode } from "react";

/**
 * Tabel standar di dalam pembungkus yang bisa digeser horizontal.
 * Isi thead/tbody/tfoot seperti biasa; kolom angka beri className="kolom-angka".
 */
export default function Tabel({ children, label, className = "" }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <div className="bungkus-tabel">
      <table className={`tabel ${className}`} aria-label={label}>
        {children}
      </table>
    </div>
  );
}

/** Baris pengganti saat tabel kosong. */
export function BarisKosong({ kolom, children }: { kolom: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={kolom} className="py-8 text-center text-sm text-slate-400">
        {children}
      </td>
    </tr>
  );
}
