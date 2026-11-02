# SIA Laundry Sukses Mandiri — Siklus Konversi

Aplikasi web Sistem Informasi Akuntansi untuk siklus konversi (peralatan dan perlengkapan) studi kasus Laundry Sukses Mandiri. Tugas KK4 SIA, Program Studi Sistem Informasi, Universitas Ma Chung.

Kelompok: Andrew, Farid Heka Magfirio (322410004)

## Cara menjalankan

Tidak perlu instalasi. Buka `index.html` langsung di browser (Chrome, Edge, atau Firefox).

Kalau ingin lewat server lokal:

```bash
npx serve .
# atau
python -m http.server 8000
```

Data disimpan di **localStorage** browser. Saat pertama dibuka, aplikasi memuat data contoh Oktober 2026 dari `data/seed.js`. Tombol **Reset data contoh** di bagian atas mengembalikan data ke kondisi awal.

## Struktur folder

```
sia-laundry/
├── index.html                       Kerangka halaman dan urutan pemuatan script
├── README.md
├── assets/
│   ├── css/style.css                Token warna (terang & gelap), layout, tabel, form
│   └── js/
│       ├── core/
│       │   ├── config.js            Kode akun (COA), cara bayar, alasan pelepasan
│       │   ├── utils.js             Format rupiah, tanggal, periode
│       │   ├── state.js             State aplikasi dan helper baca data
│       │   ├── db-adapter.js        Database: claude.ai atau localStorage
│       │   ├── penyusutan.js        Rumus penyusutan dua tahap
│       │   ├── ledger.js            Buku besar, neraca saldo, saldo perlengkapan
│       │   └── jurnal.js            Penomoran otomatis dan pembuatan jurnal
│       ├── ui/
│       │   ├── components.js        Komponen tampilan yang dipakai ulang
│       │   └── navigasi.js          Menu samping dan pemilih peran
│       ├── views/                   Satu file per halaman
│       │   ├── dashboard.js
│       │   ├── pembelian.js         CRUD pembelian peralatan & perlengkapan
│       │   ├── nilai-sisa.js        Input nilai sisa perlengkapan
│       │   ├── penyusutan.js        Proses penyusutan bulanan
│       │   ├── aset.js              Kartu aset dan jadwal
│       │   ├── jurnal-penyesuaian.js
│       │   ├── pelepasan.js         Hapus / pelepasan peralatan
│       │   ├── laporan.js           Jurnal umum, buku besar, neraca saldo
│       │   ├── periode.js           Tutup periode
│       │   └── master.js            Data master
│       ├── actions.js               Aksi tombol dan binding form
│       └── app.js                   Render, routing, koneksi database
├── data/seed.js                     Data contoh awal
└── docs/
    ├── use-case.png                 Diagram use case
    └── logical-database.png         Logical database (ERD)
```

Script dimuat sebagai script biasa (bukan ES module) supaya `index.html` tetap bisa dibuka langsung dari file tanpa server. Urutannya diatur di `index.html`.

## Peran dan hak akses

| Fitur | Admin | Owner |
|---|---|---|
| Master supplier, peralatan, perlengkapan | Tambah, ubah | Tambah, ubah, nonaktifkan |
| Kategori aset dan bagan akun | Lihat | Kelola |
| Pembelian (draf) | Buat, ubah, hapus | Lihat |
| Posting pembelian | Ya | Ya |
| Membalik pembelian terposting | Tidak | Ya |
| Input nilai sisa perlengkapan | Ya | Lihat |
| Proses penyusutan bulanan | Ya | Lihat |
| Jurnal penyesuaian | Ajukan | Setujui / tolak dengan alasan |
| Pelepasan peralatan | Ajukan | Setujui / tolak |
| Kunci dan buka periode | Tidak | Ya |
| Jurnal umum, buku besar, neraca saldo | Lihat | Lihat |

Peran dipilih dengan tombol Admin / Owner di bagian atas (mode demo, belum ada login).

## Rumus penyusutan (sesuai papan dosen)

| Simbol | Arti |
|---|---|
| b | Harga beli per unit |
| S | Nilai residu (0 kalau tidak ada) |
| n | Jumlah periode: bisa dipilih per aset, **garansi** atau **masa manfaat** |
| d | Penyusutan per periode setelah dibulatkan |

- Periode 1 sampai n−1: `d = round((b − S) / n)`
- Periode n: `(b − S) − (n − 1) × d`

Contoh b = Rp10.000.000, n = 60: periode 1–59 Rp166.667, periode 60 Rp166.647, nilai buku akhir tepat Rp0.

Validasi saat simpan: b > 0, n ≥ 1, 0 ≤ S < b. Kalau periode terakhir hasilnya minus (harga kecil dengan n besar), sistem memakai pembulatan ke bawah. Semua perhitungan memakai bilangan bulat rupiah. Kodenya ada di `assets/js/core/penyusutan.js`.

## Alur kerja

1. **Pembelian.** Admin membuat draf, lalu memposting. Sistem membuat jurnal umum dan, untuk peralatan, satu kartu aset per unit beserta jadwal penyusutannya.
2. **Akhir bulan.** Admin memproses penyusutan dan menginput nilai sisa perlengkapan. Keduanya menghasilkan jurnal penyesuaian berstatus draf.
3. **Validasi.** Admin mengajukan, Owner menyetujui atau menolak dengan alasan. Hanya jurnal yang disetujui masuk buku besar.
4. **Tutup periode.** Setelah daftar periksa lulus, Owner mengunci periode. Periode terkunci menolak jurnal baru.

## Pemetaan use case

| Use case (diagram) | Halaman / file |
|---|---|
| Kelola (CRUD) Pembelian Peralatan | `views/pembelian.js` |
| ↳ include Insert Tabel Transaksi Pembelian Peralatan | `postingBeli()` di `views/pembelian.js` |
| ↳ include Hitung Penyusutan | `core/penyusutan.js` |
| ↳ extend Kelola Master Supplier / Peralatan | Tombol "+ belum ada" di form pembelian |
| Kelola (CRUD) Pembelian Perlengkapan | `views/pembelian.js` |
| Hapus Peralatan | `views/pelepasan.js` |
| Input Nilai Sisa (Saldo Akhir) Perlengkapan | `views/nilai-sisa.js` |
| Melihat & Memvalidasi Jurnal Penyesuaian | `views/jurnal-penyesuaian.js` |
| Kelola Master Supplier / Peralatan / Perlengkapan | `views/master.js` |
| Melihat Jurnal Umum, Melihat Buku Besar | `views/laporan.js` |

## Koleksi data

`supplier`, `peralatan`, `perlengkapan`, `kategori`, `akun`, `pembelian` (berisi item), `aset` (berisi jadwal penyusutan), `opname` (nilai sisa perlengkapan), `pelepasan`, `jurnal` (berisi baris debit/kredit), `periode`, dan `meta/counters` untuk penomoran.

## Batasan

- Belum ada login. Peran dipilih manual.
- Data localStorage hanya ada di satu browser. Untuk dipakai bersama, ganti `db-adapter.js` dengan backend (misalnya PHP + MySQL atau Supabase) yang punya fungsi `doc()` dan `collection()` yang sama.
- Belum mencakup biaya angkut/PPN, buku fiskal, dan audit log terpisah.
