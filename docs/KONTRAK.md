# Kontrak kerja SIA D'Production (Next.js)

Dokumen ini pegangan bersama untuk semua agen dan anggota kelompok yang mengisi halaman. Baca sampai habis sebelum menulis kode. Aturan bisnis mengikuti app lama di `versi-statis/` (lihat `versi-statis/assets/js/views/*.js`); kalau kontrak ini dan app lama berbeda, kontrak ini yang dipakai dan perbedaannya ditulis di bagian "Keputusan".

## 1. Stack dan struktur

Next.js 16 (App Router, TypeScript), Prisma 7 + PostgreSQL 16 (adapter `pg`), Tailwind CSS 4, zod 4, lucide-react, vitest.

```
prisma/schema.prisma            skema relasional (nama Indonesia, tabel snake_case)
prisma/migrations/              migrasi (CHECK constraint tambahan ditulis manual di migrasi awal)
prisma/seed.ts                  data contoh Oktober 2026 + 3 pengguna demo, data contoh fee event November 2026 + 2 akun kapten
prisma/tambah-dummy*.ts         skrip data dummy untuk database berisi (produksi), satu transaksi, mode --coba, menolak jalan dua kali
prisma/data/                    salinan JSON data contoh app lama
src/lib/inti/                   logika murni tanpa DB/UI: tanggal, penyusutan, penggajian, fee-event, jurnal, buku-besar, akun, modal, setting-gaji, nominal
src/lib/server/                 khusus server: db, auth, aksi (konvensi), nomor, periode, jurnal, log, menu, logo, setting-gaji, nominal, gaji
src/lib/aksi/<siklus>/          server action ("use server")
src/lib/data/<siklus>/          kueri baca untuk komponen server
src/lib/skema/                  skema zod (boleh diimpor klien): konversi, pembelian, sdm, fee-event, pelaporan, master, pengguna, modal
src/lib/peran.ts                peran + tabel IZIN per aksi (boleh diimpor klien)
src/lib/format.ts               rupiah, tanggal, label enum (boleh diimpor klien)
src/lib/menu.ts                 peta menu sidebar
src/komponen/ui/                komponen dasar (jangan dibuat ulang)
src/komponen/kerangka/          sidebar, topbar, logo
src/komponen/<siklus>/          komponen halaman per siklus
src/app/(aplikasi)/...          rute yang butuh login
src/app/(publik)/masuk          halaman masuk
src/proxy.ts                    proteksi rute (middleware Next 16)
tests/                          vitest: tes inti (tanpa DB) dan tes integrasi (UJI_DB=1)
```

## 2. Peta rute

| Rute | Halaman | Pemilik |
|---|---|---|
| `/` | Dashboard | Pelaporan |
| `/modal/investasi-kas` | Investasi Kas: setoran modal pemilik berupa kas dan ringkasan "Dari mana kas dan modal" (`?form=baru`, `?bulan=11&tahun=2026` atau `?tahun=semua`). Hanya Admin dan Owner | Modal |
| `/konversi/pembelian-peralatan` | Pembelian Peralatan (**sudah jadi, pola rujukan**) | Konversi |
| `/konversi/pembelian-perlengkapan` | Pembelian Perlengkapan (sudah jadi, komponen sama) | Konversi |
| `/konversi/nilai-sisa` | Nilai Sisa Perlengkapan (opname) | Konversi |
| `/konversi/penyusutan` | Proses Penyusutan: pilih bulan, pratinjau beban per aset, tombol "Proses penyusutan" (jurnal langsung disetujui), panel status jurnal periode ini, riwayat proses. Tanpa tombol ajukan, setujui, atau tolak | Konversi |
| `/konversi/kartu-aset` | Kartu Aset (`?aset=AST-0001` membuka rinciannya) | Konversi |
| `/konversi/pelepasan` | Pelepasan Peralatan | Konversi |
| `/sdm/setting-gaji` | Setting Gaji: versi berlaku per karyawan, pengajuan menunggu Owner, riwayat (`?form=baru&karyawan=KRY-01`, `?riwayat=KRY-01`). Tab Setting gaji di Master SDM dialihkan ke sini | SDM |
| `/sdm/presensi` | Presensi (rekap dan harian) | SDM |
| `/sdm/hitung-gaji` | Hitung Gaji (slip, PPh 21; status per karyawan: Belum ada presensi, Estimasi (belum dihitung), Sudah dihitung, Diajukan, Dibayar; angka sebelum dihitung berlabel estimasi) | SDM |
| `/sdm/distribusi` | Distribusi Gaji (pengajuan penggajian) | SDM |
| `/fee-event/event` | Event & Kehadiran crew freelance (`?lihat=EVT-2026-0001`, `&sesi=`, `&tugas=`, `&hadir=`) | SDM (fee event) |
| `/fee-event/keputusan` | Laporan & Fee: keputusan Owner, slip fee (`?lihat=FEE-2026-0001&slip=semua`) | SDM (fee event) |
| `/kapten` | Penilaian Crew (hanya peran Kapten, `?lihat=EVT-2026-0001`) | SDM (fee event) |
| `/pelaporan/jurnal-penyesuaian` | Jurnal Penyesuaian (ajukan, setujui, tolak) | Pelaporan |
| `/pelaporan/jurnal-umum` | Jurnal Umum (umum + pembalik yang disetujui) | Pelaporan |
| `/pelaporan/buku-besar` | Buku Besar (`?akun=1-110&bulan=10&tahun=2026&tahap=sebelum\|setelah`, bawaan `setelah`) | Pelaporan |
| `/pelaporan/neraca-saldo` | Neraca Saldo (`?bulan=10&tahun=2026&tahap=sebelum\|setelah`; `setelah` = neraca lajur ringkas) | Pelaporan |
| `/pelaporan/tutup-periode` | Tutup Periode | Pelaporan |
| `/master/konversi` | Supplier, peralatan, perlengkapan, kategori aset, bagan akun, profil usaha | Pelaporan |
| `/master/sdm` | Tab Karyawan, Struktur gaji (`?tab=struktur`: jabatan inhouse, jabatan event, golongan atau gaji pokok, tunjangan lain di satu halaman; form `&jenis=<jenis>&form=baru\|<kode>`, form Ajukan perubahan nominal `&jenis=<jenis>&nominal=<kode>`, riwayat nominal `&jenis=<jenis>&riwayat=<kode>`; pengajuan nominal yang menunggu Owner di atas), Jadwal kerja, Setting gaji. Tautan lama `?tab=jabatan\|jabatanEvent\|golongan\|tunjangan` (termasuk `&form=`) dialihkan ke tab Struktur gaji | Pelaporan |
| `/pengguna` | Kelola pengguna (Owner saja) | Pelaporan |

Halaman yang belum jadi memakai `HalamanBelumJadi`; ganti seluruh isi `page.tsx`-nya.

## 3. Peran dan izin per aksi

Sumber kebenaran: `IZIN` di `src/lib/peran.ts`. Semua peran staf (Admin, HRD, Owner) boleh **membuka** semua halaman kecuali `/pengguna`, `/kapten`, dan `/modal/investasi-kas` (hanya Admin dan Owner, `wajibPeranHalaman(IZIN["investasi-kas.lihat"])`; menunya juga disembunyikan dari HRD dan Kapten); tombol aksi disembunyikan dengan `boleh(peran, "kunci")`, dan server action **wajib** memanggil `wajibPeran(IZIN["kunci"])`.

Peran **Kapten** (crew freelance yang memimpin event) ditolak secara bawaan: `wajibMasuk()` mengalihkan Kapten ke `/tanpa-akses`, jadi semua halaman lama tertutup untuknya tanpa diubah satu per satu. Kapten hanya membuka dashboard khusus kapten (`wajibMasuk({ kapten: true })`) dan `/kapten` (`wajibPeranHalaman(["KAPTEN"])`). Menu sidebar untuk Kapten hanya berisi tautan yang menyebut `KAPTEN` secara eksplisit (`tampilUntuk` di `src/lib/menu.ts`). Akun Kapten ditautkan ke satu karyawan berjenis Event (`pengguna.id_karyawan`), dan setiap aksi kapten memeriksa kepemilikan event lewat `pastikanKaptenEvent` (kapten hanya menyentuh event tempat karyawannya ditugaskan sebagai Kapten).

| Kunci izin | Peran | Aksi |
|---|---|---|
| `investasi-kas.lihat` | Admin, Owner | membuka halaman Investasi Kas (HRD dan Kapten ke `/tanpa-akses`) |
| `investasi-kas.catat` | Admin, Owner | catat setoran modal kas (DIAJUKAN) |
| `investasi-kas.putuskan` | Owner | setujui (jurnal Dr Kas, Kr Modal Pemilik) atau tolak (alasan wajib); Owner boleh menyetujui setoran yang ia catat sendiri |
| `pembelian.kelola-draf` | Admin | buat, ubah, hapus draf pembelian |
| `pembelian.posting` | Admin, Owner | posting draf |
| `pembelian.balik` | Owner | balik pembelian terposting (jurnal pembalik, alasan wajib) |
| `nilai-sisa.input` | Admin | input nilai sisa perlengkapan |
| `penyusutan.proses` | Admin | proses penyusutan satu periode: jurnal penyesuaian langsung DISETUJUI (tanpa keputusan Owner) |
| `pelepasan.ajukan` | Admin | ajukan pelepasan |
| `pelepasan.putuskan` | Owner | setujui atau tolak pelepasan (alasan wajib saat tolak) |
| `presensi.kelola` | HRD | input, ubah, hapus presensi |
| `gaji.hitung` | HRD | hitung dan simpan slip, hapus slip draf |
| `penggajian.ajukan` | HRD | ajukan semua slip draf satu periode |
| `penggajian.putuskan` | Owner | setujui (jurnal + bayar) atau tolak |
| `event.kelola` | HRD, Owner | event, sesi, penugasan crew, kehadiran per sesi (hanya selama event berstatus Penilaian) |
| `event.nilai` | Kapten, Owner | Kapten menilai kehadiran crew di event miliknya (bukan dirinya, bukan kapten lain); Owner menilai kehadiran kapten |
| `event.lapor` | Kapten | kirim laporan progres ke Owner (semua kehadiran crew sudah dinilai) |
| `fee-event.putuskan` | Owner | tentukan fee akhir per orang, setujui (jurnal + slip fee) atau tolak (kembali ke kapten) |
| `tarif-event.ubah` | Owner | master Jabatan event: peran (Kapten/Crew), satuan tarif (hari/jam), akun biaya; mengajukan perubahan tarif (versi nominal) |
| `jurnal-penyesuaian.ajukan` | Admin | ajukan jurnal penyesuaian draf |
| `jurnal-penyesuaian.putuskan` | Owner | setujui atau tolak; pembuat tidak boleh menyetujui jurnalnya sendiri |
| `periode.kunci` | Owner | tutup periode (mengunci periode, tanpa jurnal penutup) dan buka kunci periode (alasan wajib saat buka); berurutan: kunci dari periode paling lama, buka dari periode terkunci paling akhir |
| `master-konversi.ubah` | Admin, Owner | tambah/ubah supplier, peralatan, perlengkapan |
| `master-konversi.tambah-cepat` | Admin | tambah supplier/barang langsung dari form pembelian (extend) |
| `master-sdm.ubah` | HRD, Owner | tambah/ubah master SDM (kecuali setting gaji); nominal hanya saat data baru (menjadi pengajuan nominal awal) |
| `nominal.ajukan` | HRD, Owner | ajukan perubahan gaji pokok golongan, nominal tunjangan, tunjangan jabatan dan tunjangan istri/anak dengan bulan berlaku (tarif event: `tarif-event.ubah`) |
| `nominal.putuskan` | Owner | setujui atau tolak (alasan wajib) pengajuan nominal; Owner boleh menyetujui pengajuannya sendiri |
| `setting-gaji.ajukan` | HRD, Owner | ajukan versi setting gaji: setting awal, promosi, demosi, penyesuaian, dengan bulan berlaku |
| `setting-gaji.putuskan` | Owner | setujui atau tolak (alasan wajib) pengajuan setting gaji; Owner boleh menyetujui pengajuannya sendiri |
| `master.akun-kategori` | Owner | bagan akun dan kategori aset |
| `master.nonaktifkan` | Owner | aktifkan/nonaktifkan data master (master tidak pernah dihapus) |
| `profil.ubah` | Owner | nama usaha |
| `pengguna.kelola` | Owner | kelola pengguna |

## 4. Status dan alur

Enum `StatusPersetujuan` (DRAFT, DIAJUKAN, DISETUJUI, DITOLAK) dipakai jurnal, pelepasan, opname, slip, penggajian, investasi kas (tanpa DRAFT). Pembelian memakai `StatusPembelian` = status persetujuan + DIBALIK. Label tampilan lewat `LencanaStatus`: pembelian DISETUJUI = "Diposting", slip DISETUJUI = "Dibayar".

| Dokumen | Alur |
|---|---|
| Investasi Kas | dibuat DIAJUKAN oleh Admin atau Owner (periode tanggal setoran harus terbuka) → Owner DISETUJUI (jurnal umum DISETUJUI bertanggal setoran, Dr 1-110 Kas, Kr 3-110 Modal Pemilik, sumber `INVESTASI_KAS`, periode harus terbuka) / DITOLAK (alasan wajib, tanpa jurnal) |
| Pembelian | DRAFT → (posting Admin/Owner) DISETUJUI → (balik Owner) DIBALIK |
| Jurnal penyusutan | dibuat langsung DISETUJUI saat Admin memproses (tidak bisa diajukan atau ditolak; `PESAN_PENYUSUTAN_OTOMATIS`) |
| Jurnal penyesuaian nilai sisa (opname) | dibuat DRAFT → Admin ajukan DIAJUKAN → Owner DISETUJUI / DITOLAK |
| Jurnal otomatis (pembelian, pelepasan, penggajian, fee event, investasi kas, pembalik, saldo awal) | dibuat langsung DISETUJUI |
| Opname | ikut status jurnalnya; total beban 0 = langsung DISETUJUI tanpa jurnal |
| Pelepasan | dibuat DIAJUKAN → Owner DISETUJUI (jurnal umum dibuat, aset DILEPAS, jadwal yang belum dijurnal dihapus) / DITOLAK |
| Setting gaji | dibuat DIAJUKAN oleh HRD atau Owner (bulan berlaku harus periode terbuka) → Owner DISETUJUI (tanpa jurnal, berlaku mulai bulan itu) / DITOLAK (alasan wajib). Baris tidak pernah ditimpa |
| Versi nominal | dibuat DIAJUKAN oleh HRD atau Owner (tarif event hanya Owner; bulan berlaku harus periode terbuka) → Owner DISETUJUI (tanpa jurnal, berlaku mulai bulan itu) / DITOLAK (alasan wajib). Baris tidak pernah ditimpa |
| Slip | DRAFT (boleh dihitung ulang/hapus) → DIAJUKAN (bersama penggajian) → DISETUJUI (dibayar); bila penggajian ditolak slip kembali DRAFT, `penggajianNo` dikosongkan, `alasanTolak` diisi |
| Penggajian | dibuat DIAJUKAN → Owner DISETUJUI (cek saldo kas ≥ total THP, jurnal umum dibuat, slip DISETUJUI) / DITOLAK |
| Event (fee event) | `StatusEvent`: PENILAIAN (HRD mencatat, kapten menilai) → kapten kirim laporan → DIAJUKAN (data terkunci) → Owner setujui → SELESAI; Owner tolak → kembali PENILAIAN dengan `alasan_tolak` |
| Laporan fee | dibuat DIAJUKAN saat kapten mengirim → Owner DISETUJUI (cek saldo kas ≥ total dibayar, periode tanggal selesai event terbuka, jurnal umum DISETUJUI, slip fee per orang) / DITOLAK (tetap tersimpan sebagai jejak; kiriman ulang = nomor baru) |
| Slip fee | dibuat saat laporan disetujui, selalu tampil "Dibayar" |

Efek penolakan jurnal penyesuaian ke sumbernya sudah ditulis di `src/lib/server/jurnal.ts` (`ajukanJurnal`, `setujuiJurnal`, `tolakJurnal`). Agen pelaporan cukup memanggilnya dari server action. `ajukanJurnal` dan `tolakJurnal` menolak jurnal penyusutan.

Keputusan jurnal penyesuaian nilai sisa bisa diambil di dua halaman: Jurnal Penyesuaian dan Nilai Sisa Perlengkapan. Keduanya memakai komponen `AksiJurnal` dan server action yang sama (`ajukanJurnalPenyesuaian`, `setujuiJurnalPenyesuaian`, `tolakJurnalPenyesuaian` di `src/lib/aksi/pelaporan/jurnal.ts`), jadi izin dan aturan "pembuat tidak boleh menyetujui jurnalnya sendiri" hanya ada di satu tempat. Riwayat dibaca lewat `riwayatJurnalSumber` (`src/lib/data/konversi/persetujuan.ts`); nama pengaju diambil dari log `jurnal.ajukan` karena tabel jurnal hanya menyimpan waktunya. Jurnal penyusutan tidak punya tombol keputusan di halaman mana pun (lihat "Penyusutan otomatis").

Hanya jurnal DISETUJUI yang masuk buku besar dan neraca saldo. Laporan mengikuti tahap siklus akuntansi untuk periode P (`saringTahap` di `src/lib/inti/buku-besar.ts`):

- **Sebelum penyesuaian**: semua jurnal DISETUJUI di periode sebelum P (semua jenis, karena penyesuaian periode lalu sudah menjadi saldo awal) ditambah jurnal UMUM dan PEMBALIK di periode P.
- **Setelah penyesuaian**: semua jurnal DISETUJUI sampai P. Sama dengan saldo lengkap yang dipakai dashboard, tutup periode, dan cek saldo kas (`saldoAkun`, `neracaSaldo` tanpa saringan).

Periode dikunci berurutan: periode P hanya boleh dikunci bila semua periode sebelum P sudah terkunci, dan hanya boleh dibuka bila tidak ada periode sesudah P yang terkunci. Periode P tertutup bila P sendiri atau periode sesudahnya terkunci; periode tertutup menolak jurnal dan dokumen baru bertanggal di dalamnya, juga persetujuan dan penolakan jurnal penyesuaiannya (`buatJurnal`, `ajukanJurnal`, `setujuiJurnal`, `tolakJurnal` sudah memeriksa).

## 5. Konvensi server action

Contoh lengkap: `src/lib/aksi/konversi/pembelian.ts`.

```ts
"use server";
export async function namaAksi(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["kunci.izin"]);   // 1. cek peran, selalu paling awal
    const d = validasi(skemaZod, input);                     // 2. validasi zod, galat per isian otomatis
    await db.$transaction(async (tx) => {                    // 3. semua tulis dalam satu transaksi
      const n = await tx.dok.updateMany({ where: { no, status: "DRAFT" }, data: { status: "DIAJUKAN" } });
      if (n.count !== 1) throw new GalatAksi("Dokumen sudah diproses pengguna lain.");   // klaim status bersyarat
      await buatJurnal(tx, { ... });                         // jurnal lewat layanan bersama
      await catatLog(tx, pengguna.id, "dok.ajukan", "dok", no);
    });
    segarkan();                                              // 4. revalidate semua halaman
    return { pesan: "Pesan sukses untuk toast." };
  });
}
```

Aturan:
- Input berupa objek biasa (bukan FormData), divalidasi zod. Skema ditaruh di `src/lib/skema/` supaya bisa dipakai form klien.
- Galat untuk pengguna dilempar sebagai `GalatAksi` (boleh dengan peta `galatIsian`, kunci = path zod seperti `baris.0.harga`). Galat lain disembunyikan dan dicatat di log server.
- Perubahan status selalu lewat `updateMany` bersyarat status lama, lalu periksa `count`, supaya dua klik bersamaan tidak sama-sama lolos.
- Cek periode tertutup memakai `pastikanTerbuka(tx, periode)` (otomatis di `buatJurnal`), selalu di dalam transaksi: fungsi ini memegang kunci advisory bersama sampai commit, sedangkan aksi kunci/buka periode memegang kunci eksklusif, jadi periode tidak bisa dikunci di tengah posting. Jangan memeriksa status baris periode sendiri. Baris periode baru dibuat dengan `pastikanPeriode`.
- Setiap aksi yang mengubah data mencatat `catatLog`.
- Nilai rupiah selalu bilangan bulat. Hitungan memakai fungsi di `src/lib/inti`, jangan menulis ulang rumus di komponen.
- Tanggal di database kolom `@db.Date`: tulis dengan `keDate("2026-10-05")`, baca dengan `dariDate(d)`. Periode di kode dan relasi selalu string `"YYYY-MM"`; di URL dan layar dipisah menjadi Bulan dan Tahun (lihat Keputusan "Bulan dan Tahun dipisah"). Hari ini: `hariIni()` (zona Asia/Jakarta).

Di klien: `useAksi()` untuk menjalankan aksi (memuat, toast, refresh), atau `TombolAksi` untuk tombol satu aksi dengan dialog konfirmasi (`perluAlasan` untuk tolak/balik/buka kunci).

## 6. Konvensi halaman

- `page.tsx` adalah komponen server. Panggil `wajibMasuk()` (atau `wajibPeranHalaman([...])`) di awal, walau layout sudah memeriksa.
- Data dibaca lewat fungsi di `src/lib/data/<siklus>/`. Yang dikirim ke komponen klien harus objek biasa (tanggal sudah jadi string).
- Keadaan halaman (periode terpilih, form terbuka, dokumen yang dilihat) disimpan di query string, contoh `?bulan=10&tahun=2026`, `?form=baru`, `?lihat=BP-2026-0001`. Pemilih periode memakai `PilihBulanTahun`, server membaca `periodeDariCari`, tautan dibuat dengan `denganPeriode`.
- Pakai komponen `src/komponen/ui`: `KepalaHalaman`, `Kartu`/`KepalaKartu`, `KartuRingkasan`, `Tabel`/`BarisKosong`, `Bidang`/`Isian`/`Pilihan`/`AreaTeks`/`IsianRupiah`, `Tombol`/`TautanTombol`, `TombolAksi`, `DialogKonfirmasi`, `LencanaStatus`, `Rupiah`, `TabelJurnal`, `Peringatan`, `KeadaanKosong`. Jangan menulis gaya baru kalau komponennya sudah ada; kalau butuh komponen bersama baru, minta ke koordinator.
- Teks UI dan komentar berbahasa Indonesia. Hindari tanda pisah panjang di teks.

## 7. Format nomor dokumen

Dibuat oleh `src/lib/server/nomor.ts`, penghitung atomik di tabel `penghitung` (melanjutkan angka data contoh).

| Dokumen | Format | Fungsi |
|---|---|---|
| Jurnal umum / penyesuaian / pembalik | `JU-2026-0012`, `JP-2026-0003`, `JB-2026-0001` | otomatis di `buatJurnal` |
| Pembelian peralatan / perlengkapan | `BP-2026-0008`, `BL-2026-0003` | `nomorDokumen(tx, AWALAN.PEMBELIAN_PERALATAN, tanggal)` |
| Pelepasan | `PLP-2026-0002` | `nomorDokumen(tx, AWALAN.PELEPASAN, tanggal)` |
| Penggajian | `PAY-2026-0002` (tahun dari hari terakhir periode) | `nomorDokumen(tx, AWALAN.PENGGAJIAN, hariTerakhir(periode))` |
| Event | `EVT-2026-0001` (tahun dari tanggal mulai) | `nomorDokumen(tx, AWALAN.EVENT, tanggalMulai)` |
| Laporan fee | `FEE-2026-0001` (tahun dari tanggal selesai event) | `nomorDokumen(tx, AWALAN.LAPORAN_FEE, tanggalSelesai)` |
| Investasi Kas | `INV-2026-0003` (tahun dari tanggal setoran; penghitung `INV2026` melanjutkan hasil backfill dan seed) | `nomorDokumen(tx, AWALAN.INVESTASI_KAS, tanggal)` |
| Slip fee | `SFE-EVT-2026-0001-KRY-06` (satu per orang per event) | `nomorSlipFee(eventKode, karyawanKode)` |
| Aset | `AST-0010` | `kodeBerikutnya(tx, AWALAN.ASET, 4)` |
| Master | `SUP-04`, `ALT-07`, `LKP-06`, `KAT-05`, `KRY-06`, `JBT-05`, `GP-05`, `TNJ-05`, `TM-05` | `kodeBerikutnya(tx, AWALAN.X)` |
| Versi setting gaji | `SET-08` (satu kode per versi, melanjutkan kode setting lama) | `kodeBerikutnya(tx, AWALAN.SETTING_GAJI)` |
| Versi nominal | `NOM-0021` (satu kode per versi, penghitung `NOM` melanjutkan hasil migrasi atau seed) | `kodeBerikutnya(tx, AWALAN.VERSI_NOMINAL, 4)` |
| Akun | kode diketik Owner (`1-110`), tidak bisa diubah sesudah dibuat | |
| Opname | `OPN-2026-10` (satu per periode) | `nomorOpname(periode)` |
| Slip | `SLP-2026-10-KRY-01` (satu per karyawan per periode) | `nomorSlip(periode, kode)` |

## 8. Pembagian kerja tiga agen

Setiap agen hanya menulis di folder miliknya. Berkas bersama (`prisma/`, `src/lib/inti`, `src/lib/server`, `src/lib/peran.ts`, `src/lib/format.ts`, `src/lib/menu.ts`, `src/komponen/ui`, `src/komponen/kerangka`, `src/app/globals.css`, `src/app/(aplikasi)/layout.tsx`) **tidak diubah**; kebutuhan perubahan dilaporkan ke koordinator. Skema tidak boleh diubah tanpa migrasi baru dari koordinator.

**Agen konversi**
- Folder: `src/app/(aplikasi)/konversi/**`, `src/lib/aksi/konversi/**`, `src/lib/data/konversi/**`, `src/lib/skema/` (berkas baru untuk konversi), `src/komponen/konversi/**`, `tests/konversi-*.test.ts`.
- Kerjakan: nilai sisa (opname, jurnal penyesuaian draf, rumus saldo buku perlengkapan dari pembelian DISETUJUI dikurangi opname tidak ditolak di periode sebelumnya), proses penyusutan (urutan periode, satu jurnal per periode berkelompok akun, isi `jurnalNo` di jadwal), kartu aset (rumus dengan angka asli, akumulasi dari jadwal yang jurnalnya DISETUJUI), pelepasan (ajukan, setujui, tolak), tambah cepat master dari form pembelian.
- Opname unik per periode (`periode 1:0..1 opname`): input ulang sesudah ditolak memperbarui baris `OPN-YYYY-MM` yang sama (ganti detail, jurnal draf baru, status DRAFT), jurnal lama yang ditolak tetap ada.
- Opname berurutan per bulan (`tahanUrutanNilaiSisa` di `src/lib/data/konversi/hitung.ts`): bulan sebelumnya harus DISETUJUI atau tidak bersaldo, dan bulan M tidak bisa diinput atau diubah bila bulan sesudah M sudah punya opname yang tidak ditolak (biaya akan terhitung dua kali). Bulan terlewat hanya dihitung sesudah opname terakhir (`awalUrutanNilaiSisa`), jadi pembelian bertanggal mundur ke bulan sebelum opname terakhir ikut masuk saldo bulan berikutnya, bukan menahan input. Biaya yang membuat saldo akun Perlengkapan minus ditolak saat input dan saat jurnalnya disetujui.
- **Batas proses penyusutan dan nilai sisa**: periode paling jauh Desember tahun berjalan (`periodeBatasProses` di `src/lib/inti/tanggal.ts`), bukan lagi bulan berjalan, supaya jurnal penyesuaian Desember bisa dilihat dan dibuat lebih awal. Aturan urutan tetap: penyusutan menolak bila periode lebih lama belum diproses, nilai sisa menolak bila bulan sebelumnya belum final. Periode sesudah batas ditolak aksinya dan halamannya menampilkan peringatan (tombol nonaktif). Halaman memakai bulan yang dipilih apa adanya; bulan tanpa jadwal atau saldo tampil kosong.
- Daftar periksa Tutup Periode hanya meminta opname bila `saldoBukuLkp(P)` masih punya perlengkapan bersaldo; bulan bersaldo nol (input ditolak "Tidak ada perlengkapan untuk dihitung") lulus dengan catatan "tidak ada saldo perlengkapan".
- Acuan lama: `nilai-sisa.js`, `penyusutan.js`, `aset.js`, `pelepasan.js`, `ledger.js` (`saldoBukuLkp`).

**Agen SDM**
- Folder: `src/app/(aplikasi)/sdm/**`, `src/lib/aksi/sdm/**`, `src/lib/data/sdm/**`, `src/komponen/sdm/**`, `tests/sdm-*.test.ts`.
- Kerjakan: presensi (terlambat dihitung dari jadwal kerja jabatan, unik per karyawan per tanggal, terkunci bila slip periodenya bukan DRAFT), hitung gaji (pakai `hitungGaji` dari `src/lib/inti/penggajian.ts`, simpan ke `slip_gaji` + `slip_tunjangan`), distribusi (ajukan, setujui dengan cek saldo kas `saldoAkun(tx, AKUN.KAS)`, jurnal `barisGaji`, tolak).
- Acuan lama: `presensi.js`, `gaji.js`, `distribusi.js`, `penggajian.js`.

**Agen pelaporan dan master**
- Folder: `src/app/(aplikasi)/page.tsx`, `src/app/(aplikasi)/pelaporan/**`, `src/app/(aplikasi)/master/**`, `src/app/(aplikasi)/pengguna/**`, `src/lib/aksi/{pelaporan,master,pengguna}/**`, `src/lib/data/{pelaporan,master}/**`, `src/komponen/{pelaporan,master,dashboard}/**`, `tests/pelaporan-*.test.ts`.
- Kerjakan: jurnal penyesuaian (panggil `ajukanJurnal`/`setujuiJurnal`/`tolakJurnal`), jurnal umum, buku besar dan neraca saldo (`muatJurnalBuku` + `src/lib/inti/buku-besar.ts`), tutup periode (daftar periksa seperti `cekPeriode` lama, riwayat di `riwayat_periode`), master konversi dan SDM (CRUD + nonaktifkan, validasi seperti `MDEF` lama), pengguna (buat, ubah peran, reset kata sandi dengan `hashKataSandi`, nonaktifkan, hapus sesi saat dinonaktifkan; Owner tidak boleh menonaktifkan dirinya sendiri), dashboard lengkap (daftar "Perlu tindakan").
- Acuan lama: `jurnal-penyesuaian.js`, `laporan.js`, `periode.js`, `master.js`, `dashboard.js`.

Selesai mengerjakan: `npm run cek-tipe`, `npm run lint`, `npm run uji`, dan `npm run build` harus lulus.

## 9. Keputusan yang perlu diketahui

- `src/lib/skema/sdm.ts` (skema presensi, hitung gaji, dan distribusi) sudah disahkan sebagai berkas bersama bersama skema lain di folder itu.
- Gaya `@media print` ada di `src/app/globals.css` (bagian "Cetak"). Tandai elemen yang tidak ikut tercetak dengan `.tanpa-cetak`, judul khusus kertas dengan `.hanya-cetak`, dan tiap slip dengan `.slip-cetak`.
- `allowedDevOrigins: ["127.0.0.1"]` ada di `next.config.ts` supaya dev server bisa diakses lewat 127.0.0.1 (Playwright).
- Tabel Hitung Gaji tampil sebagai kartu ringkas di layar sempit (di bawah `md`), tabel penuh di layar lebar.
- Kolom "Saldo buku" di Master Perlengkapan memakai `saldoBukuLkp` dari bagian konversi (periode berjalan).
- Pembelian punya nilai DIAJUKAN dan DITOLAK di enum (memenuhi audit), tetapi alur lama tidak memakainya: posting oleh Admin atau Owner langsung DISETUJUI.
- Penggajian yang ditolak tidak lagi punya slip (slip dikembalikan ke DRAFT supaya bisa diajukan ulang). Jumlah dan total slip tetap tersimpan di header penggajian sebagai jejak.
- Nilai rupiah kolom `Int` (maksimal Rp2.147.483.647 per nilai). Skema zod membatasi harga dan total pembelian Rp2 miliar.
- `dibuat_oleh`, `disetujui_oleh`, `dikunci_oleh` sekarang kunci asing ke `pengguna`, bukan teks peran.
- Kunci periode berurutan (audit putaran kedua): tanpa aturan ini November bisa dikunci saat Oktober masih terbuka, lalu pembelian bertanggal 30 Oktober ikut mengubah saldo November. Halaman Tutup Periode hanya menampilkan tombol kunci atau buka yang sesuai urutan.
- Skema zod mengimpor `z` dari `src/lib/skema/zod.ts`, bukan dari `"zod"`, supaya pesan bawaan (isian tidak terkirim, tipe salah) berbahasa Indonesia di server maupun form klien. Pesan per isian tetap ditulis di skemanya.
- Petunjuk akun demo di halaman masuk hanya tampil bila `TAMPILKAN_AKUN_DEMO=1` (`.env.example` dan server uji E2E), tidak di docker-compose maupun VPS.
- Periode bawaan halaman SDM = periode berjalan, sama dengan dashboard. Tautan cepat dashboard ke halaman berperiode membawa `?bulan=&tahun=` yang sedang dipilih; tautan "Perlu tindakan" SDM membawa periode pekerjaan yang tertunda.
- Kartu penyusutan di dashboard ("Beban penyusutan", dulu "Beban penyusutan disetujui") mengambil angkanya hanya dari jurnal penyusutan yang disetujui, jadi aset yang dilepas sesudah penyusutannya disetujui tetap terhitung. Jurnal yang masih draf atau diajukan tidak pernah dipakai sebagai angka kartu; jumlahnya disebut di keterangan ("menunggu persetujuan"), begitu juga beban yang belum diproses. Kartu aset menghitung "disetujui" dan "menunggu persetujuan" terpisah. Tabel halaman Proses Penyusutan juga memuat baris aset yang sudah dilepas (diberi lencana "dilepas"), sehingga total tabel sama dengan jurnal periodenya.
- Kontrol form (`Isian`, `Pilihan`, `AreaTeks`, `IsianRupiah`) otomatis menunjuk pesan galat `<id>-galat` lewat `aria-describedby`. Form yang memakai galat per isian memanggil `useFokusGalat` supaya isian salah pertama difokuskan sesudah kirim gagal. Laci menu layar kecil `inert` saat tertutup, Esc menutupnya, dan fokus pindah ke "Tutup menu" lalu kembali ke "Buka menu".

- Siklus akuntansi tampil berurutan di menu Jurnal & laporan: Jurnal Umum, Buku Besar, Neraca Saldo, Jurnal Penyesuaian, Tutup Periode. Buku Besar dan Neraca Saldo punya pilihan tahap (`?tahap=sebelum|setelah`, bawaan `setelah` supaya tautan lama bermakna sama); judul layar dan cetak ikut tahapnya ("Neraca Saldo Setelah Penyesuaian"). Tidak ada item menu terpisah per tahap; halaman Jurnal Penyesuaian memberi tautan cepat "Lihat setelah penyesuaian".
- Jurnal PEMBALIK masuk tahap sebelum penyesuaian, sama dengan jurnal UMUM. Alasannya: jurnal pembalik hanya dibuat oleh `balikPembelian` (`src/lib/aksi/konversi/pembelian.ts`) untuk membatalkan jurnal transaksi pembelian, langsung DISETUJUI, dan bertanggal hari pembalikan. Isinya koreksi transaksi, bukan penyesuaian akhir periode, jadi harus sudah tercermin di neraca saldo sebelum penyesuaian.
- Buku besar tahap setelah: mutasi UMUM dan PEMBALIK periode P tampil lebih dulu, lalu baris "Saldo sebelum penyesuaian", lalu mutasi jurnal penyesuaian P yang diberi lencana "Penyesuaian" (`bukuBesarTahap`). Jurnal penyesuaian selalu bertanggal hari terakhir periode, jadi urutan ini hanya menegaskan batas tahap.
- Neraca saldo tahap setelah berbentuk neraca lajur ringkas (`neracaLajur`): kolom Neraca Saldo (tahap sebelum), Penyesuaian (jumlah debit dan kredit jurnal penyesuaian P per akun, tidak dinetokan, jadi totalnya sama dengan total jurnal penyesuaian), dan Setelah Penyesuaian, masing-masing debit dan kredit dengan total dan tanda seimbang. Per akun berlaku neraca saldo + penyesuaian = setelah penyesuaian. Di bawah `md` neraca lajur tampil sebagai kartu ringkas per akun; saat dicetak selalu tabel penuh.

### Penyusutan otomatis (masukan dosen, 25 Nov 2026)

Kata dosen: "alat tidak bisa ditolak". Beban penyusutan dihitung dari jadwal aset yang dibuat saat pembelian diposting, jadi tidak ada yang perlu disetujui.

- **Alur**: Admin memilih bulan di Proses Penyusutan, pratinjau beban per aset tampil, lalu tombol "Proses penyusutan" menjalankan `prosesPenyusutanDalam` (`src/lib/server/penyusutan.ts`, dipakai server action dan seed). Jurnal penyesuaian dibuat langsung DISETUJUI bertanggal hari terakhir periode, pembuat dan penyetuju = Admin yang memproses, lalu masuk buku besar. Owner dan HRD hanya melihat halaman dan jurnalnya.
- **Aturan yang tetap**: urutan periode (periode lebih lama harus diproses dulu), batas `periodeBatasProses`, dan kunci periode (`pastikanTerbuka` di `buatJurnal`).
- **Tanpa tolak**: tombol Ajukan, Setujui, dan Tolak untuk jurnal penyusutan dihapus dari halaman Penyusutan dan Jurnal Penyesuaian (`AksiJurnal` tidak menampilkan apa pun untuk sumber `PENYUSUTAN`). `ajukanJurnal` dan `tolakJurnal` menolak jurnal penyusutan dengan `PESAN_PENYUSUTAN_OTOMATIS`. Jurnal penyusutan lama yang berstatus DITOLAK tetap terbaca sebagai riwayat.
- **Migrasi** `20261125090000_penyusutan_otomatis`: jurnal penyusutan lama yang masih DRAFT atau DIAJUKAN disetujui (penyetuju = pembuatnya), karena jalannya di aplikasi sudah tidak ada. Debit, kredit, nomor, dan tanggal tidak berubah.
- **Peringatan**: dashboard, Buku Besar, dan Neraca Saldo menampilkan `PeringatanPenyusutan` bila ada bulan sampai periode laporan yang jadwal penyusutannya belum diproses (`bulanPenyusutanBelum`), dengan tautan ke bulan paling lama. Kartu dashboard bernama "Beban penyusutan" (dari jurnal penyusutan yang sudah diproses).

### Fee event (crew freelance per event)

Revisi modul penggajian: sekarang ada dua jenis penggajian. Konsepnya mengikuti app absen D'Production (dproabsent, `src/lib/upah.js`), disederhanakan untuk SIA.

- **Jenis karyawan** (`karyawan.jenis`): `INHOUSE` (gaji tetap bulanan: presensi, setting gaji, Hitung Gaji, Distribusi) atau `EVENT` (crew freelance, fee per event). Data lama otomatis `INHOUSE` lewat nilai bawaan kolom di migrasi `20261122140000_fee_event`. Presensi, Hitung Gaji, Setting gaji, dan Jadwal kerja hanya untuk karyawan dan jabatan inhouse (dicek di data dan server action). Jenis tidak bisa diubah bila karyawan sudah punya data di jalur lain.
- **Kelompok jabatan** (`jabatan.kelompok`): jabatan `EVENT` punya `peran_event` (KAPTEN/CREW), `satuan_tarif` (HARI/JAM), dan `tarif`. Dikelola di bagian "Jabatan event" pada tab Master SDM "Struktur gaji" (izin `tarif-event.ubah`, Owner saja); bagian "Jabatan inhouse" hanya menampilkan dan mengubah jabatan inhouse. Bawaan: Kapten Event Rp200.000 per hari, Crew Event Rp20.000 per jam, akun biaya baru `6-230 Biaya Fee Crew Event (Freelance)`. Migrasi menambah akun dan dua jabatan ini di database yang sudah berisi bagan akun; database kosong diisi seed. Peran dan satuan tarif jabatan yang sudah dipakai penugasan tidak bisa diubah. Tarif berversi: perubahan diajukan Owner dengan bulan berlaku dan disetujui Owner, dan fee memakai tarif yang berlaku di bulan tanggal selesai event (lihat "Riwayat nominal master").
- **Struktur**: `event` 1:N `sesi_event` (Meeting, Loading in, Hari H, Loading out; jam selesai harus sesudah jam mulai di hari yang sama, sesi lewat tengah malam dipecah dua), `event` 1:N `penugasan_event` (satu orang satu penugasan per event; kapten boleh lebih dari satu dan diganti dengan mengubah jabatan penugasannya), `sesi_event` 1:N `kehadiran_event` (satu per orang per sesi, hanya orang yang ditugaskan), `event` 1:N `laporan_fee`, `laporan_fee` 1:N `slip_fee`.
- **Rumus** (`src/lib/inti/fee-event.ts`, dites di `tests/fee-event.test.ts`): menit tercatat = jam masuk sampai pulang yang dipotong ke jadwal sesi (menit penuh). SESUAI atau belum dinilai = menit tercatat diakui penuh; KURANG = jam diakui isian penilai, tidak pernah lebih dari menit tercatat. Tarif per jam: menit diakui x tarif / 60, dibulatkan ke rupiah. Tarif per hari: jumlah tanggal berbeda yang punya menit diakui > 0 x tarif. Menit di atas 8 jam per sesi ditampilkan sebagai lembur dengan tarif yang sama.
- **Penilaian**: kapten menilai kehadiran crew di event miliknya selama PENILAIAN; tidak boleh menilai dirinya sendiri atau kapten lain. Kehadiran kapten dinilai Owner (di halaman keputusan, selama PENILAIAN atau DIAJUKAN); yang belum dinilai Owner dihitung sesuai catatan HRD. Mengubah jam sesi, data kehadiran, atau peran penugasan menghapus penilaian yang terkait supaya kapten menilai ulang.
- **Laporan dan keputusan**: kapten mengirim laporan (catatan umum opsional) setelah semua kehadiran crew dinilai. Owner melihat daftar KURANG beserta catatan kapten secara menonjol, boleh mengubah fee akhir per orang (alasan wajib bila berbeda dari usulan, disimpan di slip), lalu Setujui atau Tolak (alasan wajib, tampil ke kapten dan HRD). Semua aksi yang mengubah event mengunci baris event (`kunciEvent`, `SELECT ... FOR UPDATE`) supaya perubahan HRD, penilaian, kiriman laporan, dan keputusan Owner tidak saling menyalip.
- **Jurnal fee**: satu jurnal umum DISETUJUI bertanggal **tanggal selesai event** (periode itu harus terbuka): Dr akun biaya jabatan (bruto = fee akhir), Kr `2-120 Utang PPh 21`, Kr `1-110 Kas` (yang dibayar). Sumber jurnal `FEE_EVENT`, `sumber_id` = nomor laporan. Saldo kas harus cukup, sama dengan alur penggajian. Pembuat dan penyetuju jurnal = Owner yang menyetujui.
- **Asumsi PPh 21 event**: crew freelance diperlakukan sebagai penerima penghasilan bukan pegawai yang tidak berkesinambungan: DPP = 50% x bruto, PPh 21 = 5% x DPP (tarif lapis pertama Pasal 17), tanpa PTKP dan tanpa akumulasi setahun. Rumus pegawai tetap yang sudah ada (`hitungPph21`, disetahunkan dengan biaya jabatan dan PTKP) tidak cocok untuk fee per event, jadi tidak dipakai. Ini simulasi untuk tugas, sama seperti PPh 21 inhouse.
- **Privasi kapten**: halaman dan dashboard kapten tidak menampilkan tarif, fee, atau angka keuangan; kapten hanya melihat jam dan catatan progres. Pesan galat untuk event milik kapten lain sama dengan event yang tidak ada.
- **Data contoh** (seed): `EVT-2026-0001` Gathering Tahunan PT Sinar Abadi (4 sesi, kapten Bima Satria + 4 crew, satu penilaian KURANG, laporan `FEE-2026-0001` menunggu Owner, usulan Rp2.255.000) dan `EVT-2026-0002` Wedding Expo Malang (menunggu penilaian kapten Sari Wulandari). Seed fee event tidak membuat jurnal, jadi angka data lama (neraca Oktober, nomor jurnal berikutnya) tidak berubah. Akun contoh: `kapten` (KRY-06) dan `kapten2` (KRY-07).

### Investasi Kas (modal pemilik)

Alasan fitur: aplikasi ini sengaja hanya mencakup siklus konversi (peralatan, perlengkapan) dan siklus SDM (gaji inhouse, fee event), tanpa siklus pendapatan dan pengeluaran. Jadi kas yang dipakai untuk pembelian tunai, gaji, dan fee tidak berasal dari penjualan, tetapi dari setoran modal pemilik. Investasi Kas mencatat setoran itu sebagai dokumen dengan alur persetujuan, supaya pertanyaan "kas dan modal diambil dari mana" terjawab di aplikasi, lengkap dengan jejak ke jurnalnya.

- **Tabel** `investasi_kas`: `no_investasi`, `tanggal`, `jumlah`, `keterangan` (sumber dana), `status`, `alasan_tolak`, `jurnal_no` (unik, FK ke jurnal), `dibuat_oleh/pada`, `diputuskan_oleh/pada`. CHECK di migrasi: jumlah > 0, status bukan DRAFT, DISETUJUI wajib punya jurnal (dan sebaliknya), DITOLAK wajib beralasan. Karena CHECK ini, aksi setujui membuat jurnal dulu lalu mengklaim status lewat `updateMany` bersyarat; persetujuan ganda gagal di klaim dan seluruh transaksinya (termasuk jurnal dan nomornya) dibatalkan.
- **Setoran barang** tetap lewat pembelian dengan cara bayar Investasi (Dr aset atau perlengkapan, Kr 3-110). Investasi Kas khusus setoran uang.
- **Migrasi** `20261123090000_investasi_kas_enum` (nilai enum `INVESTASI_KAS`, dipisah karena PostgreSQL tidak boleh memakai nilai enum baru di transaksi yang sama) dan `20261123090100_investasi_kas` (tabel, CHECK, backfill). Backfill: jurnal `SALDO_AWAL` DISETUJUI berjenis UMUM yang berisi tepat dua baris Dr 1-110 dan Kr 3-110 bernilai sama menjadi setoran DISETUJUI (nomor urut tanggal lalu nomor jurnal per tahun, pembuat dan penyetuju disalin dari jurnalnya), penghitung `INV<tahun>` diisi, lalu `sumber_tipe` dan `sumber_id` jurnal itu dipindah ke `INVESTASI_KAS` dan nomor setorannya. Debit, kredit, nomor, tanggal, dan keterangan jurnal tidak berubah, jadi neraca dan buku besar tetap sama. Database kosong: backfill tidak menemukan apa pun.
- **Keputusan sumber jurnal**: jurnal setoran lama diubah sumbernya ke `INVESTASI_KAS` supaya jejaknya sama dengan dokumen lain (jurnal menunjuk dokumen sumber, dokumen menunjuk jurnal) dan ringkasan cukup menggolongkan per sumber. Nilai `SALDO_AWAL` tetap ada di enum; jurnal SALDO_AWAL yang tidak berpola setoran (misalnya dari `prisma/tambah-dummy.ts` bila dijalankan lagi di database baru) tidak dipindah dan tampil di pos "lainnya" ringkasan.
- **Seed**: dua setoran data contoh (JU-2026-0001 Rp30.000.000 dan JU-2026-0010 Rp75.000.000) menjadi INV-2026-0001 dan INV-2026-0002 dengan aturan yang sama dengan backfill, jadi nomor jurnal berikutnya tetap JU-2026-0012 dan neraca Oktober tetap Rp145.622.573.
- **Ringkasan "Dari mana kas dan modal"** (`ringkasModal` di `src/lib/inti/modal.ts`, dites di `tests/modal.test.ts`): dihitung dari jurnal DISETUJUI per periode atau kumulatif. Modal Pemilik = setoran kas (sumber INVESTASI_KAS) + setoran barang (sumber PEMBELIAN, pembaliknya mengurangi) + lainnya. Kas masuk = Investasi Kas + hasil penjualan aset (PELEPASAN) + lainnya; kas keluar = siklus konversi (pembelian tunai dikurangi pembaliknya; pelunasan utang usaha belum ada di aplikasi) + siklus SDM (PENGGAJIAN, FEE_EVENT) + lainnya. Setiap baris jurnal Kas dan Modal masuk tepat satu pos, jadi saldo akhir ringkasan selalu sama dengan saldo buku besar; halaman membandingkannya dengan `saldoAkun` dan menampilkan lencana "sama dengan buku besar".
- **Kas kurang**: persetujuan penggajian dan fee event menolak dengan `pesanKasKurang` (menyebut kekurangannya dan mengarahkan ke menu Investasi Kas); peringatan di halaman Distribusi Gaji dan keputusan fee memberi tautan ke form setoran. Posting pembelian tunai juga memeriksa saldo kas (lihat Keputusan "Cek kas pembelian tunai").
- **Dashboard dan menu**: Owner melihat "N setoran modal menunggu keputusan" di Perlu tindakan, dan lencana angka di menu Investasi Kas. Menu ditaruh di grup baru **Modal pemilik** di atas Siklus konversi, karena kas dari setoran ini menjadi masukan kedua siklus; Jurnal & laporan berisi keluaran siklus akuntansi.

### Biaya tetap dan biaya variabel (siklus SDM)

- **Gaji inhouse = biaya tetap.** Komponennya (jabatan, golongan atau gaji pokok, tunjangan jabatan, tunjangan keluarga, tunjangan lain) diatur sekali di Master SDM, Setting Gaji, dan tidak dibuat ulang tiap bulan. Tiap bulan HRD cukup mengisi presensi lalu Hitung Gaji; yang berubah hanya potongan absen (gaji pokok / hari kerja x alpa), lalu PPh 21 dan THP. Terlambat tidak memotong gaji.
- **Fee crew event = biaya variabel**: tarif per jam x jam diakui (crew) atau tarif per hari x jumlah hari hadir (kapten), per event.
- Rumus tidak diubah (`hitungGaji`, `hitungSlipSemua`, `src/lib/inti/fee-event.ts`). Yang ditambah hanya tampilan: label grup menu "Siklus SDM: gaji inhouse (biaya tetap)" dan "Siklus SDM: fee event (biaya variabel)", lencana Biaya tetap atau Biaya variabel di judul halaman Presensi, Hitung Gaji, Distribusi Gaji, Event & Kehadiran, Laporan & Fee, slip gaji, dan slip fee.
- **Hitung Gaji**: panel penjelasan komponen tetap lawan isian bulanan, dan tabel "Kesiapan gaji" per karyawan inhouse aktif (setting gaji berlaku di bulan itu atau tidak, presensi x dari y hari, status slip, tautan ke Setting Gaji atau Presensi bila belum siap; `kesiapanGaji` di `src/lib/data/sdm/gaji.ts`).
- **Slip gaji** (layar dan cetak) dua blok: "Komponen tetap (dari Setting Gaji)" dan "Penyesuaian bulan ini (dari presensi)" berisi rekap hadir, izin, sakit, cuti, alpa, terlambat, potongan absen beserta rumusnya, bruto, PPh 21, THP.
- **Slip fee dan halaman keputusan** menampilkan rumus biaya variabel per orang, contoh "Rp20.000/jam x 6 jam 30 mnt diakui = Rp130.000".
- **Biaya SDM di ringkasan Investasi Kas** (`ringkasModal().biayaSdm`): biaya tetap = bruto jurnal PENGGAJIAN, biaya variabel = bruto jurnal FEE_EVENT (semua baris selain Kas dan Utang PPh 21), per periode atau kumulatif. Biaya tetap + biaya variabel - PPh 21 dipotong = kas keluar siklus SDM (dites dan ditampilkan dengan lencana "sama dengan kas keluar SDM"). Biaya dicatat bruto, sedangkan kas keluar sudah dikurangi PPh 21 yang menjadi utang.

### Riwayat setting gaji (promosi, demosi, penyesuaian)

Masalah lama: `simpanMaster` jenis `setgaji` menimpa baris `setting_gaji`, tanpa persetujuan, tanpa tanggal berlaku, dan log hanya "master.ubah". Riwayat hilang, dan slip draf bulan lalu yang dihitung ulang sesudah promosi ikut memakai gaji baru.

- **Struktur**: `setting_gaji` diperluas menjadi tabel riwayat (unique per karyawan dihapus). Satu baris = satu versi: karyawan, jabatan, golongan, tunjangan (`setting_tunjangan`), `berlaku_mulai` (FK ke `periode`), `jenis_perubahan` (SETTING_AWAL, PROMOSI, DEMOSI, PENYESUAIAN), `alasan`, `status` (DIAJUKAN, DISETUJUI, DITOLAK; CHECK tanpa DRAFT, DITOLAK wajib beralasan, keputusan wajib bertanggal), `alasan_tolak`, `diajukan_oleh/pada`, `diputuskan_oleh/pada`. Tidak dipakai tabel riwayat terpisah dengan `setting_gaji` sebagai penunjuk versi aktif, karena versi aktif bergantung pada bulan yang dihitung (November memakai versi lama, Desember versi promosi); penunjuk statis harus digeser tiap bulan dan bisa basi. Versi dipilih saat dibaca. Kolom lama `aktif` tetap ada: versi lama yang sudah dinonaktifkan dianggap tidak berlaku; versi baru selalu aktif dan tidak bisa dinonaktifkan (`ubahStatusMaster` menolak `setgaji`).
- **Pemilih versi** (`pilihVersiBerlaku` di `src/lib/inti/setting-gaji.ts`): periode P memakai versi DISETUJUI dengan `berlaku_mulai <= P` yang paling akhir; bila dua versi disetujui berlaku di bulan yang sama (koreksi), yang diputuskan belakangan menang dan yang lama tampil "digantikan". `muatBahanGaji`, `kesiapanGaji`, presensi (jadwal kerja dari jabatan versi bulan itu), dan Hitung Gaji memakai pemilih ini. Karyawan tanpa versi berlaku tampil "Belum ada setting gaji berlaku" di kesiapan, dengan catatan pengajuan yang menunggu atau versi yang baru berlaku nanti.
- **Pengaman** (`pengamanBerlaku`, dicek saat mengajukan dan sekali lagi saat menyetujui): bulan berlaku harus periode terbuka; karyawan belum punya slip DIAJUKAN atau DISETUJUI di bulan berlaku atau sesudahnya (pesan menyebut bulan paling awal yang boleh); bulan berlaku tidak lebih awal dari versi yang dipakai slip non-draf terakhir; tidak ada pengajuan DIAJUKAN lain untuk karyawan dan bulan yang sama; jenis SETTING_AWAL hanya untuk karyawan tanpa versi disetujui; isi yang sama persis dengan versi berlaku ditolak. Karyawan dan rujukannya (jabatan inhouse, golongan, tunjangan) harus aktif.
- **Slip draf**: persetujuan tidak menghapus slip draf. Slip menyimpan versi yang dipakai (`slip_gaji.id_setting`); slip draf dengan versi lain dari versi yang berlaku untuk bulannya ditandai "perlu dihitung ulang" dan `ajukanPenggajian` menolaknya sampai dihitung ulang. Alasannya: data tidak hilang diam-diam, dan gaji yang diajukan dan dibayar selalu sesuai setting yang berlaku. Peringatan muncul di form pengajuan (pratinjau), di kartu pengajuan Owner, di toast setujui, dan di Hitung Gaji.
- **Serialisasi**: kunci advisory 7410002 (eksklusif saat menyetujui, bersama saat Hitung Gaji dan pengajuan penggajian) dan `SELECT ... FOR UPDATE` baris karyawan saat mengajukan dan memutuskan.
- **Log**: `setting-gaji.ajukan`, `setting-gaji.setujui`, `setting-gaji.tolak` mencatat nilai lama (versi yang berlaku di bulan itu) dan baru: jabatan, golongan dan gaji pokok, tunjangan jabatan, tunjangan lain, berlaku mulai, alasan, dan slip draf yang terdampak (`keteranganLog`).
- **Masuk laporan keuangan periode apa**: mengajukan dan menyetujui setting gaji tidak membuat jurnal. Dampaknya muncul di slip dan penggajian bulan berlaku dan sesudahnya; jurnal gajinya bertanggal akhir bulan itu saat Owner menyetujui penggajiannya. Slip yang sudah diajukan atau dibayar tidak berubah, dan slip bulan sebelum bulan berlaku tetap memakai setting lama walau dihitung ulang. Teks ini tampil di halaman Setting Gaji dan Hitung Gaji.
- **Tampilan ringkas (masukan dosen)**: paragraf pembuka Setting Gaji satu kalimat; kolom Tunjangan di tabel berupa total dan jumlah komponen (rincian di tooltip dan di kartu Riwayat layar sempit); Riwayat satu baris per versi (kode, jenis atau lencana "Data awal" untuk versi SETTING_AWAL, berlaku mulai, jabatan dan golongan, estimasi, status, siapa dan kapan diputuskan); kotak pengajuan Owner berisi Sebelum dan Sesudah masing-masing tiga baris pendek.
- **Hitung Gaji** per baris menampilkan versi yang dipakai (kode, jabatan, golongan, berlaku mulai; slip terkunci memakai versi yang tersimpan di slip), versi lebih baru yang belum berlaku atau pengajuan yang menunggu, "Angka slip terkunci saat diajukan/dibayar", dan tombol "Hitung ulang" untuk slip draf yang perlu dihitung ulang. Hitung Gaji dan Distribusi punya ringkasan per tahun (12 bulan: belum ada presensi, presensi tanpa slip, slip draf, diajukan, dibayar, dan total THP).
- **Menu dan dashboard**: menu Setting Gaji di grup Siklus SDM gaji inhouse dengan lencana angka pengajuan yang menunggu (Owner); dashboard Owner menampilkan "N pengajuan setting gaji menunggu keputusan" di Perlu tindakan dan menghitungnya di kartu Menunggu persetujuan.
- **Migrasi** `20261123120000_setting_gaji_riwayat`: setiap setting lama menjadi versi DISETUJUI berjenis SETTING_AWAL, berlaku mulai bulan presensi atau slip pertama karyawan itu (atau 2026-10), pengaju dan waktunya dari log `master.tambah` bila ada. Nilai lama setting yang pernah ditimpa (log `master.ubah`) tidak tersimpan di mana pun, jadi isi sekarang menjadi versi awal. Slip lama diberi `id_setting` hanya bila jabatan, golongan, dan tunjangannya sama dengan setting itu; selain itu kosong dan tampil "Setting lama (sebelum riwayat)". Jurnal, detail jurnal, dan nilai slip tidak berubah.
- **Seed**: SET-01 sampai SET-05 setting awal DISETUJUI berlaku Oktober 2026, SET-06 promosi KRY-04 (Crew Produksi ke Operator Sound & Lighting, Golongan II) DISETUJUI berlaku Desember 2026, SET-07 penyesuaian KRY-05 (tambah tunjangan kesehatan) berlaku Januari 2027 menunggu Owner. Gaji Oktober dan November tidak berubah. `prisma/tambah-dummy.ts` membuat setting awal karyawan barunya lewat ajukan lalu setujui (berlaku Oktober 2026).
- **Nominal master** kini juga berversi, lihat "Riwayat nominal master" di bawah.

### Riwayat nominal master (gaji pokok, tunjangan, tunjangan jabatan, tarif event)

Masalah lama: nominal di `golongan.jumlah`, `tunjangan.nominal`, `jabatan.tunj_jabatan`, `jabatan.tunj_keluarga`, dan `jabatan.tarif` ditimpa langsung. Slip draf yang dihitung ulang (termasuk bulan lalu) dan usulan fee ikut berubah tanpa jejak dan tanpa persetujuan Owner.

- **Struktur**: satu tabel riwayat generik `versi_nominal` (migrasi `20261124090000_nominal_riwayat`). Satu baris = satu versi nominal satu item: `jenis` (`GOLONGAN`, `TUNJANGAN`, `JABATAN`, `JABATAN_EVENT`), tepat satu kunci asing `id_golongan`, `id_tunjangan`, atau `id_jabatan` (CHECK `versi_nominal_item`), `nominal` (gaji pokok, nominal tunjangan, atau tarif), `tunj_jabatan` dan `tunj_keluarga` (hanya JABATAN), `berlaku_mulai` (FK ke `periode`), `alasan`, `status` (DIAJUKAN, DISETUJUI, DITOLAK; CHECK tanpa DRAFT, DITOLAK wajib beralasan, keputusan wajib bertanggal), `alasan_tolak`, `diajukan_oleh/pada`, `diputuskan_oleh/pada`. CHECK `versi_nominal_nilai`: nominal gaji pokok, tunjangan, dan tarif lebih dari 0; tunjangan jabatan dan istri/anak boleh 0. Alasan satu tabel generik, bukan kolom versi di tiap tabel atau tiga tabel riwayat: alur ajukan, setujui, tolak, pengaman, log, daftar pengajuan Owner, dan dashboard cukup satu, sedangkan tiga kunci asing nyata tetap menjaga integritas rujukan. Kolom nominal lama di `golongan`, `tunjangan`, dan `jabatan` dihapus supaya tidak ada lagi angka yang bisa ditimpa tanpa riwayat; CHECK lama `jabatan_event_tarif` diganti `jabatan_event_lengkap` (peran dan satuan wajib untuk jabatan event).
- **Pemilih versi** (`buatPetaNominal` di `src/lib/inti/nominal.ts`, memakai `pilihVersiBerlaku` yang sama dengan setting gaji): nominal berlaku di periode P = versi DISETUJUI dengan `berlaku_mulai <= P` yang paling akhir; dua versi disetujui di bulan sama = koreksi, yang diputuskan belakangan menang (yang lama tampil "Digantikan"). Server memuat semua versi disetujui sekali per permintaan (`muatPetaNominal`).
- **Alur** (`ajukanNominalDalam`, `setujuiNominalDalam`, `tolakNominalDalam` di `src/lib/server/nominal.ts`, dipanggil server action `src/lib/aksi/master/nominal.ts` dan skrip dummy): HRD atau Owner mengajukan (tarif event hanya Owner), Owner menyetujui atau menolak dengan alasan. Data master baru bernominal (`simpanMaster` tanpa kode) wajib memilih Bulan dan Tahun berlaku; nominal awalnya langsung menjadi pengajuan DIAJUKAN, jadi data baru pun lewat persetujuan Owner. Ubah data master hanya mengubah atribut non-nominal (nama, akun biaya, peran, satuan); nominal kiriman diabaikan. Satuan tarif jabatan event (per hari atau per jam) tidak bisa diubah sesudah jabatannya dipakai penugasan, karena arti angka tarif di semua versinya bergantung pada satuan itu.
- **Pengaman** (dicek saat mengajukan dan sekali lagi saat menyetujui, `pengamanNominal`): bulan berlaku harus periode terbuka; item harus ada, aktif, dan jenisnya cocok (jabatan inhouse lawan jabatan event); tidak boleh ada slip gaji DIAJUKAN atau DISETUJUI yang memakai item itu (golongan atau jabatan slip, atau baris `slip_tunjangan`) di bulan berlaku atau sesudahnya; untuk tarif, tidak boleh ada laporan fee DIAJUKAN atau DISETUJUI untuk event yang memakai jabatan itu dengan bulan tanggal selesai di bulan berlaku atau sesudahnya (pesan menyebut bulan paling awal yang boleh); pengajuan kembar (item dan bulan sama yang masih DIAJUKAN) ditolak; nominal yang sama dengan versi berlaku di bulan itu ditolak. Setting gaji (ajukan dan setujui) menolak komponen yang belum punya nominal disetujui dan berlaku di bulan berlaku setting.
- **Serialisasi**: persetujuan nominal memegang kunci advisory 7410002 secara eksklusif (kunci yang sama dengan persetujuan setting gaji) dan mengunci baris item (`FOR UPDATE`). Hitung Gaji, pengajuan penggajian, kiriman laporan kapten, dan persetujuan fee memegang kunci bersama.
- **Log**: `nominal.ajukan`, `nominal.setujui`, `nominal.tolak` (entitas `nominal`) mencatat nilai lama (versi yang berlaku di bulan itu) dan baru beserta bulan berlaku dan kode versinya (`keteranganLogNominal`), alasan, dan slip draf atau event yang terdampak.
- **Hitung gaji**: `muatBahanGaji` mengambil gaji pokok, tunjangan jabatan, tunjangan istri/anak, dan tunjangan lain dari versi yang berlaku di bulan slip. Slip menyimpan rujukan versi tiap komponen: `slip_gaji.id_versi_gaji_pokok`, `slip_gaji.id_versi_jabatan` (tunjangan jabatan dan istri/anak), dan `slip_tunjangan.id_versi`, selain `id_setting`. Slip bulan lama yang dihitung ulang tetap memakai nominal lama walau kenaikan bulan sesudahnya sudah disetujui. Komponen tanpa nominal berlaku membuat slip karyawan itu tidak bisa dihitung (pesan menyebut komponennya).
- **Slip draf usang**: sidik versi slip (`sidikVersiSlip`: setting, versi gaji pokok, versi jabatan, versi tiap tunjangan) dibandingkan dengan sidik bahan hitung terbaru. Slip draf dengan sidik berbeda ditandai "Nominal komponen berubah, hitung ulang" di Hitung Gaji dan kesiapan, Distribusi menyembunyikan tombol Ajukan dan menampilkan peringatan, dan `ajukanPenggajian` menolaknya. Slip DIAJUKAN atau DISETUJUI tidak pernah berubah (pengaman di atas mencegah nominal baru mengenai bulannya).
- **Tampilan slip** (layar dan cetak, `RincianSlip`): tiap komponen tetap menyebut asalnya, contoh "Gaji pokok Golongan II, berlaku mulai Desember 2026 (NOM-0021)"; rujukan kosong tampil "nominal sebelum riwayat (tanpa versi)". Hitung Gaji punya kartu "Versi nominal komponen" (versi yang dipakai bulan itu dan jumlah karyawannya) dan keterangan per baris bila slip perlu dihitung ulang atau komponennya belum punya nominal berlaku.
- **Fee event**: tarif = versi yang berlaku di **bulan tanggal selesai event** (`muatBahanEvent`, `periodeTarif`). Alasannya: satu event memakai satu tarif per jabatan walau sesinya melewati pergantian bulan, dan bulan itu sama dengan bulan jurnal fee dan cek periode terbuka saat Owner menyetujui. Event yang masih PENILAIAN selalu memakai versi yang berlaku (usulan ikut berubah bila tarif bulannya disetujui berubah atau tanggal event digeser); laporan DIAJUKAN membekukan tarif bulannya lewat pengaman. `slip_fee.id_versi_tarif` menyimpan versi tarif yang dipakai, dan slip fee serta halaman keputusan menampilkan asal tarifnya. Kiriman laporan dan persetujuan fee ditolak bila ada jabatan tanpa tarif disetujui di bulan itu.
- **Tampilan Struktur gaji**: kartu "Pengajuan nominal menunggu Owner" (nilai lama dan baru, bulan berlaku, alasan, pengaju, peringatan pengaman atau draf terdampak, tombol Setujui dan Tolak untuk Owner); tabel tiap master menampilkan nominal yang berlaku bulan berjalan dan kolom "Riwayat nominal" (sejak kapan berlaku, versi berikutnya yang sudah disetujui tetapi belum berlaku, pengajuan menunggu, tautan Riwayat); tombol "Ajukan nominal" membuka form "Ajukan perubahan nominal" (nominal baru, Bulan dan Tahun berlaku, alasan, pratinjau pengaman); kartu Riwayat per item menampilkan semua versi dengan status. Dashboard Owner menampilkan "N pengajuan nominal gaji atau tarif menunggu keputusan" di Perlu tindakan dan menghitungnya di kartu Menunggu persetujuan; menu Master SDM mendapat lencana angka.
- **Migrasi** `20261124090000_nominal_riwayat`: nominal yang ada menjadi versi awal DISETUJUI berlaku Oktober 2026 (atau bulan setting, slip, atau tanggal selesai event paling awal bila ada yang lebih awal), urut golongan, tunjangan, jabatan inhouse, jabatan event, pengaju dan waktu dari log `master.tambah` bila ada; penghitung `NOM` diisi. Slip lama diberi rujukan versi hanya bila nilainya sama dengan versi awal (gaji pokok, tunjangan jabatan, tunjangan istri/anak menurut status PTKP slip, nominal tunjangan, tarif). Nilai slip, slip fee, jurnal, dan detail jurnal tidak berubah (diuji md5 di salinan produksi).
- **Seed**: versi awal NOM-0001 sampai NOM-0014 DISETUJUI berlaku Oktober 2026 (`versiAwalSeed`, urutan sama dengan migrasi), slip contoh Oktober memakai versi itu.
- **Data dummy Desember** (`prisma/tambah-dummy-desember.ts`): proses ulang penyusutan November yang ditolak, Investasi Kas Desember (satu disetujui, satu menunggu), promosi dan kenaikan nominal tunjangan Makan berlaku Desember, presensi dan slip draf Desember, kehadiran dan penilaian EVT-2026-0011 (laporan menunggu Owner) dan EVT-2026-0012 (sebagian dinilai). Penyusutan dan nilai sisa Desember sengaja belum diproses supaya bisa didemokan; keduanya boleh diproses karena batas prosesnya sampai Desember tahun berjalan (lihat "Batas proses penyusutan dan nilai sisa").

### Bulan dan Tahun dipisah

- Semua pilihan periode (dashboard, Jurnal Umum, Buku Besar, Neraca Saldo, Investasi Kas, Presensi, Hitung Gaji, Distribusi, Nilai Sisa, Penyusutan) memakai `PilihBulanTahun`: kontrol Bulan dan Tahun terpisah, parameter `?bulan=11&tahun=2026` (`?tahun=semua` untuk Jurnal Umum dan Investasi Kas). Pilihan Bulan selalu berisi Januari sampai Desember; bulan tanpa data memakai keadaan kosong halamannya, tidak dialihkan ke bulan lain. Pilihan Tahun diturunkan dari data (periode, jurnal, pembelian) ditambah tahun berjalan dan tahun yang dipilih. Halaman SDM menjangkau semua baris tabel periode (di produksi 2026-10 sampai 2034-10) ditambah bulan berjalan, bulan lalu, bulan depan, dan bulan yang punya presensi, slip, atau versi setting. Pilihan berlaku mulai di form setting gaji: semua baris periode ditambah 12 bulan ke depan. Jurnal Penyesuaian dan Tutup Periode tidak punya pemilih periode; Tutup Periode menulis judul kartu "Bulan: Oktober · Tahun: 2026". Fee event tidak punya filter periode.
- Tautan lama `?periode=2026-11` (dan `?periode=semua`) dialihkan proxy (307, hanya GET dan HEAD, parameter lain dipertahankan) oleh `cariTanpaPeriodeLama`. Halaman juga tetap bisa membaca `?periode=` lewat `periodeDariCari`.
- Judul layar memakai lencana "Bulan: November · Tahun: 2026" (`LencanaPeriode`), laporan saldo kumulatif menulis "Sampai akhir · Bulan: ... · Tahun: ...". Kepala cetak Buku Besar "Bulan: ... · Tahun: ...", Neraca Saldo "Saldo sampai akhir periode · Bulan: ... · Tahun: ...". Pesan singkat (toast, galat) tetap "November 2026".
- **Database**: `periode` punya kolom `bulan` (1-12) dan `tahun`, generated column (`GENERATED ALWAYS AS (...) STORED`), jadi selalu terisi untuk semua baris lama dan baru tanpa diisi aplikasi (`@default(dbgenerated())` di skema, Prisma tidak menulisnya). Id `"YYYY-MM"` tetap kunci utama supaya semua relasi lama (jurnal, slip, penggajian, jadwal, opname, setting) tidak berubah. Tabel lain (slip_gaji, penggajian, setting_gaji) tidak diberi kolom bulan dan tahun sendiri: semuanya FK ke `periode`, jadi laporan per bulan atau tahun cukup join ke `periode`.

### Cek kas pembelian tunai

Posting pembelian tunai (`postingDalamTransaksi`, juga Simpan dan posting) menolak bila saldo kas tidak cukup, dengan `pesanKasKurang` yang mengarah ke Investasi Kas. Yang dicek adalah saldo kas terendah di akhir bulan tanggal pembelian dan setiap bulan sesudahnya (`saldoKasTerendah`), karena pembelian bertanggal mundur mengurangi saldo semua bulan itu; penggajian dan fee event tetap memakai saldo total. Periode tertutup dilaporkan lebih dulu. Kunci advisory 7410003 menyerialkan posting tunai. Data contoh dan `prisma/tambah-dummy-konversi.ts` (yang meniru cek yang sama) lolos. Tes `nilai-sisa-mundur` kini memakai pembelian kredit bertanggal September, karena kas baru ada sejak setoran Oktober.

### Struktur gaji (Master SDM)

- Tab "Struktur gaji" (`BagianStrukturGaji`, data `dataStrukturGaji`) menampilkan empat master dalam satu halaman: jabatan inhouse (tunjangan jabatan, tunjangan istri/anak, akun biaya, jadwal kerja dari tabel jadwal, jumlah pemakai), jabatan event (peran, satuan tarif, tarif, akun biaya, jumlah penugasan), golongan atau gaji pokok, dan tunjangan lain. Penggabungan hanya di tampilan: tabel `jabatan`, `golongan`, `tunjangan` tetap terpisah karena dipakai slip, setting gaji, dan penugasan event.
- Tambah, ubah, dan nonaktifkan tetap lewat `simpanMaster` dan `ubahStatusMaster`, jadi izinnya sama dengan tab lama: jabatan, golongan, tunjangan oleh HRD dan Owner (`master-sdm.ubah`), jabatan event oleh Owner (`tarif-event.ubah`), nonaktifkan oleh Owner. Admin hanya melihat. Nominalnya berversi dan diubah lewat "Ajukan nominal" (lihat "Riwayat nominal master"); kolom nominal di tabel = nilai yang berlaku bulan berjalan.
- Ringkasan di atas dihitung dari setting gaji yang berlaku bulan berjalan untuk karyawan inhouse aktif (logika `dataSettingGaji`, versi disetujui terbaru yang sudah berlaku): jumlah karyawan per jabatan dan per golongan, dan kisaran estimasi bruto per jabatan (gaji pokok + tunjangan jabatan + tunjangan istri/anak bila PTKP K + tunjangan lain, sebelum potongan absen). Kolom "Dipakai" di tabel jabatan, golongan, dan tunjangan memakai angka yang sama.
- Jadwal kerja tetap tab sendiri karena punya form dan aturan sendiri (satu jadwal per jabatan inhouse).
