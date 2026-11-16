import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

const IKON = { info: Info, awas: TriangleAlert, galat: CircleAlert, sukses: CircleCheck };

/** Kotak pesan di dalam halaman (bukan toast). */
export default function Peringatan({ jenis = "info", children }: { jenis?: keyof typeof IKON; children: ReactNode }) {
  const Ikon = IKON[jenis];
  return (
    <div className={`peringatan peringatan-${jenis}`} role={jenis === "galat" ? "alert" : undefined}>
      <Ikon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
