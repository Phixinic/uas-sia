"use client";

/*
 * Tabel proses hitung gaji. Ringkasan per karyawan tampil dulu; tombol Rincian membuka komponen gaji dan PPh 21
 * tanpa pindah halaman. Tombol hitung dan hapus hanya muncul untuk HRD (server action tetap memeriksa peran).
 */
import { Fragment, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Calculator, Eye, MoreHorizontal, Trash2 } from "lucide-react";
import { hapusSlip, hitungSlipSatu } from "@/lib/aksi/sdm/gaji";
import TombolAksi from "@/komponen/ui/TombolAksi";
import DialogKonfirmasi from "@/komponen/ui/DialogKonfirmasi";
import { useAksi } from "@/komponen/ui/useAksi";
import { TautanTombol } from "@/komponen/ui/Tombol";
import Tombol from "@/komponen/ui/Tombol";
import Rupiah from "@/komponen/ui/Rupiah";
import Tabel from "@/komponen/ui/Tabel";
import { RincianSlip } from "./RincianSlip";
import { StatusSlipKaryawan } from "./StatusGaji";
import type { BarisGaji } from "@/lib/data/sdm/gaji";
import { denganPeriode, labelPeriode } from "@/lib/inti/tanggal";

/**
 * Versi setting gaji yang dipakai baris ini, versi lebih baru yang belum berlaku, dan status angka slip:
 * slip yang sudah diajukan atau dibayar angkanya terkunci; slip draf dengan versi lain ditandai perlu dihitung ulang.
 */
function KeteranganVersi({ b }: { b: BarisGaji }) {
  const v = b.versi;
  return (
    <div className="mt-0.5 space-y-0.5 text-[11px] leading-snug">
      <div className="text-slate-500">
        Setting {v.kode ?? "lama (sebelum riwayat)"}: {v.jabatan}, {v.golongan}
        {v.berlakuMulai ? `, berlaku mulai ${labelPeriode(v.berlakuMulai)}` : ""}
      </div>
      {b.catatanVersi && <div className="text-teal-800">{b.catatanVersi}</div>}
      {b.slipStatus === "DISETUJUI" && <div className="text-slate-600">Angka slip terkunci saat dibayar</div>}
      {b.slipStatus === "DIAJUKAN" && <div className="text-slate-600">Angka slip terkunci saat diajukan</div>}
      {b.settingBerubah && <div className="font-medium text-amber-700">Perlu dihitung ulang: slip dihitung dengan versi setting lain</div>}
      {b.nominalBerubah && <div className="font-medium text-amber-700">Perlu dihitung ulang: nominal komponen (gaji pokok atau tunjangan) yang dipakai slip sudah tidak berlaku di {labelPeriode(b.tampil.periode)}</div>}
      {b.nominalKurang.length > 0 && <div className="font-medium text-rose-700">Belum bisa dihitung: {b.nominalKurang.join(", ")} belum punya nominal berlaku</div>}
    </div>
  );
}

/*
 * Aksi per karyawan: satu tombol utama sesuai keadaan slip, sisanya di menu titik tiga.
 * Menu memakai posisi tetap supaya tidak terpotong pembungkus tabel yang bisa digeser.
 */
function AksiGaji({ b, periode, alamat, bolehHitung, buka, balik, kelas }: { b: BarisGaji; periode: string; alamat: string; bolehHitung: boolean; buka: boolean; balik: () => void; kelas: string }) {
  const { jalankan, memuat } = useAksi();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [hapus, setHapus] = useState(false);
  const pemicu = useRef<HTMLButtonElement>(null);
  const bisaHitung = bolehHitung && b.jumlahPresensi > 0 && (!b.slipStatus || b.slipStatus === "DRAFT");
  const bisaHapus = bolehHitung && !!b.slipNo && b.slipStatus === "DRAFT";
  const href = b.slipNo ? `${denganPeriode(alamat, periode)}&slip=${b.slipNo}` : "";

  useEffect(() => {
    if (!menu) return;
    const tutup = (e: Event) => {
      if (e.type === "keydown" && (e as KeyboardEvent).key !== "Escape") return;
      setMenu(null);
      if (e.type === "keydown") pemicu.current?.focus();
    };
    const klik = (e: MouseEvent) => {
      const t = e.target as Node;
      if (pemicu.current?.contains(t) || document.getElementById(`menu-gaji-${b.karyawanKode}`)?.contains(t)) return;
      setMenu(null);
    };
    document.addEventListener("mousedown", klik);
    document.addEventListener("keydown", tutup);
    window.addEventListener("scroll", tutup, true);
    window.addEventListener("resize", tutup);
    return () => {
      document.removeEventListener("mousedown", klik);
      document.removeEventListener("keydown", tutup);
      window.removeEventListener("scroll", tutup, true);
      window.removeEventListener("resize", tutup);
    };
  }, [menu, b.karyawanKode]);

  const bukaMenu = () => {
    if (menu) return setMenu(null);
    const r = pemicu.current?.getBoundingClientRect();
    if (r) setMenu({ x: Math.max(8, r.right - 176), y: r.bottom + 4 });
  };
  const item = "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50";

  return (
    <div className={`flex items-center gap-1.5 ${kelas}`}>
      {bisaHitung ? (
        <TombolAksi aksi={() => hitungSlipSatu({ periode, karyawanKode: b.karyawanKode })} ikon={<Calculator className="size-4" />} judul={b.slipNo ? "Hitung ulang slip" : "Simpan slip"}>
          {b.perluHitungUlang ? "Hitung ulang" : b.slipNo ? "Hitung" : "Simpan"}
        </TombolAksi>
      ) : b.slipNo ? (
        <TautanTombol href={href} kecil ikon={<Eye className="size-4" />}>Slip</TautanTombol>
      ) : (
        <Tombol kecil onClick={balik} aria-expanded={buka} ikon={buka ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}>Rincian</Tombol>
      )}
      <button
        ref={pemicu}
        type="button"
        className="tombol tombol-hantu tombol-kecil"
        aria-label={`Menu aksi ${b.nama}`}
        aria-haspopup="menu"
        aria-expanded={!!menu}
        onClick={bukaMenu}
      >
        <MoreHorizontal className="size-4" />
      </button>
      {menu && (
        <div
          id={`menu-gaji-${b.karyawanKode}`}
          role="menu"
          className="fixed z-50 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left"
          style={{ left: menu.x, top: menu.y, boxShadow: "var(--shadow-melayang)" }}
        >
          <button type="button" role="menuitem" className={item} onClick={() => { setMenu(null); balik(); }}>
            {buka ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            {buka ? "Tutup rincian" : "Rincian"}
          </button>
          {bisaHitung && b.slipNo && (
            <a role="menuitem" className={item} href={href} onClick={() => setMenu(null)}><Eye className="size-4" />Slip</a>
          )}
          {bisaHapus && (
            <button type="button" role="menuitem" className={`${item} text-rose-700`} onClick={() => { setMenu(null); setHapus(true); }}>
              <Trash2 className="size-4" />Hapus slip
            </button>
          )}
        </div>
      )}
      {bisaHapus && (
        <DialogKonfirmasi
          terbuka={hapus}
          judul={`Hapus slip ${b.nama}?`}
          pesan="Slip draf dihapus. Kamu bisa menghitungnya lagi kapan saja."
          labelKonfirmasi="Hapus"
          bahaya
          memuat={memuat}
          saatTutup={() => setHapus(false)}
          saatKonfirmasi={async () => {
            const h = await jalankan(() => hapusSlip({ no: b.slipNo! }));
            if (h.ok) setHapus(false);
          }}
        />
      )}
    </div>
  );
}

export default function TabelGaji({ baris, periode, bolehHitung, alamat }: { baris: BarisGaji[]; periode: string; bolehHitung: boolean; alamat: string }) {
  const [terbuka, setTerbuka] = useState<Set<string>>(new Set());
  const balik = (k: string) =>
    setTerbuka((s) => {
      const b = new Set(s);
      if (!b.delete(k)) b.add(k);
      return b;
    });
  const jumlah = (f: (b: BarisGaji) => number) => baris.reduce((s, b) => s + f(b), 0);

  const aksi = (b: BarisGaji, kelas: string) => (
    <AksiGaji b={b} periode={periode} alamat={alamat} bolehHitung={bolehHitung} buka={terbuka.has(b.karyawanKode)} balik={() => balik(b.karyawanKode)} kelas={kelas} />
  );

  return (
    <>
    <div className="divide-y divide-slate-100 md:hidden" aria-label="Hitung gaji per karyawan (ringkas)">
      {baris.map((b) => {
        const s = b.tampil;
        const buka = terbuka.has(b.karyawanKode);
        const taksiran = b.slipStatus ? "" : " (estimasi)";
        return (
          <article key={b.karyawanKode} className="space-y-2 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-slate-900">{b.nama}</div>
                <div className="text-[11px] text-slate-500">
                  {b.jabatan} · hadir {s.hadir}/{s.hariKerja}
                  {s.alpa > 0 && `, ${s.alpa} alpa`}
                </div>
                <KeteranganVersi b={b} />
              </div>
              <div className="shrink-0 text-right">
                <StatusSlipKaryawan slipStatus={b.slipStatus} jumlahPresensi={b.jumlahPresensi} periode={periode} karyawanKode={b.karyawanKode} />
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-xs">
              <div><dt className="text-slate-500">Bruto{taksiran}</dt><dd className="kolom-angka font-medium"><Rupiah nilai={s.bruto} polos /></dd></div>
              <div><dt className="text-slate-500">PPh 21{taksiran}</dt><dd className="kolom-angka font-medium"><Rupiah nilai={s.pph21} polos /></dd></div>
              <div><dt className="text-slate-500">THP{taksiran}</dt><dd className="kolom-angka font-semibold text-slate-900"><Rupiah nilai={s.thp} polos /></dd></div>
            </dl>
            {b.perluHitungUlang && <div className="text-[11px] text-amber-700">{b.settingBerubah ? "Setting gaji berubah, hitung ulang" : b.nominalBerubah ? "Nominal komponen berubah, hitung ulang" : "Data berubah, hitung ulang"}</div>}
            {b.slipStatus === "DRAFT" && b.alasanTolak && <div className="text-[11px] text-rose-700">Ditolak: {b.alasanTolak}</div>}
            {aksi(b, "")}
            {buka && <div className="rounded-lg bg-slate-50 p-3"><RincianSlip s={s} /></div>}
          </article>
        );
      })}
      <div className="flex items-center justify-between bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
        <span>Total THP ({baris.length} karyawan)</span>
        <span className="tabular-nums"><Rupiah nilai={jumlah((b) => b.tampil.thp)} polos /></span>
      </div>
    </div>
    <div className="hidden md:block">
    <Tabel label="Hitung gaji per karyawan">
      <thead>
        <tr>
          <th className="min-w-40">Karyawan</th>
          <th className="kolom-angka">Hadir</th>
          <th className="kolom-angka">Gaji pokok</th>
          <th className="kolom-angka">Tunjangan</th>
          <th className="kolom-angka">Pot. absen</th>
          <th className="kolom-angka">Bruto</th>
          <th className="kolom-angka">PPh 21</th>
          <th className="kolom-angka">THP</th>
          <th>Status</th>
          <th className="w-px whitespace-nowrap text-right">Aksi</th>
        </tr>
      </thead>
      <tbody>
        {baris.map((b) => {
          const s = b.tampil;
          const buka = terbuka.has(b.karyawanKode);
          return (
            <Fragment key={b.karyawanKode}>
              <tr>
                <td>
                  <div className="font-medium text-slate-900">{b.nama}</div>
                  <div className="max-w-64"><KeteranganVersi b={b} /></div>
                </td>
                <td className="kolom-angka">
                  {s.hadir}/{s.hariKerja}
                  {s.alpa > 0 && <div className="mt-0.5 text-[12px] font-medium text-rose-700">{s.alpa} alpa</div>}
                </td>
                <td className="kolom-angka"><Rupiah nilai={s.gajiPokok} polos /></td>
                <td className="kolom-angka"><Rupiah nilai={s.tunjJabatan + s.tunjKeluarga + s.tunjLain.reduce((x, t) => x + t.nominal, 0)} polos /></td>
                <td className="kolom-angka">{s.potonganAbsen ? <>−<Rupiah nilai={s.potonganAbsen} polos /></> : "-"}</td>
                <td className="kolom-angka"><Rupiah nilai={s.bruto} polos />{!b.slipStatus && <div className="text-[11px] font-normal text-slate-500">estimasi</div>}</td>
                <td className="kolom-angka"><Rupiah nilai={s.pph21} polos />{!b.slipStatus && <div className="text-[11px] font-normal text-slate-500">estimasi</div>}</td>
                <td className="kolom-angka font-semibold text-slate-900"><Rupiah nilai={s.thp} polos />{!b.slipStatus && <div className="text-[11px] font-normal text-slate-500">estimasi</div>}</td>
                <td>
                  <StatusSlipKaryawan slipStatus={b.slipStatus} jumlahPresensi={b.jumlahPresensi} periode={periode} karyawanKode={b.karyawanKode} />
                  {b.perluHitungUlang && <div className="mt-0.5 text-[11px] text-amber-700">{b.settingBerubah ? "Setting gaji berubah, hitung ulang" : b.nominalBerubah ? "Nominal komponen berubah, hitung ulang" : "Data berubah, hitung ulang"}</div>}
                  {b.slipStatus === "DRAFT" && b.alasanTolak && <div className="mt-0.5 max-w-44 text-[11px] text-rose-700">Ditolak: {b.alasanTolak}</div>}
                </td>
                <td>
                  {aksi(b, "justify-end")}
                </td>
              </tr>
              {buka && (
                <tr className="bg-slate-50/60">
                  <td colSpan={10} className="py-4!">
                    <RincianSlip s={s} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={5}>Total ({baris.length} karyawan)</td>
          <td className="kolom-angka"><Rupiah nilai={jumlah((b) => b.tampil.bruto)} polos /></td>
          <td className="kolom-angka"><Rupiah nilai={jumlah((b) => b.tampil.pph21)} polos /></td>
          <td className="kolom-angka"><Rupiah nilai={jumlah((b) => b.tampil.thp)} polos /></td>
          <td colSpan={2} />
        </tr>
      </tfoot>
    </Tabel>
    </div>
    </>
  );
}
