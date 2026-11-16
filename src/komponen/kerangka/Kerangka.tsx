"use client";

/*
 * Kerangka aplikasi: sidebar navy (grup per siklus bisa dilipat, seluruh sidebar bisa diciutkan jadi ikon di desktop,
 * laci di layar kecil) dan topbar berisi nama pengguna, peran, dan tombol keluar.
 * Pilihan lipat disimpan di localStorage.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Logo from "@/komponen/kerangka/Logo";
import IkonMenu from "@/komponen/kerangka/IkonMenu";
import { MENU, aktifDi } from "@/lib/menu";
import { LABEL_PERAN, type Peran } from "@/lib/peran";
import { keluar } from "@/lib/aksi/auth";

type Props = {
  pengguna: { nama: string; namaPengguna: string; peran: Peran };
  namaUsaha: string;
  keteranganUsaha: string;
  adaLogo: boolean;
  /** Jumlah pekerjaan tertunda per href menu (lencana angka). */
  hitungan: Record<string, number>;
  children: ReactNode;
};

const KUNCI_GRUP = "sia.menu.grup";
const KUNCI_MINI = "sia.menu.mini";

function bacaLokal<T>(kunci: string, bawaan: T): T {
  try {
    const s = localStorage.getItem(kunci);
    return s ? (JSON.parse(s) as T) : bawaan;
  } catch {
    return bawaan;
  }
}
function simpanLokal(kunci: string, nilai: unknown) {
  try {
    localStorage.setItem(kunci, JSON.stringify(nilai));
  } catch {}
}

export default function Kerangka({ pengguna, namaUsaha, keteranganUsaha, adaLogo, hitungan, children }: Props) {
  const pathname = usePathname();
  const [laci, setLaci] = useState(false);
  const [mini, setMini] = useState(false);
  const [grupTerbuka, setGrupTerbuka] = useState<Record<string, boolean>>({});

  // Pilihan tersimpan baru dibaca sesudah hidrasi supaya HTML server dan klien sama.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setMini(bacaLokal(KUNCI_MINI, false));
    setGrupTerbuka(bacaLokal(KUNCI_GRUP, {}));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const menu = MENU.map((g) => ({ ...g, tautan: g.tautan.filter((t) => !t.peran || t.peran.includes(pengguna.peran)) })).filter((g) => g.tautan.length);

  const grupAktif = (kunci: string) => menu.find((g) => g.kunci === kunci)?.tautan.some((t) => aktifDi(t.href, pathname)) ?? false;
  const terbuka = (kunci: string) => grupTerbuka[kunci] ?? (grupAktif(kunci) || kunci === "ringkasan");
  const balikGrup = (kunci: string) => {
    const baru = { ...grupTerbuka, [kunci]: !terbuka(kunci) };
    setGrupTerbuka(baru);
    simpanLokal(KUNCI_GRUP, baru);
  };
  const balikMini = () => {
    setMini(!mini);
    simpanLokal(KUNCI_MINI, !mini);
  };

  const isiSidebar = (ciut: boolean) => (
    <nav aria-label="Menu utama" className="flex-1 space-y-1 overflow-y-auto px-2.5 py-3">
      {menu.map((g) => {
        const buka = ciut || terbuka(g.kunci);
        const tertunda = g.tautan.reduce((s, t) => s + (hitungan[t.href] ?? 0), 0);
        return (
          <div key={g.kunci}>
            {!ciut && g.kunci !== "ringkasan" && (
              <button
                type="button"
                onClick={() => balikGrup(g.kunci)}
                aria-expanded={buka}
                aria-controls={`grup-${g.kunci}`}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] font-semibold tracking-wider text-merek-lembut/70 uppercase hover:text-white"
              >
                <span className="flex-1 text-left">{g.judul}</span>
                {!buka && tertunda > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-merek">{tertunda}</span>}
                <ChevronDown className={`size-3.5 transition-transform ${buka ? "" : "-rotate-90"}`} aria-hidden />
              </button>
            )}
            <div id={`grup-${g.kunci}`} hidden={!buka} className="space-y-0.5">
              {g.tautan.map((t) => {
                const aktif = aktifDi(t.href, pathname);
                const n = hitungan[t.href] ?? 0;
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    title={ciut ? t.label : undefined}
                    aria-current={aktif ? "page" : undefined}
                    onClick={() => setLaci(false)}
                    className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${ciut ? "justify-center" : ""} ${
                      aktif ? "bg-aksen font-semibold text-white" : "text-merek-lembut hover:bg-merek-terang hover:text-white"
                    }`}
                  >
                    <IkonMenu nama={t.ikon} className="size-4 shrink-0" />
                    {!ciut && <span className="flex-1 truncate">{t.label}</span>}
                    {n > 0 && (
                      <span className={`rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-merek ${ciut ? "absolute top-0.5 right-0.5" : ""}`} aria-label={`${n} tertunda`}>
                        {n}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen">
      <a href="#isi" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Lompat ke isi
      </a>

      {/* Sidebar desktop */}
      <aside className={`fixed inset-y-0 left-0 z-30 hidden flex-col bg-merek transition-[width] lg:flex ${mini ? "w-[68px]" : "w-64"}`}>
        <div className={`flex h-16 items-center border-b border-white/10 ${mini ? "justify-center px-2" : "px-4"}`}>
          {mini ? <Logo adaLogo={adaLogo} nama="" gelap /> : <Logo adaLogo={adaLogo} nama={namaUsaha} keterangan={keteranganUsaha} gelap />}
        </div>
        {isiSidebar(mini)}
        <button
          type="button"
          onClick={balikMini}
          className="m-2.5 flex items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-[12px] text-merek-lembut hover:bg-merek-terang hover:text-white"
          aria-label={mini ? "Lebarkan menu" : "Ciutkan menu"}
        >
          {mini ? <PanelLeftOpen className="size-4" /> : <><PanelLeftClose className="size-4" /> Ciutkan menu</>}
        </button>
      </aside>

      {/* Laci mobile */}
      {laci && <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setLaci(false)} aria-hidden />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-merek transition-transform lg:hidden ${laci ? "translate-x-0" : "-translate-x-full"}`} aria-hidden={!laci}>
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          <Logo adaLogo={adaLogo} nama={namaUsaha} keterangan={keteranganUsaha} gelap />
          <button type="button" onClick={() => setLaci(false)} className="rounded p-1 text-merek-lembut hover:text-white" aria-label="Tutup menu">
            <X className="size-5" />
          </button>
        </div>
        {isiSidebar(false)}
      </aside>

      <div className={`flex min-h-screen flex-col transition-[padding] ${mini ? "lg:pl-[68px]" : "lg:pl-64"}`}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-6">
          <button type="button" onClick={() => setLaci(true)} className="tombol tombol-hantu tombol-kecil lg:hidden" aria-label="Buka menu">
            <Menu className="size-5" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-[13px] font-semibold text-slate-900">{pengguna.nama}</div>
              <div className="text-[11px] text-slate-500">@{pengguna.namaPengguna}</div>
            </div>
            <span className="lencana lencana-teal" title="Peran">{LABEL_PERAN[pengguna.peran]}</span>
            <form action={keluar}>
              <button type="submit" className="tombol tombol-garis tombol-kecil" title="Keluar">
                <LogOut className="size-4" aria-hidden />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </form>
          </div>
        </header>
        <main id="isi" className="animasi-muncul mx-auto w-full max-w-7xl min-w-0 flex-1 space-y-5 px-4 py-6 md:px-6">
          {children}
        </main>
        <footer className="px-6 pb-5 text-center text-[11px] text-slate-400">SIA {namaUsaha} · Tugas UAS Sistem Informasi Akuntansi, Universitas Ma Chung</footer>
      </div>
    </div>
  );
}
