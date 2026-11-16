# SIA Laundry Sukses Mandiri — Siklus Konversi & SDM

Aplikasi web Sistem Informasi Akuntansi untuk dua siklus pada studi kasus Laundry Sukses Mandiri:

- **Siklus konversi**: pembelian peralatan dan perlengkapan, penyusutan, nilai sisa perlengkapan, pelepasan peralatan.
- **Siklus SDM**: presensi, hitung gaji, PPh 21, dan distribusi beban gaji.

Kedua siklus memakai satu bagan akun, satu jurnal, satu buku besar, dan satu aturan tutup periode.

Tugas UAS SIA, Program Studi Sistem Informasi, Universitas Ma Chung.

## Cara menjalankan

Tidak perlu build. Ini situs statis: buka `index.html` di browser, atau deploy folder ini apa adanya ke Vercel.

Aplikasi memilih tempat penyimpanan data secara otomatis:

| Mode | Kapan dipakai | Sifat data |
|---|---|---|
| Supabase | `assets/js/core/supabase-config.js` terisi dan browser online | Bersama, sama di semua perangkat |
| localStorage | Konfigurasi Supabase kosong atau pustakanya gagal dimuat | Hanya di browser itu |

Saat database masih kosong, aplikasi mengisi data contoh Oktober 2026 dari `data/seed.js`.

### Menyiapkan Supabase sendiri

1. Buat project di supabase.com.
2. Jalankan `supabase/schema.sql` di SQL Editor.
3. Isi `url` dan `key` (kunci anon/publishable) di `assets/js/core/supabase-config.js`.

Catatan keamanan: skema ini membuka baca dan tulis untuk siapa pun yang punya alamat situs, karena aplikasi belum punya login. Ini cukup untuk demo tugas kuliah, tetapi jangan dipakai untuk data sungguhan.

## Struktur folder

```
├── index.html                       Kerangka halaman dan urutan pemuatan script
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── core/
│       │   ├── config.js            Kode akun (COA) dan konstanta
│       │   ├── supabase-config.js   Alamat dan kunci publik Supabase
│       │   ├── utils.js             Format rupiah, tanggal, periode
│       │   ├── state.js             State aplikasi dan peran pengguna
│       │   ├── db-adapter.js        Database: claude.ai, Supabase, atau localStorage
│       │   ├── penyusutan.js        Rumus penyusutan dua tahap
│       │   ├── penggajian.js        Rekap presensi, PPh 21, hitung gaji
│       │   ├── ledger.js            Buku besar dan neraca saldo
│       │   └── jurnal.js            Penomoran dan pembuatan jurnal
│       ├── ui/                      Komponen tampilan dan navigasi
│       ├── views/                   Satu file per halaman
│       ├── actions.js               Aksi tombol dan binding form
│       └── app.js                   Render, routing, koneksi database
├── data/seed.js                     Data contoh awal
├── supabase/schema.sql              Skema tabel Supabase
└── docs/                            Diagram use case dan logical database (siklus konversi)
```

## Peran

| Peran | Tugas |
|---|---|
| Admin | Pembelian, nilai sisa perlengkapan, proses penyusutan, pengajuan pelepasan dan jurnal penyesuaian |
| HRD | Master SDM, presensi, hitung gaji, pengajuan distribusi gaji |
| Owner | Menyetujui atau menolak jurnal, pelepasan, dan penggajian; bagan akun; kunci periode |

Peran dipilih lewat tombol di bagian atas (mode demo, belum ada login).

## Rumus penting

**Penyusutan dua tahap** (`core/penyusutan.js`), dengan b = harga beli, S = residu, n = jumlah periode (garansi atau masa manfaat, dipilih per aset):

- Periode 1 sampai n−1: `d = round((b − S) / n)`
- Periode n: `(b − S) − (n − 1) × d`, sehingga nilai buku akhir tepat sama dengan residu.

**Gaji** (`core/penggajian.js`):

- Potongan absen = gaji pokok ÷ hari kerja × jumlah alpa
- Bruto = gaji pokok + tunjangan jabatan + tunjangan keluarga (status K) + tunjangan lain − potongan absen
- PPh 21 memakai metode disetahunkan (simulasi, belum tarif efektif/TER)
- THP = bruto − PPh 21

## Jurnal yang dibentuk

| Peristiwa | Debit | Kredit |
|---|---|---|
| Beli peralatan / perlengkapan | Peralatan / Perlengkapan | Kas, Utang Usaha, atau Modal Pemilik |
| Penyusutan bulanan | Biaya Penyusutan Peralatan | Akumulasi Penyusutan Peralatan |
| Pemakaian perlengkapan | Biaya Perlengkapan | Perlengkapan |
| Pelepasan peralatan | Akumulasi Penyusutan, Kas, Rugi | Peralatan, Laba |
| Penggajian | Biaya Gaji Tenaga Kerja Langsung, Biaya Gaji Administrasi & Umum | Utang PPh 21, Kas |

## Mengganti studi kasus

Nama usaha diubah Owner di **Master Konversi → Profil usaha**. Setelah itu sesuaikan data master (jabatan, peralatan, perlengkapan, supplier).
