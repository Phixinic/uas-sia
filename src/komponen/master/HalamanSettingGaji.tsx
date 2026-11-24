/*
 * Halaman Setting Gaji (komponen server): komponen tetap gaji inhouse per karyawan dengan riwayat versi.
 * Keadaan di URL: ?form=baru[&karyawan=KRY-01] membuka form pengajuan, ?riwayat=KRY-01 menyaring riwayat.
 * HRD dan Owner mengajukan, Owner menyetujui atau menolak. Server action tetap memeriksa peran.
 */
import Link from "next/link";
import { History, Plus, Send } from "lucide-react";
import { wajibMasuk } from "@/lib/server/auth";
import { boleh, LABEL_PERAN } from "@/lib/peran";
import { dataSettingGaji, type TampilVersi } from "@/lib/data/master/setting-gaji";
import { opsiMaster } from "@/lib/data/master/master";
import { periodeTerkunciSemua } from "@/lib/data/umum";
import { labelBulanTahun, labelPeriode } from "@/lib/inti/tanggal";
import { LABEL_JENIS_PERUBAHAN } from "@/lib/inti/setting-gaji";
import { labelWaktu, rupiah } from "@/lib/format";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import Tabel from "@/komponen/ui/Tabel";
import Lencana, { type WarnaLencana } from "@/komponen/ui/Lencana";
import Peringatan from "@/komponen/ui/Peringatan";
import KeadaanKosong from "@/komponen/ui/KeadaanKosong";
import { TautanTombol } from "@/komponen/ui/Tombol";
import LencanaBiaya from "@/komponen/sdm/LencanaBiaya";
import { DaftarHP, KartuHP, RincianHP, TabelLebar } from "@/komponen/fee-event/Ringkas";
import FormSettingGaji from "./FormSettingGaji";
import AksiSettingGaji from "./AksiSettingGaji";

export const ALAMAT_SETTING_GAJI = "/sdm/setting-gaji";

export type CariSettingGaji = { form?: string; karyawan?: string; riwayat?: string };

function LencanaVersi({ v, berlakuSekarang }: { v: TampilVersi; berlakuSekarang?: boolean }) {
  let warna: WarnaLencana = "biru";
  let teks = "Menunggu Owner";
  if (v.status === "DITOLAK") [warna, teks] = ["merah", "Ditolak"];
  else if (v.status === "DISETUJUI" && v.digantikan) [warna, teks] = ["abu", "Disetujui, digantikan"];
  else if (v.status === "DISETUJUI") [warna, teks] = ["hijau", "Disetujui"];
  return (
    <span className="inline-flex flex-wrap items-center gap-1 md:flex-nowrap md:whitespace-nowrap">
      <Lencana warna={warna}>{teks}</Lencana>
      {berlakuSekarang && <Lencana warna="teal">berlaku sekarang</Lencana>}
    </span>
  );
}

/** Total semua tunjangan (jabatan, keluarga, dan tunjangan lain) dan jumlah komponennya. */
const totalTunjangan = (v: TampilVersi) => v.estimasiBruto - v.gajiPokok;
const jumlahTunjangan = (v: TampilVersi) => (v.tunjJabatan > 0 ? 1 : 0) + (v.tunjKeluarga > 0 ? 1 : 0) + v.tunjangan.length;
const ringkasTunjangan = (v: TampilVersi) => (jumlahTunjangan(v) ? `${rupiah(totalTunjangan(v))} (${jumlahTunjangan(v)} komponen)` : "Tanpa tunjangan");
/** Rincian per komponen, dipakai sebagai keterangan tambahan (Riwayat dan tooltip tabel). */
const rincianTunjangan = (v: TampilVersi) =>
  [
    v.tunjJabatan ? `Tunj. jabatan ${rupiah(v.tunjJabatan)}` : "",
    v.tunjKeluarga ? `Tunj. keluarga ${rupiah(v.tunjKeluarga)}` : "",
    ...v.tunjangan.map((t) => `${t.nama} ${rupiah(t.nominal)}`),
  ].filter(Boolean).join(", ") || "Tanpa tunjangan";
const awal = (v: TampilVersi) => v.jenisPerubahan === "SETTING_AWAL";
const siapaKapan = (nama: string | null, waktu: string | null, v: TampilVersi) =>
  waktu ? `${nama ?? (awal(v) ? "Data awal" : "Sistem")}, ${labelWaktu(waktu)}` : "Belum diputuskan";

/** Isi satu versi untuk pengajuan Owner (sebelum dan sesudah), tiga baris pendek. */
function IsiVersi({ v, judul }: { v: TampilVersi | null; judul: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 px-3 py-2">
      <div className="text-[12px] font-semibold tracking-wide text-slate-500 uppercase">{judul}</div>
      {v ? (
        <div className="mt-1 space-y-0.5 text-[13px]">
          <div className="font-medium text-slate-900">{v.jabatan}, {v.golongan} {rupiah(v.gajiPokok)}</div>
          <div className="text-slate-600">Tunjangan {ringkasTunjangan(v)}</div>
          <div>Estimasi bruto <span className="font-semibold text-slate-900">{rupiah(v.estimasiBruto)}</span></div>
        </div>
      ) : (
        <p className="mt-1 text-[13px] text-slate-500">Belum ada setting yang berlaku.</p>
      )}
    </div>
  );
}

export function PanelPeriodeLaporan() {
  return (
    <Kartu>
      <h2 className="font-semibold text-slate-900">Masuk laporan keuangan periode apa?</h2>
      <p className="mt-1 text-sm text-slate-600">
        Setting gaji tidak membuat jurnal. Dampaknya muncul di slip bulan berlaku dan sesudahnya, jurnalnya bertanggal akhir bulan saat Owner menyetujui penggajian.
        Slip yang sudah diajukan atau dibayar tidak berubah.
      </p>
    </Kartu>
  );
}

export default async function HalamanSettingGaji({ cari }: { cari: CariSettingGaji }) {
  const pengguna = await wajibMasuk();
  const bolehAjukan = boleh(pengguna.peran, "setting-gaji.ajukan");
  const bolehPutuskan = boleh(pengguna.peran, "setting-gaji.putuskan");
  const d = await dataSettingGaji();
  const formTerbuka = cari.form === "baru" && bolehAjukan;
  const [opsi, terkunci] = formTerbuka ? await Promise.all([opsiMaster(), periodeTerkunciSemua()]) : [null, []];
  const riwayat = cari.riwayat ? d.riwayat.filter((v) => v.karyawanKode === cari.riwayat) : d.riwayat;
  const namaRiwayat = cari.riwayat ? d.baris.find((b) => b.kode === cari.riwayat)?.nama : null;
  const berlakuSekarang = new Set(d.baris.map((b) => b.aktifSekarang?.kode).filter(Boolean));
  const alamatForm = (k?: string) => `${ALAMAT_SETTING_GAJI}?form=baru${k ? `&karyawan=${k}` : ""}`;

  return (
    <>
      <KepalaHalaman
        judul="Setting Gaji"
        lencana={<LencanaBiaya jenis="tetap" />}
        keterangan="Gaji pokok dan tunjangan tetap tiap karyawan inhouse; setiap perubahan diajukan lalu diputuskan Owner."
        aksi={bolehAjukan && !formTerbuka ? <TautanTombol href={alamatForm()} varian="utama" ikon={<Plus className="size-4" />}>Ajukan setting gaji</TautanTombol> : null}
      />

      {!bolehAjukan && <Peringatan>Peran {LABEL_PERAN[pengguna.peran]} hanya bisa melihat setting gaji. Yang boleh mengajukan: HRD dan Owner. Yang memutuskan: Owner.</Peringatan>}

      {formTerbuka && opsi && (
        <FormSettingGaji
          key={cari.karyawan ?? "baru"}
          opsi={{ karyawan: opsi.karyawan, jabatan: opsi.jabatan, golongan: opsi.golongan, tunjangan: opsi.tunjangan }}
          bahan={d.bahanForm}
          terkunci={terkunci}
          sekarang={d.sekarang}
          periodeBerlaku={d.periodeBerlaku}
          karyawanAwal={cari.karyawan && d.bahanForm[cari.karyawan] ? cari.karyawan : null}
          alamatKembali={ALAMAT_SETTING_GAJI}
        />
      )}

      <Kartu rapat>
        <KepalaKartu
          judul={`Pengajuan menunggu Owner (${d.pengajuan.length})`}
          keterangan={bolehPutuskan ? "Bandingkan sebelum dan sesudah, lalu setujui atau tolak." : "Diputuskan oleh Owner."}
        />
        {d.pengajuan.length === 0 ? (
          <KeadaanKosong judul="Tidak ada pengajuan yang menunggu" />
        ) : (
          <ul className="divide-y divide-slate-100" aria-label="Pengajuan setting gaji menunggu Owner">
            {d.pengajuan.map((p) => (
              <li key={p.kode} className="space-y-3 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="kode">{p.kode}</span>
                      <span className="font-semibold text-slate-900">{p.karyawan}</span>
                      <Lencana warna="biru">{LABEL_JENIS_PERUBAHAN[p.jenisPerubahan]}</Lencana>
                    </div>
                    <div className="mt-0.5 text-[13px] text-slate-600">
                      Berlaku mulai {labelBulanTahun(p.berlakuMulai)}. Diajukan {p.diajukanOleh ?? "-"}, {labelWaktu(p.diajukanPada)}.
                    </div>
                  </div>
                  {bolehPutuskan && (
                    <AksiSettingGaji kode={p.kode} karyawan={p.karyawan} berlaku={p.berlakuMulai} draf={p.pengaman.drafTerdampak.map((s) => s.no)} terhalang={p.pengaman.galat} />
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <IsiVersi v={p.lama} judul="Sebelum" />
                  <IsiVersi v={p} judul="Sesudah" />
                </div>
                <p className="text-[13px] text-slate-700"><span className="text-slate-500">Alasan: </span>{p.alasan}</p>
                {p.pengaman.galat ? (
                  <Peringatan jenis="galat">Tidak bisa disetujui lagi: {p.pengaman.galat}</Peringatan>
                ) : p.pengaman.drafTerdampak.length ? (
                  <Peringatan jenis="awas">Slip draf {p.pengaman.drafTerdampak.map((s) => s.no).join(", ")} perlu dihitung ulang setelah disetujui.</Peringatan>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Kartu>

      <Kartu rapat>
        <KepalaKartu judul={`Setting gaji berlaku · ${labelBulanTahun(d.sekarang)}`} keterangan="Versi disetujui terbaru yang sudah berlaku." />
        {d.baris.length === 0 ? (
          <KeadaanKosong judul="Belum ada karyawan inhouse" keterangan="Tambahkan karyawan di Master SDM." />
        ) : (
          <>
            <DaftarHP label="Setting gaji berlaku">
              {d.baris.map((b) => {
                const v = b.aktifSekarang;
                return (
                  <KartuHP
                    key={b.kode}
                    judul={b.nama}
                    sub={`${b.kode}${v ? ` · ${v.kode}, mulai ${labelPeriode(v.berlakuMulai)}` : ""}${b.aktif ? "" : " · nonaktif"}`}
                    kanan={v ? <span className="angka text-sm font-semibold">{rupiah(v.estimasiBruto)}</span> : <Lencana warna="merah">Belum ada</Lencana>}
                  >
                    {v && <RincianHP isi={[["Jabatan", v.jabatan], ["Gaji pokok", `${v.golongan} ${rupiah(v.gajiPokok)}`], ["Tunjangan", ringkasTunjangan(v)]]} />}
                    {b.berikutnya && <p className="text-[12px] text-teal-800">{LABEL_JENIS_PERUBAHAN[b.berikutnya.jenisPerubahan]} berlaku {labelPeriode(b.berikutnya.berlakuMulai)}: {b.berikutnya.jabatan}, {rupiah(b.berikutnya.estimasiBruto)}</p>}
                    {b.menunggu > 0 && <p className="text-[12px] text-blue-800">{b.menunggu} pengajuan menunggu Owner</p>}
                    <div className="flex flex-wrap gap-3 text-[13px]">
                      {bolehAjukan && b.aktif && <Link className="font-medium underline" href={alamatForm(b.kode)}>{v || b.berikutnya ? "Ajukan perubahan" : "Ajukan setting awal"}</Link>}
                      <Link className="font-medium underline" href={`${ALAMAT_SETTING_GAJI}?riwayat=${b.kode}#riwayat`}>Riwayat</Link>
                    </div>
                  </KartuHP>
                );
              })}
            </DaftarHP>
            <TabelLebar>
              <Tabel label="Setting gaji berlaku">
                <thead>
                  <tr>
                    <th>Karyawan</th>
                    <th>Versi</th>
                    <th>Jabatan</th>
                    <th>Gaji pokok</th>
                    <th>Tunjangan</th>
                    <th className="kolom-angka">Estimasi bruto (Rp)</th>
                    <th>Berikutnya</th>
                    <th className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {d.baris.map((b) => {
                    const v = b.aktifSekarang;
                    return (
                      <tr key={b.kode} className={b.aktif ? "" : "text-slate-400"}>
                        <td>
                          <div className="font-medium">{b.nama}</div>
                          <div className="text-[11px] text-slate-500">{b.kode}{b.aktif ? "" : " · nonaktif"}</div>
                        </td>
                        <td className="whitespace-nowrap">{v ? <><span className="kode">{v.kode}</span><div className="text-[11px] text-slate-500">mulai {labelPeriode(v.berlakuMulai)}</div></> : <Lencana warna="merah">Belum ada</Lencana>}</td>
                        <td>{v?.jabatan ?? "-"}</td>
                        <td>{v ? `${v.golongan} (${rupiah(v.gajiPokok)})` : "-"}</td>
                        <td className="text-[13px] whitespace-nowrap" title={v ? rincianTunjangan(v) : undefined}>{v ? (jumlahTunjangan(v) ? <>{rupiah(totalTunjangan(v))}<div className="text-[11px] text-slate-500">{jumlahTunjangan(v)} komponen</div></> : "Tanpa tunjangan") : "-"}</td>
                        <td className="kolom-angka angka">{v ? rupiah(v.estimasiBruto).replace("Rp", "") : "-"}</td>
                        <td className="text-[13px]">
                          {b.berikutnya ? <span className="text-teal-800">{LABEL_JENIS_PERUBAHAN[b.berikutnya.jenisPerubahan]} mulai {labelPeriode(b.berikutnya.berlakuMulai)}</span> : "-"}
                          {b.menunggu > 0 && <div><Lencana warna="biru">{b.menunggu} menunggu</Lencana></div>}
                        </td>
                        <td>
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {bolehAjukan && b.aktif && <TautanTombol href={alamatForm(b.kode)} kecil ikon={<Send className="size-4" />}>{v || b.berikutnya ? "Ajukan perubahan" : "Ajukan setting awal"}</TautanTombol>}
                            <TautanTombol href={`${ALAMAT_SETTING_GAJI}?riwayat=${b.kode}#riwayat`} kecil ikon={<History className="size-4" />}>Riwayat</TautanTombol>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Tabel>
            </TabelLebar>
          </>
        )}
      </Kartu>

      <section id="riwayat" className="scroll-mt-4">
        <Kartu rapat>
          <KepalaKartu
            judul={namaRiwayat ? `Riwayat setting gaji ${namaRiwayat}` : "Riwayat setting gaji semua karyawan"}
            keterangan={`${riwayat.length} versi, terbaru di atas. Rincian tunjangan dan alasan muncul saat kursor di atas baris.`}
            aksi={cari.riwayat ? <Link className="text-[13px] font-semibold text-aksen hover:underline" href={`${ALAMAT_SETTING_GAJI}#riwayat`}>Tampilkan semua</Link> : undefined}
          />
          {riwayat.length === 0 ? (
            <KeadaanKosong judul="Belum ada riwayat" />
          ) : (
            <>
              <DaftarHP label="Riwayat setting gaji">
                {riwayat.map((v) => (
                  <KartuHP
                    key={v.kode}
                    judul={`${v.kode} · ${v.karyawan}`}
                    sub={<>{awal(v) ? <Lencana warna="teal">Data awal</Lencana> : LABEL_JENIS_PERUBAHAN[v.jenisPerubahan]} · berlaku {labelPeriode(v.berlakuMulai)}</>}
                    kanan={<span className="angka text-sm font-semibold">{rupiah(v.estimasiBruto)}</span>}
                  >
                    <LencanaVersi v={v} berlakuSekarang={berlakuSekarang.has(v.kode)} />
                    <p className="text-[12px] text-slate-700">{v.jabatan}, {v.golongan}. Diputuskan: {siapaKapan(v.diputuskanOleh, v.diputuskanPada, v)}</p>
                    <p className="text-[12px] text-slate-500">{rincianTunjangan(v)}</p>
                    {v.alasanTolak && <p className="text-[12px] text-rose-700">Alasan tolak: {v.alasanTolak}</p>}
                  </KartuHP>
                ))}
              </DaftarHP>
              <TabelLebar>
                <Tabel label="Riwayat setting gaji">
                  <thead>
                    <tr>
                      <th>Karyawan</th>
                      <th>Versi</th>
                      <th>Berlaku mulai</th>
                      <th>Jabatan, golongan</th>
                      <th className="kolom-angka">Estimasi (Rp)</th>
                      <th>Status</th>
                      <th>Diputuskan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riwayat.map((v) => (
                      <tr key={v.kode} title={`${rincianTunjangan(v)}. Alasan: ${v.alasan || "-"}`}>
                        <td>{v.karyawan}</td>
                        <td className="whitespace-nowrap">
                          <span className="kode">{v.kode}</span>{" "}
                          {awal(v) ? <Lencana warna="teal">Data awal</Lencana> : <span className="text-[13px] text-slate-600">{LABEL_JENIS_PERUBAHAN[v.jenisPerubahan]}</span>}
                        </td>
                        <td className="whitespace-nowrap">{labelPeriode(v.berlakuMulai)}</td>
                        <td className="text-[13px]">{v.jabatan}, {v.golongan}</td>
                        <td className="kolom-angka angka">{rupiah(v.estimasiBruto).replace("Rp", "")}</td>
                        <td>
                          <LencanaVersi v={v} berlakuSekarang={berlakuSekarang.has(v.kode)} />
                          {v.alasanTolak && <div className="mt-0.5 max-w-52 text-[12px] text-rose-700">Alasan tolak: {v.alasanTolak}</div>}
                        </td>
                        <td className="text-[13px]">{siapaKapan(v.diputuskanOleh, v.diputuskanPada, v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Tabel>
              </TabelLebar>
            </>
          )}
        </Kartu>
      </section>

      <PanelPeriodeLaporan />
    </>
  );
}
