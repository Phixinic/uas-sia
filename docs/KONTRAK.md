# Kontrak kerja SIA D'Production (Next.js)

Dokumen ini pegangan bersama untuk semua agen dan anggota kelompok yang mengisi halaman. Baca sampai habis sebelum menulis kode. Aturan bisnis mengikuti app lama di `versi-statis/` (lihat `versi-statis/assets/js/views/*.js`); kalau kontrak ini dan app lama berbeda, kontrak ini yang dipakai dan perbedaannya ditulis di bagian "Keputusan".

## 1. Stack dan struktur

Next.js 16 (App Router, TypeScript), Prisma 7 + PostgreSQL 16 (adapter `pg`), Tailwind CSS 4, zod 4, lucide-react, vitest.

```
prisma/schema.prisma            skema relasional (nama Indonesia, tabel snake_case)
prisma/migrations/              migrasi (CHECK constraint tambahan ditulis manual di migrasi awal)
prisma/seed.ts                  data contoh Oktober 2026 + 3 pengguna demo
prisma/data/                    salinan JSON data contoh app lama
src/lib/inti/                   logika murni tanpa DB/UI: tanggal, penyusutan, penggajian, jurnal, buku-besar, akun
src/lib/server/                 khusus server: db, auth, aksi (konvensi), nomor, periode, jurnal, log, menu, logo
src/lib/aksi/<siklus>/          server action ("use server")
src/lib/data/<siklus>/          kueri baca untuk komponen server
src/lib/skema/                  skema zod (boleh diimpor klien): konversi, pembelian, sdm, pelaporan, master, pengguna
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
| `/konversi/pembelian-peralatan` | Pembelian Peralatan (**sudah jadi, pola rujukan**) | Konversi |
| `/konversi/pembelian-perlengkapan` | Pembelian Perlengkapan (sudah jadi, komponen sama) | Konversi |
| `/konversi/nilai-sisa` | Nilai Sisa Perlengkapan (opname) | Konversi |
| `/konversi/penyusutan` | Proses Penyusutan | Konversi |
| `/konversi/kartu-aset` | Kartu Aset (`?aset=AST-0001` membuka rinciannya) | Konversi |
| `/konversi/pelepasan` | Pelepasan Peralatan | Konversi |
| `/sdm/presensi` | Presensi (rekap dan harian) | SDM |
| `/sdm/hitung-gaji` | Hitung Gaji (slip, PPh 21) | SDM |
| `/sdm/distribusi` | Distribusi Gaji (pengajuan penggajian) | SDM |
| `/pelaporan/jurnal-penyesuaian` | Jurnal Penyesuaian (ajukan, setujui, tolak) | Pelaporan |
| `/pelaporan/jurnal-umum` | Jurnal Umum (umum + pembalik yang disetujui) | Pelaporan |
| `/pelaporan/buku-besar` | Buku Besar | Pelaporan |
| `/pelaporan/neraca-saldo` | Neraca Saldo | Pelaporan |
| `/pelaporan/tutup-periode` | Tutup Periode | Pelaporan |
| `/master/konversi` | Supplier, peralatan, perlengkapan, kategori aset, bagan akun, profil usaha | Pelaporan |
| `/master/sdm` | Karyawan, jabatan, gaji pokok, tunjangan, jadwal kerja, setting gaji | Pelaporan |
| `/pengguna` | Kelola pengguna (Owner saja) | Pelaporan |

Halaman yang belum jadi memakai `HalamanBelumJadi`; ganti seluruh isi `page.tsx`-nya.

## 3. Peran dan izin per aksi

Sumber kebenaran: `IZIN` di `src/lib/peran.ts`. Semua peran boleh **membuka** semua halaman kecuali `/pengguna`; tombol aksi disembunyikan dengan `boleh(peran, "kunci")`, dan server action **wajib** memanggil `wajibPeran(IZIN["kunci"])`.

| Kunci izin | Peran | Aksi |
|---|---|---|
| `pembelian.kelola-draf` | Admin | buat, ubah, hapus draf pembelian |
| `pembelian.posting` | Admin, Owner | posting draf |
| `pembelian.balik` | Owner | balik pembelian terposting (jurnal pembalik, alasan wajib) |
| `nilai-sisa.input` | Admin | input nilai sisa perlengkapan |
| `penyusutan.proses` | Admin | buat jurnal penyusutan satu periode |
| `pelepasan.ajukan` | Admin | ajukan pelepasan |
| `pelepasan.putuskan` | Owner | setujui atau tolak pelepasan (alasan wajib saat tolak) |
| `presensi.kelola` | HRD | input, ubah, hapus presensi |
| `gaji.hitung` | HRD | hitung dan simpan slip, hapus slip draf |
| `penggajian.ajukan` | HRD | ajukan semua slip draf satu periode |
| `penggajian.putuskan` | Owner | setujui (jurnal + bayar) atau tolak |
| `jurnal-penyesuaian.ajukan` | Admin | ajukan jurnal penyesuaian draf |
| `jurnal-penyesuaian.putuskan` | Owner | setujui atau tolak; pembuat tidak boleh menyetujui jurnalnya sendiri |
| `periode.kunci` | Owner | tutup periode (mengunci periode, tanpa jurnal penutup) dan buka kunci periode (alasan wajib saat buka); berurutan: kunci dari periode paling lama, buka dari periode terkunci paling akhir |
| `master-konversi.ubah` | Admin, Owner | tambah/ubah supplier, peralatan, perlengkapan |
| `master-konversi.tambah-cepat` | Admin | tambah supplier/barang langsung dari form pembelian (extend) |
| `master-sdm.ubah` | HRD, Owner | tambah/ubah master SDM |
| `master.akun-kategori` | Owner | bagan akun dan kategori aset |
| `master.nonaktifkan` | Owner | aktifkan/nonaktifkan data master (master tidak pernah dihapus) |
| `profil.ubah` | Owner | nama usaha |
| `pengguna.kelola` | Owner | kelola pengguna |

## 4. Status dan alur

Enum `StatusPersetujuan` (DRAFT, DIAJUKAN, DISETUJUI, DITOLAK) dipakai jurnal, pelepasan, opname, slip, penggajian. Pembelian memakai `StatusPembelian` = status persetujuan + DIBALIK. Label tampilan lewat `LencanaStatus`: pembelian DISETUJUI = "Diposting", slip DISETUJUI = "Dibayar".

| Dokumen | Alur |
|---|---|
| Pembelian | DRAFT → (posting Admin/Owner) DISETUJUI → (balik Owner) DIBALIK |
| Jurnal penyesuaian (penyusutan, opname) | dibuat DRAFT → Admin ajukan DIAJUKAN → Owner DISETUJUI / DITOLAK |
| Jurnal otomatis (pembelian, pelepasan, penggajian, pembalik, saldo awal) | dibuat langsung DISETUJUI |
| Opname | ikut status jurnalnya; total beban 0 = langsung DISETUJUI tanpa jurnal |
| Pelepasan | dibuat DIAJUKAN → Owner DISETUJUI (jurnal umum dibuat, aset DILEPAS, jadwal yang belum dijurnal dihapus) / DITOLAK |
| Slip | DRAFT (boleh dihitung ulang/hapus) → DIAJUKAN (bersama penggajian) → DISETUJUI (dibayar); bila penggajian ditolak slip kembali DRAFT, `penggajianNo` dikosongkan, `alasanTolak` diisi |
| Penggajian | dibuat DIAJUKAN → Owner DISETUJUI (cek saldo kas ≥ total THP, jurnal umum dibuat, slip DISETUJUI) / DITOLAK |

Efek penolakan jurnal penyesuaian ke sumbernya sudah ditulis di `src/lib/server/jurnal.ts` (`ajukanJurnal`, `setujuiJurnal`, `tolakJurnal`). Agen pelaporan cukup memanggilnya dari server action.

Hanya jurnal DISETUJUI yang masuk buku besar dan neraca saldo. Periode dikunci berurutan: periode P hanya boleh dikunci bila semua periode sebelum P sudah terkunci, dan hanya boleh dibuka bila tidak ada periode sesudah P yang terkunci. Periode P tertutup bila P sendiri atau periode sesudahnya terkunci; periode tertutup menolak jurnal dan dokumen baru bertanggal di dalamnya, juga persetujuan dan penolakan jurnal penyesuaiannya (`buatJurnal`, `ajukanJurnal`, `setujuiJurnal`, `tolakJurnal` sudah memeriksa).

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
- Tanggal di database kolom `@db.Date`: tulis dengan `keDate("2026-10-05")`, baca dengan `dariDate(d)`. Periode selalu string `"YYYY-MM"`. Hari ini: `hariIni()` (zona Asia/Jakarta).

Di klien: `useAksi()` untuk menjalankan aksi (memuat, toast, refresh), atau `TombolAksi` untuk tombol satu aksi dengan dialog konfirmasi (`perluAlasan` untuk tolak/balik/buka kunci).

## 6. Konvensi halaman

- `page.tsx` adalah komponen server. Panggil `wajibMasuk()` (atau `wajibPeranHalaman([...])`) di awal, walau layout sudah memeriksa.
- Data dibaca lewat fungsi di `src/lib/data/<siklus>/`. Yang dikirim ke komponen klien harus objek biasa (tanggal sudah jadi string).
- Keadaan halaman (periode terpilih, form terbuka, dokumen yang dilihat) disimpan di query string, contoh `?periode=2026-10`, `?form=baru`, `?lihat=BP-2026-0001`.
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
| Aset | `AST-0010` | `kodeBerikutnya(tx, AWALAN.ASET, 4)` |
| Master | `SUP-04`, `ALT-07`, `LKP-06`, `KAT-05`, `KRY-06`, `JBT-05`, `GP-05`, `TNJ-05`, `TM-05`, `SET-06` | `kodeBerikutnya(tx, AWALAN.X)` |
| Akun | kode diketik Owner (`1-110`), tidak bisa diubah sesudah dibuat | |
| Opname | `OPN-2026-10` (satu per periode) | `nomorOpname(periode)` |
| Slip | `SLP-2026-10-KRY-01` (satu per karyawan per periode) | `nomorSlip(periode, kode)` |

## 8. Pembagian kerja tiga agen

Setiap agen hanya menulis di folder miliknya. Berkas bersama (`prisma/`, `src/lib/inti`, `src/lib/server`, `src/lib/peran.ts`, `src/lib/format.ts`, `src/lib/menu.ts`, `src/komponen/ui`, `src/komponen/kerangka`, `src/app/globals.css`, `src/app/(aplikasi)/layout.tsx`) **tidak diubah**; kebutuhan perubahan dilaporkan ke koordinator. Skema tidak boleh diubah tanpa migrasi baru dari koordinator.

**Agen konversi**
- Folder: `src/app/(aplikasi)/konversi/**`, `src/lib/aksi/konversi/**`, `src/lib/data/konversi/**`, `src/lib/skema/` (berkas baru untuk konversi), `src/komponen/konversi/**`, `tests/konversi-*.test.ts`.
- Kerjakan: nilai sisa (opname, jurnal penyesuaian draf, rumus saldo buku perlengkapan dari pembelian DISETUJUI dikurangi opname tidak ditolak di periode sebelumnya), proses penyusutan (urutan periode, satu jurnal per periode berkelompok akun, isi `jurnalNo` di jadwal), kartu aset (rumus dengan angka asli, akumulasi dari jadwal yang jurnalnya DISETUJUI), pelepasan (ajukan, setujui, tolak), tambah cepat master dari form pembelian.
- Opname unik per periode (`periode 1:0..1 opname`): input ulang sesudah ditolak memperbarui baris `OPN-YYYY-MM` yang sama (ganti detail, jurnal draf baru, status DRAFT), jurnal lama yang ditolak tetap ada.
- Opname berurutan per bulan (`tahanUrutanNilaiSisa` di `src/lib/data/konversi/hitung.ts`): bulan sebelumnya harus DISETUJUI atau tidak bersaldo, dan bulan M tidak bisa diinput atau diubah bila bulan sesudah M sudah punya opname yang tidak ditolak (biaya akan terhitung dua kali). Biaya yang membuat saldo akun Perlengkapan minus ditolak saat input dan saat jurnalnya disetujui.
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
- Periode bawaan halaman SDM = periode berjalan, sama dengan dashboard. Tautan cepat dashboard ke halaman berperiode membawa `?periode` yang sedang dipilih; tautan "Perlu tindakan" SDM membawa periode pekerjaan yang tertunda.
- Kartu penyusutan di dashboard mengambil angka disetujui dari jurnal penyusutan yang disetujui, jadi aset yang dilepas sesudah penyusutannya disetujui tetap terhitung.
