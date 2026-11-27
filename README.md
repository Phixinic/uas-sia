# SIA D'Production: Siklus Konversi & SDM

Aplikasi Sistem Informasi Akuntansi untuk D'Production (event organizer dan production house di Malang), tugas UAS SIA Program Studi Sistem Informasi, Universitas Ma Chung.

- **Siklus konversi**: pembelian peralatan dan perlengkapan, penyusutan dua tahap, nilai sisa perlengkapan, pelepasan peralatan.
- **Siklus SDM**: presensi, hitung gaji, PPh 21, distribusi beban gaji.
- **Pelaporan**: jurnal penyesuaian, jurnal umum, buku besar, neraca saldo, tutup periode.

Versi 2 dibangun ulang dengan Next.js 16, Prisma 7, dan PostgreSQL relasional, dengan login per peran. Versi statis lama (vanilla JS) tetap ada di [`versi-statis/`](versi-statis/README.md) sebagai acuan aturan bisnis, data contoh, dan diagram (use case, sitemap, logical database).

Kontrak kerja untuk pengembang (rute, peran per aksi, konvensi server action, format nomor, pembagian berkas): [`docs/KONTRAK.md`](docs/KONTRAK.md).

## Menjalankan di lokal

Butuh Node.js 22+ dan Docker (untuk PostgreSQL).

```bash
# 1. PostgreSQL 16 di port 5433
docker run -d --name sia-dpro-pg -e POSTGRES_USER=sia -e POSTGRES_PASSWORD=sia -e POSTGRES_DB=sia_dpro -p 127.0.0.1:5433:5432 postgres:16-alpine

# 2. Dependensi, env, migrasi, data contoh
npm install
cp .env.example .env
npm run db:migrasi
npm run db:seed

# 3. Sekali saja untuk uji E2E: unduh Chromium Playwright
npx playwright install chromium

# 4. Jalankan
npm run dev            # http://localhost:3000
```

`npm run db:seed` mengisi data contoh Januari 2025 sampai Desember 2026 (`prisma/seed-setahun.ts`, di bawah satu menit, satu transaksi). Sampai November 2026 semua bulan diproses penuh. Desember 2026 dibiarkan terbuka untuk dicoba: Gaji Bulanan, setoran, satu fee event, serta pengajuan setting gaji dan nominal (berlaku Januari 2027) menunggu Owner, satu event masih dinilai kapten, satu pembelian perlengkapan draf, penyusutan dan nilai sisa belum diproses. Rinciannya di `docs/KONTRAK.md`, bagian "Data contoh Januari 2025 sampai Desember 2026".

Akun demo (dibuat oleh seed, khusus pengembangan):

| Nama pengguna | Kata sandi | Peran |
|---|---|---|
| `admin` | `adminsia` | Admin |
| `hrd` | `hrdsia` | HRD |
| `owner` | `ownersia` | Owner |
| `kapten` sampai `kapten6` | `kaptensia` | Kapten event |

Data uji tes (`npm run db:seed-uji`, `prisma/seed.ts`, Oktober 2026) memakai `admin123`, `hrd12345`, `owner123`.

`npm run db:seed` menolak berjalan kalau database sudah berisi data. Untuk mengisi ulang dari awal: `SEED_PAKSA=1 npm run db:seed` (semua data dihapus).

Halaman masuk hanya menampilkan petunjuk akun demo bila `TAMPILKAN_AKUN_DEMO=1` (sudah ada di `.env.example` dan di server uji E2E). Jangan pasang flag ini di server sungguhan, karena sandinya sudah diganti dan lima kali gagal masuk mengunci akun selama 10 menit.

## Perintah lain

| Perintah | Fungsi |
|---|---|
| `npm run uji` | Tes logika inti: angka penyusutan, gaji, PPh 21, dan neraca saldo dibandingkan dengan app lama |
| `npm run uji:db` | Tes integrasi ke database (mengisi ulang database dengan data contoh) |
| `npm run uji:e2e` | Uji E2E Playwright (headless) satu periode November 2026 untuk tiga peran. Memakai database terpisah `sia_dpro_e2e` (dibuat dan di-seed otomatis) dan `next start` di port 3200, jadi jalankan `npm run build` dulu. Screenshot tersimpan di `/tmp/sia-e2e/<peran>/` |
| `npm run cek-tipe` / `npm run lint` | Pemeriksaan TypeScript dan ESLint |
| `npm run build` | Build produksi (output standalone) |
| `npm run db:migrasi-dev` | Membuat migrasi baru sesudah mengubah `prisma/schema.prisma` |

## Struktur singkat

```
prisma/            skema, migrasi, data contoh 2025 sampai 2026 (seed-setahun.ts), data uji Oktober 2026 (seed.ts)
src/app/           rute Next.js (halaman, layout, api/sehat)
src/komponen/      komponen UI per siklus (konversi, sdm, pelaporan, master) dan kerangka
src/lib/           inti (logika murni), server (db, auth, jurnal), aksi (server action), data (kueri), skema (zod)
tests/             tes vitest (inti, integrasi DB) dan tests/e2e (Playwright)
versi-statis/      app lama sebagai acuan aturan bisnis
```

Gaya cetak (laporan dan slip gaji) ada di `src/app/globals.css`. Rincian konvensi di `docs/KONTRAK.md`.

## Peran

| Peran | Tugas |
|---|---|
| Admin | Pembelian, nilai sisa perlengkapan, proses penyusutan, pengajuan pelepasan dan jurnal penyesuaian |
| HRD | Master SDM, presensi, hitung gaji, pengajuan distribusi gaji |
| Owner | Menyetujui atau menolak jurnal, pelepasan, dan penggajian; menyetujui semua penyusutan sebulan; membalik pembelian; bagan akun; kunci periode; kelola pengguna |

Rincian per aksi ada di `src/lib/peran.ts` dan `docs/KONTRAK.md`.

## Aturan urutan

- **Tutup periode berurutan.** Periode hanya bisa dikunci bila semua periode sebelumnya sudah terkunci, dan hanya bisa dibuka bila tidak ada periode sesudahnya yang terkunci. Periode juga dianggap tertutup bila ada periode sesudahnya yang terkunci, jadi pembelian, penyusutan, nilai sisa, pelepasan, gaji, dan keputusan jurnal bertanggal di bulan itu ditolak (`pastikanTerbuka` di `src/lib/server/periode.ts`).
- **Nilai sisa perlengkapan berurutan per bulan.** Nilai sisa bulan M hanya bisa diinput bila nilai sisa bulan sebelumnya sudah disetujui, dan tidak bisa diinput atau diubah lagi bila bulan sesudah M sudah punya nilai sisa. Bulan terlewat hanya dihitung sesudah nilai sisa terakhir: pembelian bertanggal mundur ke bulan yang sudah dilewati ikut masuk saldo bulan berikutnya. Bulan tanpa saldo perlengkapan tidak perlu nilai sisa, termasuk di daftar periksa Tutup Periode. Biaya juga ditolak bila membuat saldo akun Perlengkapan minus, baik saat input maupun saat jurnalnya disetujui.
- **Periode bawaan.** Halaman SDM dan dashboard sama-sama memakai periode berjalan bila `?periode` kosong. Tautan dari dashboard membawa `?periode` yang sedang dipilih.

## Rumus penting

**Penyusutan dua tahap** (`src/lib/inti/penyusutan.ts`), dengan b = harga beli, S = residu, n = jumlah periode (garansi atau masa manfaat, dipilih per baris pembelian):

- Periode 1 sampai n−1: `d = round((b − S) / n)`
- Periode n: `(b − S) − (n − 1) × d`, sehingga nilai buku akhir tepat sama dengan residu.

**Gaji** (`src/lib/inti/penggajian.ts`):

- Potongan absen = gaji pokok ÷ hari kerja × jumlah alpa
- Bruto = gaji pokok + tunjangan jabatan + tunjangan keluarga (status K) + tunjangan lain − potongan absen
- PPh 21 metode disetahunkan (simulasi, belum tarif efektif/TER)
- THP = bruto − PPh 21

Data contoh Oktober 2026 menghasilkan total bruto Rp31.500.001, PPh 21 Rp299.658, THP Rp31.200.343, dan neraca saldo seimbang Rp145.622.573. Angka ini dijaga oleh `tests/inti.test.ts`.

## Deploy (VPS kecil)

`Dockerfile` (multi-tahap, output standalone) dan `docker-compose.yml` (aplikasi + postgres:16-alpine, volume data, healthcheck, batas memori aplikasi 512 MB dan database 384 MB):

```bash
cp .env.docker.example .env.docker      # isi DB_PASSWORD
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker run --rm migrasi npm run db:seed    # sekali, data contoh
```

Aplikasi terbuka di `127.0.0.1:3000`; pasang reverse proxy untuk HTTPS. Setelah seed, ganti kata sandi akun demo.
