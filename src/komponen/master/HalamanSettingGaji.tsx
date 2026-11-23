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
    <span className="inline-flex flex-wrap items-center gap-1">
      <Lencana warna={warna}>{teks}</Lencana>
      {berlakuSekarang && <Lencana warna="teal">berlaku sekarang</Lencana>}
    </span>
  );
}

const ringkasTunjangan = (v: TampilVersi) => (v.tunjangan.length ? v.tunjangan.map((t) => `${t.nama} ${rupiah(t.nominal)}`).join(", ") : "Tanpa tunjangan lain");

/** Isi satu versi dalam daftar definisi kecil (dipakai di pengajuan: sebelum dan sesudah). */
function IsiVersi({ v, judul }: { v: TampilVersi | null; judul: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 p-3">
      <div className="text-[12px] font-semibold tracking-wide text-slate-500 uppercase">{judul}</div>
      {v ? (
        <dl className="mt-1.5 space-y-1 text-[13px]">
          <div><dt className="inline text-slate-500">Jabatan: </dt><dd className="inline font-medium text-slate-900">{v.jabatan}</dd></div>
          <div><dt className="inline text-slate-500">Gaji pokok: </dt><dd className="inline font-medium text-slate-900">{v.golongan} {rupiah(v.gajiPokok)}</dd></div>
          <div><dt className="inline text-slate-500">Tunj. jabatan: </dt><dd className="inline">{rupiah(v.tunjJabatan)}{v.tunjKeluarga ? `, tunj. keluarga ${rupiah(v.tunjKeluarga)}` : ""}</dd></div>
          <div><dt className="inline text-slate-500">Tunjangan: </dt><dd className="inline">{ringkasTunjangan(v)}</dd></div>
          <div><dt className="inline text-slate-500">Estimasi bruto: </dt><dd className="inline font-semibold text-slate-900">{rupiah(v.estimasiBruto)}</dd></div>
          <div><dt className="inline text-slate-500">Berlaku mulai: </dt><dd className="inline">{labelPeriode(v.berlakuMulai)}</dd></div>
        </dl>
      ) : (
        <p className="mt-1.5 text-[13px] text-slate-500">Belum ada setting yang berlaku.</p>
      )}
    </div>
  );
}

export function PanelPeriodeLaporan() {
  return (
    <Kartu>
      <h2 className="font-semibold text-slate-900">Masuk laporan keuangan periode apa?</h2>
      <p className="mt-1 text-sm text-slate-600">
        Mengajukan atau menyetujui setting gaji tidak membuat jurnal. Dampaknya baru muncul di slip dan penggajian bulan berlaku dan bulan sesudahnya,
        dan jurnal gajinya bertanggal akhir bulan itu saat Owner menyetujui penggajiannya. Slip yang sudah diajukan atau dibayar tidak berubah,
        dan slip bulan sebelum bulan berlaku tetap memakai setting lama walau dihitung ulang.
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
        keterangan="Komponen tetap gaji inhouse: jabatan, gaji pokok, dan tunjangan. Setting tidak pernah ditimpa. Setiap setting awal, promosi, demosi, atau penyesuaian diajukan dengan bulan berlaku, lalu disetujui atau ditolak Owner. Nominal jabatan, gaji pokok, dan tunjangan diatur di Master SDM."
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
          keterangan={bolehPutuskan ? "Bandingkan setting sebelum dan sesudah, lalu setujui atau tolak dengan alasan." : "Owner yang menyetujui atau menolak."}
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
                      Berlaku mulai {labelBulanTahun(p.berlakuMulai)}. Diajukan {p.diajukanOleh ?? "-"} pada {labelWaktu(p.diajukanPada)}.
                    </div>
                  </div>
                  {bolehPutuskan && (
                    <AksiSettingGaji kode={p.kode} karyawan={p.karyawan} berlaku={p.berlakuMulai} draf={p.pengaman.drafTerdampak.map((s) => s.no)} terhalang={p.pengaman.galat} />
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <IsiVersi v={p.lama} judul="Sebelum (nilai lama)" />
                  <IsiVersi v={p} judul="Sesudah (nilai baru)" />
                </div>
                <p className="text-[13px] text-slate-700"><span className="text-slate-500">Alasan: </span>{p.alasan}</p>
                {p.pengaman.galat ? (
                  <Peringatan jenis="galat">Tidak bisa disetujui lagi: {p.pengaman.galat}</Peringatan>
                ) : p.pengaman.drafTerdampak.length ? (
                  <Peringatan jenis="awas">Slip draf {p.pengaman.drafTerdampak.map((s) => s.no).join(", ")} akan ditandai perlu dihitung ulang setelah disetujui.</Peringatan>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Kartu>

      <Kartu rapat>
        <KepalaKartu judul={`Setting gaji berlaku · ${labelBulanTahun(d.sekarang)}`} keterangan="Versi disetujui dengan bulan berlaku paling akhir yang tidak melewati bulan berjalan." />
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
                    {v && <RincianHP isi={[["Jabatan", v.jabatan], ["Gaji pokok", `${v.golongan} ${rupiah(v.gajiPokok)}`]]} />}
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
                        <td>{v ? <><span className="kode">{v.kode}</span><div className="text-[11px] text-slate-500">mulai {labelPeriode(v.berlakuMulai)}</div></> : <Lencana warna="merah">Belum ada</Lencana>}</td>
                        <td>{v?.jabatan ?? "-"}</td>
                        <td>{v ? `${v.golongan} (${rupiah(v.gajiPokok)})` : "-"}</td>
                        <td className="max-w-56 text-[13px]">{v ? ringkasTunjangan(v) : "-"}</td>
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
            keterangan={`${riwayat.length} versi, terbaru di atas per karyawan. Versi lama tidak pernah dihapus.`}
            aksi={cari.riwayat ? <Link className="text-[13px] font-semibold text-aksen hover:underline" href={`${ALAMAT_SETTING_GAJI}#riwayat`}>Tampilkan semua</Link> : undefined}
          />
          {riwayat.length === 0 ? (
            <KeadaanKosong judul="Belum ada riwayat" />
          ) : (
            <>
              <DaftarHP label="Riwayat setting gaji">
                {riwayat.map((v) => (
                  <KartuHP key={v.kode} judul={`${v.kode} · ${v.karyawan}`} sub={`${LABEL_JENIS_PERUBAHAN[v.jenisPerubahan]} · berlaku ${labelPeriode(v.berlakuMulai)}`}>
                    <LencanaVersi v={v} berlakuSekarang={berlakuSekarang.has(v.kode)} />
                    <RincianHP isi={[["Jabatan", v.jabatan], ["Gaji pokok", `${v.golongan} ${rupiah(v.gajiPokok)}`], ["Diajukan", `${v.diajukanOleh ?? "Data awal (migrasi)"}, ${labelWaktu(v.diajukanPada)}`], ["Diputuskan", v.diputuskanPada ? `${v.diputuskanOleh ?? "Data awal (migrasi)"}, ${labelWaktu(v.diputuskanPada)}` : "Belum"]]} />
                    <p className="text-[12px] text-slate-600">Alasan: {v.alasan || "-"}</p>
                    {v.alasanTolak && <p className="text-[12px] text-rose-700">Alasan tolak: {v.alasanTolak}</p>}
                  </KartuHP>
                ))}
              </DaftarHP>
              <TabelLebar>
                <Tabel label="Riwayat setting gaji">
                  <thead>
                    <tr>
                      <th>Versi</th>
                      <th>Karyawan</th>
                      <th>Jenis</th>
                      <th>Berlaku mulai</th>
                      <th>Isi</th>
                      <th>Status</th>
                      <th>Diajukan</th>
                      <th>Diputuskan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riwayat.map((v) => (
                      <tr key={v.kode}>
                        <td className="kode">{v.kode}</td>
                        <td>{v.karyawan}</td>
                        <td>{LABEL_JENIS_PERUBAHAN[v.jenisPerubahan]}</td>
                        <td className="whitespace-nowrap">{labelPeriode(v.berlakuMulai)}</td>
                        <td className="max-w-72 text-[13px]">
                          <div>{v.jabatan}, {v.golongan} {rupiah(v.gajiPokok)}</div>
                          <div className="text-slate-500">{ringkasTunjangan(v)}</div>
                          <div className="text-slate-500">Alasan: {v.alasan || "-"}</div>
                          {v.alasanTolak && <div className="text-rose-700">Alasan tolak: {v.alasanTolak}</div>}
                        </td>
                        <td><LencanaVersi v={v} berlakuSekarang={berlakuSekarang.has(v.kode)} /></td>
                        <td className="text-[13px]">{v.diajukanOleh ?? "Data awal (migrasi)"}<div className="text-slate-500">{labelWaktu(v.diajukanPada)}</div></td>
                        <td className="text-[13px]">{v.diputuskanPada ? <>{v.diputuskanOleh ?? "Data awal (migrasi)"}<div className="text-slate-500">{labelWaktu(v.diputuskanPada)}</div></> : "-"}</td>
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
