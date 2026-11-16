import type { Metadata } from "next";
import { Check, X } from "lucide-react";
import { wajibMasuk } from "@/lib/server/auth";
import { boleh } from "@/lib/peran";
import { dataTutupPeriode } from "@/lib/data/pelaporan/periode";
import { labelPeriode } from "@/lib/inti/tanggal";
import { labelWaktu } from "@/lib/format";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import Kartu from "@/komponen/ui/Kartu";
import { LencanaStatus } from "@/komponen/ui/Lencana";
import { TombolBukaKunci, TombolKunci } from "@/komponen/pelaporan/AksiPeriode";

export const metadata: Metadata = { title: "Tutup Periode" };

export default async function Halaman() {
  const pengguna = await wajibMasuk();
  const bolehKunci = boleh(pengguna.peran, "periode.kunci");
  const daftar = await dataTutupPeriode();

  return (
    <>
      <KepalaHalaman
        judul="Tutup Periode"
        keterangan="Periode yang dikunci menolak jurnal baru bertanggal di dalamnya. Owner mengunci setelah semua pemeriksaan lulus, dan bisa membuka lagi dengan alasan."
      />
      <div className="space-y-4">
        {daftar.map((p) => {
          const lulus = p.periksa?.every((x) => x.lulus) ?? false;
          return (
            <Kartu key={p.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <h2 className="judul-kartu">{labelPeriode(p.id)}</h2>
                  <LencanaStatus jenis="periode" status={p.status} />
                </div>
                {bolehKunci && (
                  <div className="flex items-center gap-2">
                    {p.status === "TERBUKA" ? (
                      lulus ? <TombolKunci periode={p.id} /> : <span className="text-xs text-slate-500">Lengkapi pemeriksaan dulu</span>
                    ) : (
                      <TombolBukaKunci periode={p.id} />
                    )}
                  </div>
                )}
              </div>
              {p.periksa ? (
                <ul className="grid gap-1.5 sm:grid-cols-2" aria-label={`Pemeriksaan ${labelPeriode(p.id)}`}>
                  {p.periksa.map((x) => (
                    <li key={x.label} className="flex items-start gap-2 text-sm">
                      <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${x.lulus ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {x.lulus ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
                      </span>
                      <span>
                        <span className="sr-only">{x.lulus ? "Lulus: " : "Belum: "}</span>
                        {x.label}
                        {x.catatan && <span className="text-slate-500"> ({x.catatan})</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Dikunci {p.dikunciOleh ?? "-"} pada {labelWaktu(p.dikunciPada)}.</p>
              )}
              {p.riwayat.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-[13px] font-semibold text-aksen">Riwayat ({p.riwayat.length})</summary>
                  <ul className="mt-2 space-y-1 text-slate-600">
                    {p.riwayat.map((r, i) => (
                      <li key={i}>
                        {labelWaktu(r.waktu)}: {r.aksi === "KUNCI" ? "dikunci" : "dibuka"} oleh {r.oleh}
                        {r.alasan && <span className="text-slate-500"> (alasan: {r.alasan})</span>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Kartu>
          );
        })}
      </div>
    </>
  );
}
