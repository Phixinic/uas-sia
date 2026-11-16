"use client";

/*
 * Form draf pembelian (baru atau ubah). Pratinjau total, jadwal penyusutan per baris, dan jurnal yang akan dibuat
 * dihitung langsung di browser memakai src/lib/inti (fungsi yang sama dengan server), jadi angkanya pasti sama.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Send, Trash2 } from "lucide-react";
import { simpanPembelian } from "@/lib/aksi/konversi/pembelian";
import { useAksi } from "@/komponen/ui/useAksi";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import Tombol, { TautanTombol } from "@/komponen/ui/Tombol";
import { Bidang, Isian, IsianRupiah, Pilihan } from "@/komponen/ui/Isian";
import Peringatan from "@/komponen/ui/Peringatan";
import DialogKonfirmasi from "@/komponen/ui/DialogKonfirmasi";
import TabelJurnal from "@/komponen/ui/TabelJurnal";
import { barisKosong, type Baris, type NilaiAwalForm } from "./nilai-awal";
import { TambahBarangCepat, TambahSupplierCepat, type KategoriForm } from "./TambahCepat";
import { AKUN } from "@/lib/inti/akun";
import { barisPembelian } from "@/lib/inti/jurnal";
import { hitungJadwal, nDariDasar, type DasarN } from "@/lib/inti/penyusutan";
import { periodeDari, labelPeriode } from "@/lib/inti/tanggal";
import { rupiah, LABEL_CARA_BAYAR } from "@/lib/format";
import type { BarangForm } from "@/lib/data/konversi/pembelian";
import type { CaraBayar, JenisPembelian } from "@/generated/prisma/enums";



const int = (v: string) => {
  const n = parseInt(String(v).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

export default function FormPembelian({ jenis, awal, supplier: supplierAwal, barang: barangAwal, kategori, bolehTambahCepat, namaAkun, periodeTerkunci, alamatKembali }: {
  jenis: JenisPembelian;
  awal: NilaiAwalForm;
  supplier: { kode: string; nama: string }[];
  barang: BarangForm[];
  kategori: KategoriForm[];
  /** true bila peran boleh tambah cepat master (IZIN["master-konversi.tambah-cepat"]). */
  bolehTambahCepat: boolean;
  namaAkun: Record<string, string>;
  periodeTerkunci: string[];
  alamatKembali: string;
}) {
  const router = useRouter();
  const { jalankan, memuat } = useAksi();
  const [f, setF] = useState<NilaiAwalForm>(awal);
  // Daftar pilihan disalin ke state supaya master yang baru ditambah langsung bisa dipilih tanpa menunggu muat ulang.
  const [supplier, setSupplier] = useState(supplierAwal);
  const [barang, setBarang] = useState(barangAwal);
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [konfirmasiPosting, setKonfirmasiPosting] = useState(false);
  const peralatan = jenis === "PERALATAN";
  const label = peralatan ? "peralatan" : "perlengkapan";

  const ubah = (sebagian: Partial<NilaiAwalForm>) => setF((x) => ({ ...x, ...sebagian }));
  const ubahBaris = (i: number, sebagian: Partial<Baris>, daftar: BarangForm[] = barang) =>
    setF((x) => {
      const baris = x.baris.map((b, j) => (j === i ? { ...b, ...sebagian } : b));
      // Memilih peralatan mengisi masa manfaat dan residu dari kategori asetnya (seperti app lama).
      if (peralatan && sebagian.barangKode !== undefined) {
        const kat = daftar.find((y) => y.kode === sebagian.barangKode)?.kategori;
        if (kat) {
          baris[i].masaManfaatBulan = String(kat.masaManfaatBulan || "");
          if (kat.persenResidu > 0 && int(baris[i].harga) > 0) baris[i].residu = String(Math.round((int(baris[i].harga) * kat.persenResidu) / 100));
        }
      }
      return { ...x, baris };
    });

  const barangBaru = (b: BarangForm) => {
    setBarang((x) => [...x, b]);
    // Barang baru mengisi baris pertama yang masih kosong, atau baris terakhir bila semua sudah terisi.
    const i = Math.max(0, f.baris.findIndex((r) => !r.barangKode) === -1 ? f.baris.length - 1 : f.baris.findIndex((r) => !r.barangKode));
    ubahBaris(i, { barangKode: b.kode }, [...barang, b]);
  };

  const pratinjau = useMemo(() => {
    const debit: Record<string, number> = {};
    const total = f.baris.reduce((s, b) => s + int(b.qty) * int(b.harga), 0);
    const jadwal = f.baris.map((b, i) => {
      const nilai = int(b.qty) * int(b.harga);
      const br = barang.find((x) => x.kode === b.barangKode);
      const akun = peralatan ? br?.kategori?.akunAset ?? AKUN.PERALATAN : AKUN.PERLENGKAPAN;
      if (nilai > 0) debit[akun] = (debit[akun] ?? 0) + nilai;
      if (!peralatan) return null;
      const nama = br?.nama ?? `Baris ${i + 1}`;
      if (!int(b.harga)) return { nama, teks: "isi harga dulu", galat: false };
      try {
        const n = nDariDasar(b.dasarN, int(b.garansiBulan), int(b.masaManfaatBulan));
        const h = hitungJadwal(int(b.harga), int(b.residu), n, periodeDari(f.tanggal));
        const dasar = b.dasarN === "GARANSI" ? "garansi" : "masa manfaat";
        const teks = n === 1 ? `satu periode ${rupiah(h.terakhir)}` : `periode 1 s.d. ${n - 1} ${rupiah(h.d)}/bulan, periode ${n} ${rupiah(h.terakhir)}`;
        return { nama, teks: `n = ${n} bulan dari ${dasar}; ${teks}${h.pengaman ? " (pengaman: pembulatan ke bawah)" : ""}. Nilai buku akhir ${rupiah(int(b.residu))}.`, galat: false };
      } catch (e) {
        return { nama, teks: (e as Error).message, galat: true };
      }
    });
    return { total, jadwal, jurnal: total > 0 ? barisPembelian(debit, f.caraBayar) : [] };
  }, [f, barang, peralatan]);

  const terkunci = periodeTerkunci.includes(periodeDari(f.tanggal));

  const kirim = (posting: boolean) =>
    jalankan(
      () =>
        simpanPembelian({
          ...f,
          jenis,
          posting,
          baris: f.baris.map((b) => ({ ...b, qty: int(b.qty), harga: int(b.harga), residu: int(b.residu), garansiBulan: int(b.garansiBulan), masaManfaatBulan: int(b.masaManfaatBulan) })),
        }),
      { setelahBerhasil: (h) => router.push(`${alamatKembali}?lihat=${h.data?.no}`) },
    ).then((h) => {
      setGalat(h.ok ? {} : h.galatIsian ?? {});
      if (h.ok) setKonfirmasiPosting(false);
    });

  const g = (kunci: string) => galat[kunci];

  return (
    <Kartu rapat>
      <KepalaKartu
        judul={f.no ? `Ubah draf ${f.no}` : `Pembelian ${label} baru`}
        keterangan={`Use case: Kelola (CRUD) Pembelian ${peralatan ? "Peralatan" : "Perlengkapan"}`}
      />
      <form
        className="space-y-5 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          kirim(false);
        }}
        noValidate
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Bidang label="No. pembelian" htmlFor="no">
            <Isian id="no" value={f.no ?? "Dibuat otomatis"} readOnly />
          </Bidang>
          <Bidang label="Tanggal" htmlFor="tanggal" wajib galat={g("tanggal") ?? (terkunci ? `Periode ${labelPeriode(periodeDari(f.tanggal))} terkunci; draf boleh disimpan, posting ditolak.` : undefined)}>
            <Isian id="tanggal" type="date" value={f.tanggal} onChange={(e) => ubah({ tanggal: e.target.value })} galat={!!g("tanggal") || terkunci} />
          </Bidang>
          <Bidang label="Cara bayar" htmlFor="caraBayar" wajib>
            <Pilihan id="caraBayar" value={f.caraBayar} onChange={(e) => ubah({ caraBayar: e.target.value as CaraBayar })}>
              {(Object.keys(LABEL_CARA_BAYAR) as CaraBayar[]).map((k) => (
                <option key={k} value={k}>{LABEL_CARA_BAYAR[k]}</option>
              ))}
            </Pilihan>
          </Bidang>
          {f.caraBayar === "KREDIT" && (
            <Bidang label="Jatuh tempo utang" htmlFor="jatuhTempo" wajib galat={g("jatuhTempo")}>
              <Isian id="jatuhTempo" type="date" value={f.jatuhTempo} min={f.tanggal} onChange={(e) => ubah({ jatuhTempo: e.target.value })} galat={!!g("jatuhTempo")} />
            </Bidang>
          )}
          <Bidang label="Supplier" htmlFor="supplierKode" wajib={f.caraBayar !== "INVESTASI"} galat={g("supplierKode")}>
            <Pilihan id="supplierKode" value={f.supplierKode} onChange={(e) => ubah({ supplierKode: e.target.value })} galat={!!g("supplierKode")}>
              <option value="">{f.caraBayar === "INVESTASI" ? "Tanpa supplier (setoran pemilik)" : "Pilih supplier"}</option>
              {supplier.map((s) => (
                <option key={s.kode} value={s.kode}>{s.kode} · {s.nama}</option>
              ))}
            </Pilihan>
          </Bidang>
          {bolehTambahCepat && f.caraBayar !== "INVESTASI" && (
            <div className="flex items-end sm:col-span-2 lg:col-span-3">
              <TambahSupplierCepat saatSelesai={(s) => { setSupplier((x) => [...x, s]); ubah({ supplierKode: s.kode }); }} />
            </div>
          )}
          <Bidang label="Keterangan" htmlFor="keterangan" galat={g("keterangan")}>
            <Isian id="keterangan" value={f.keterangan} placeholder="opsional" maxLength={200} onChange={(e) => ubah({ keterangan: e.target.value })} />
          </Bidang>
        </div>
        {f.caraBayar === "INVESTASI" && <Peringatan>Investasi: barang disetor pemilik, jadi lawan jurnalnya Modal Pemilik.</Peringatan>}

        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-semibold text-slate-800">Barang</legend>
          {g("baris") && <Peringatan jenis="galat">{g("baris")}</Peringatan>}
          {f.baris.map((b, i) => {
            const br = barang.find((x) => x.kode === b.barangKode);
            const id = (k: string) => `baris-${i}-${k}`;
            const gb = (k: string) => g(`baris.${i}.${k}`);
            return (
              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <b className="text-[13px] text-slate-700">Baris {i + 1}</b>
                  {f.baris.length > 1 && (
                    <Tombol kecil varian="hantu" ikon={<Trash2 className="size-4" />} onClick={() => ubah({ baris: f.baris.filter((_, j) => j !== i) })}>
                      Hapus baris
                    </Tombol>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Bidang
                    className="sm:col-span-2"
                    label={peralatan ? "Peralatan" : "Perlengkapan"}
                    htmlFor={id("barang")}
                    wajib
                    galat={gb("barangKode")}
                    petunjuk={br?.kategori ? `Kategori ${br.kategori.nama}: masa manfaat ${br.kategori.masaManfaatBulan} bln, residu ${br.kategori.persenResidu}%` : undefined}
                  >
                    <Pilihan id={id("barang")} value={b.barangKode} onChange={(e) => ubahBaris(i, { barangKode: e.target.value })} galat={!!gb("barangKode")}>
                      <option value="">Pilih {label}</option>
                      {barang.map((x) => (
                        <option key={x.kode} value={x.kode}>{x.kode} · {x.nama} ({x.satuan})</option>
                      ))}
                    </Pilihan>
                  </Bidang>
                  <Bidang label={peralatan ? "Jumlah unit" : "Jumlah"} htmlFor={id("qty")} wajib galat={gb("qty")} petunjuk={peralatan ? "Tiap unit jadi satu kartu aset" : undefined}>
                    <Isian id={id("qty")} type="number" min={1} step={1} value={b.qty} onChange={(e) => ubahBaris(i, { qty: e.target.value })} galat={!!gb("qty")} />
                  </Bidang>
                  <Bidang label={peralatan ? "Harga per unit (Rp)" : "Harga satuan (Rp)"} htmlFor={id("harga")} wajib galat={gb("harga")}>
                    <IsianRupiah id={id("harga")} nilai={b.harga} saatUbah={(v) => ubahBaris(i, { harga: v })} galat={!!gb("harga")} />
                  </Bidang>
                  {peralatan && (
                    <>
                      <Bidang label="Residu per unit (Rp)" htmlFor={id("residu")} galat={gb("residu")}>
                        <IsianRupiah id={id("residu")} nilai={b.residu} saatUbah={(v) => ubahBaris(i, { residu: v })} galat={!!gb("residu")} />
                      </Bidang>
                      <Bidang label="Garansi (bulan)" htmlFor={id("garansi")} galat={gb("garansiBulan")}>
                        <Isian id={id("garansi")} type="number" min={0} step={1} value={b.garansiBulan} onChange={(e) => ubahBaris(i, { garansiBulan: e.target.value })} galat={!!gb("garansiBulan")} />
                      </Bidang>
                      <Bidang label="Masa manfaat (bulan)" htmlFor={id("mm")} galat={gb("masaManfaatBulan")}>
                        <Isian id={id("mm")} type="number" min={0} step={1} value={b.masaManfaatBulan} onChange={(e) => ubahBaris(i, { masaManfaatBulan: e.target.value })} galat={!!gb("masaManfaatBulan")} />
                      </Bidang>
                      <Bidang label="Dasar jumlah periode (n)" htmlFor={id("dasar")}>
                        <Pilihan id={id("dasar")} value={b.dasarN} onChange={(e) => ubahBaris(i, { dasarN: e.target.value as DasarN })}>
                          <option value="GARANSI">Garansi (sesuai papan dosen)</option>
                          <option value="MASA_MANFAAT">Masa manfaat</option>
                        </Pilihan>
                      </Bidang>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap items-start gap-2">
            <Tombol kecil ikon={<Plus className="size-4" />} onClick={() => ubah({ baris: [...f.baris, barisKosong()] })} disabled={f.baris.length >= 50}>
              Tambah baris barang
            </Tombol>
            {bolehTambahCepat && <TambahBarangCepat jenis={jenis} kategori={kategori} saatSelesai={barangBaru} />}
          </div>
        </fieldset>

        <div className="space-y-4 rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <span className="teks-redup">Total pembelian</span>
            <b className="angka text-xl text-slate-900">{rupiah(pratinjau.total)}</b>
          </div>
          {peralatan && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-800">Hitung penyusutan (dibuat saat posting)</h3>
              <ul className="list-disc space-y-1 pl-5 text-[13px] text-slate-600">
                {pratinjau.jadwal.map((x, i) =>
                  x ? (
                    <li key={i} className={x.galat ? "text-rose-600" : ""}>
                      <b className="text-slate-800">{x.nama}</b>: {x.teks}
                    </li>
                  ) : null,
                )}
              </ul>
            </div>
          )}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Jurnal umum saat diposting</h3>
            {pratinjau.jurnal.length ? <TabelJurnal baris={pratinjau.jurnal} namaAkun={namaAkun} /> : <p className="teks-redup">Isi barang dan harga untuk melihat jurnalnya.</p>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Tombol type="submit" varian="garis" memuat={memuat && !konfirmasiPosting} ikon={<Save className="size-4" />}>
            Simpan draf
          </Tombol>
          <Tombol varian="utama" ikon={<Send className="size-4" />} onClick={() => setKonfirmasiPosting(true)} disabled={memuat}>
            Simpan &amp; posting
          </Tombol>
          <TautanTombol href={alamatKembali} varian="hantu">Batal</TautanTombol>
        </div>
      </form>
      <DialogKonfirmasi
        terbuka={konfirmasiPosting}
        judul="Simpan dan posting pembelian?"
        pesan={`Jurnal umum ${rupiah(pratinjau.total)} langsung berlaku${peralatan ? " dan kartu aset dibuat" : ""}. Sesudah diposting, pembelian hanya bisa dibalik oleh Owner.`}
        labelKonfirmasi="Posting"
        memuat={memuat}
        saatTutup={() => setKonfirmasiPosting(false)}
        saatKonfirmasi={() => kirim(true)}
      />
    </Kartu>
  );
}
