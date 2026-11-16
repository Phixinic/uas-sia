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

# 3. Jalankan
npm run dev            # http://localhost:3000
```

Akun demo (dibuat oleh seed, khusus pengembangan):

| Nama pengguna | Kata sandi | Peran |
|---|---|---|
| `admin` | `admin123` | Admin |
| `hrd` | `hrd12345` | HRD |
| `owner` | `owner123` | Owner |

`npm run db:seed` menolak berjalan kalau database sudah berisi data. Untuk mengisi ulang dari awal: `SEED_PAKSA=1 npm run db:seed` (semua data dihapus).

## Perintah lain

| Perintah | Fungsi |
|---|---|
| `npm run uji` | Tes logika inti: angka penyusutan, gaji, PPh 21, dan neraca saldo dibandingkan dengan app lama |
| `npm run uji:db` | Tes integrasi ke database (mengisi ulang database dengan data contoh) |
| `npm run cek-tipe` / `npm run lint` | Pemeriksaan TypeScript dan ESLint |
| `npm run build` | Build produksi (output standalone) |
| `npm run db:migrasi-dev` | Membuat migrasi baru sesudah mengubah `prisma/schema.prisma` |

## Peran

| Peran | Tugas |
|---|---|
| Admin | Pembelian, nilai sisa perlengkapan, proses penyusutan, pengajuan pelepasan dan jurnal penyesuaian |
| HRD | Master SDM, presensi, hitung gaji, pengajuan distribusi gaji |
| Owner | Menyetujui atau menolak jurnal, pelepasan, dan penggajian; membalik pembelian; bagan akun; kunci periode; kelola pengguna |

Rincian per aksi ada di `src/lib/peran.ts` dan `docs/KONTRAK.md`.

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
