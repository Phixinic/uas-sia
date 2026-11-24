-- Penyusutan peralatan otomatis (masukan dosen: "alat tidak bisa ditolak").
-- Jurnal penyusutan sekarang langsung DISETUJUI saat diproses. Jurnal penyusutan lama yang masih DRAFT atau DIAJUKAN
-- tidak punya jalan lagi di aplikasi (tombol ajukan, setujui, dan tolak sudah dihapus), jadi disetujui di sini dengan
-- penyetuju = pembuatnya. Jurnal yang dulu DITOLAK tetap DITOLAK sebagai riwayat. Debit, kredit, nomor, dan tanggal
-- tidak berubah. Database kosong: tidak ada baris yang terkena.
UPDATE "jurnal"
SET "status" = 'DISETUJUI',
    "diajukan_pada" = COALESCE("diajukan_pada", now()),
    "disetujui_oleh" = "dibuat_oleh",
    "disetujui_pada" = now(),
    "alasan_tolak" = NULL
WHERE "sumber_tipe" = 'PENYUSUTAN' AND "status" IN ('DRAFT', 'DIAJUKAN');
