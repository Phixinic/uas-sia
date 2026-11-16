/* Data contoh awal (Oktober 2026) untuk siklus konversi dan SDM. Dipakai saat database masih kosong. */
window.SEED = {
 "akun": {
  "6-110": {
   "kode": "6-110",
   "nama": "Biaya Penyusutan Peralatan",
   "tipe": "Beban",
   "saldo_normal": "D",
   "aktif": true
  },
  "3-110": {
   "kode": "3-110",
   "nama": "Modal Pemilik",
   "tipe": "Ekuitas",
   "saldo_normal": "K",
   "aktif": true
  },
  "6-120": {
   "kode": "6-120",
   "nama": "Biaya Perlengkapan",
   "tipe": "Beban",
   "saldo_normal": "D",
   "aktif": true
  },
  "1-110": {
   "kode": "1-110",
   "nama": "Kas",
   "tipe": "Aset",
   "saldo_normal": "D",
   "aktif": true
  },
  "2-110": {
   "kode": "2-110",
   "nama": "Utang Usaha",
   "tipe": "Liabilitas",
   "saldo_normal": "K",
   "aktif": true
  },
  "8-110": {
   "kode": "8-110",
   "nama": "Rugi Pelepasan Aset",
   "tipe": "Beban",
   "saldo_normal": "D",
   "aktif": true
  },
  "1-151": {
   "kode": "1-151",
   "nama": "Akumulasi Penyusutan Peralatan",
   "tipe": "Kontra aset",
   "saldo_normal": "K",
   "aktif": true
  },
  "7-110": {
   "kode": "7-110",
   "nama": "Laba Pelepasan Aset",
   "tipe": "Pendapatan",
   "saldo_normal": "K",
   "aktif": true
  },
  "1-140": {
   "kode": "1-140",
   "nama": "Perlengkapan",
   "tipe": "Aset",
   "saldo_normal": "D",
   "aktif": true
  },
  "1-150": {
   "kode": "1-150",
   "nama": "Peralatan",
   "tipe": "Aset",
   "saldo_normal": "D",
   "aktif": true
  },
  "2-120": {
   "kode": "2-120",
   "nama": "Utang PPh 21",
   "tipe": "Liabilitas",
   "saldo_normal": "K",
   "aktif": true
  },
  "6-210": {
   "kode": "6-210",
   "nama": "Biaya Gaji Crew & Produksi Event",
   "tipe": "Beban",
   "saldo_normal": "D",
   "aktif": true
  },
  "6-220": {
   "kode": "6-220",
   "nama": "Biaya Gaji Administrasi & Umum",
   "tipe": "Beban",
   "saldo_normal": "D",
   "aktif": true
  }
 },
 "peralatan": {
  "ALT-01": {
   "kode": "ALT-01",
   "nama": "Speaker Aktif 15 inci (set)",
   "satuan": "set",
   "kategori_id": "KAT-01",
   "aktif": true
  },
  "ALT-02": {
   "kode": "ALT-02",
   "nama": "Moving Head Beam 230W",
   "satuan": "unit",
   "kategori_id": "KAT-01",
   "aktif": true
  },
  "ALT-03": {
   "kode": "ALT-03",
   "nama": "Mixer Digital 16 Channel",
   "satuan": "unit",
   "kategori_id": "KAT-01",
   "aktif": true
  },
  "ALT-04": {
   "kode": "ALT-04",
   "nama": "Kamera Mirrorless",
   "satuan": "unit",
   "kategori_id": "KAT-02",
   "aktif": true
  },
  "ALT-05": {
   "kode": "ALT-05",
   "nama": "Handy Talky (HT)",
   "satuan": "unit",
   "kategori_id": "KAT-03",
   "aktif": true
  },
  "ALT-06": {
   "kode": "ALT-06",
   "nama": "Laptop Operasional",
   "satuan": "unit",
   "kategori_id": "KAT-04",
   "aktif": true
  }
 },
 "meta": {
  "counters": {
   "JU2026": 10,
   "BP2026": 7,
   "BL2026": 2,
   "AST": 9,
   "SUP": 3,
   "ALT": 6,
   "LKP": 5,
   "KAT": 4,
   "KRY": 5,
   "JBT": 4,
   "GP": 4,
   "TNJ": 4,
   "TM": 4,
   "SET": 5
  },
  "profil": {
   "nama": "D'Production",
   "ket": "SIA Konversi & SDM"
  }
 },
 "kategori": {
  "KAT-01": {
   "kode": "KAT-01",
   "nama": "Sound & Lighting",
   "masa_manfaat_bulan": 60,
   "persen_residu": 0,
   "akun_aset": "1-150",
   "akun_akumulasi": "1-151",
   "akun_beban": "6-110",
   "aktif": true
  },
  "KAT-02": {
   "kode": "KAT-02",
   "nama": "Peralatan Dokumentasi",
   "masa_manfaat_bulan": 48,
   "persen_residu": 0,
   "akun_aset": "1-150",
   "akun_akumulasi": "1-151",
   "akun_beban": "6-110",
   "aktif": true
  },
  "KAT-03": {
   "kode": "KAT-03",
   "nama": "Peralatan Kecil Event",
   "masa_manfaat_bulan": 24,
   "persen_residu": 0,
   "akun_aset": "1-150",
   "akun_akumulasi": "1-151",
   "akun_beban": "6-110",
   "aktif": true
  },
  "KAT-04": {
   "kode": "KAT-04",
   "nama": "Perangkat Kantor",
   "masa_manfaat_bulan": 48,
   "persen_residu": 0,
   "akun_aset": "1-150",
   "akun_akumulasi": "1-151",
   "akun_beban": "6-110",
   "aktif": true
  }
 },
 "aset": {
  "AST-0001": {
   "kode": "AST-0001",
   "pembelian_id": "BP-2026-0001",
   "tgl_perolehan": "2026-10-05",
   "bulan_mulai": "2026-10",
   "status": "aktif",
   "nama": "Speaker Aktif 15 inci (set)",
   "barang_id": "ALT-01",
   "kategori_id": "KAT-01",
   "nilai_perolehan": 14500000,
   "residu": 0,
   "garansi_bulan": 24,
   "garansi_sampai": "2028-10-05",
   "masa_manfaat_bulan": 60,
   "dasar_n": "masa_manfaat",
   "n": 60,
   "d": 241667,
   "terakhir": 241647,
   "pengaman": false,
   "akun_aset": "1-150",
   "akun_akm": "1-151",
   "akun_beban": "6-110",
   "jadwal": [
    {
     "p": 1,
     "periode": "2026-10",
     "beban": 241667,
     "akumulasi": 241667,
     "nilai_buku": 14258333,
     "jurnal_id": null
    },
    {
     "p": 2,
     "periode": "2026-11",
     "beban": 241667,
     "akumulasi": 483334,
     "nilai_buku": 14016666,
     "jurnal_id": null
    },
    {
     "p": 3,
     "periode": "2026-12",
     "beban": 241667,
     "akumulasi": 725001,
     "nilai_buku": 13774999,
     "jurnal_id": null
    },
    {
     "p": 4,
     "periode": "2027-01",
     "beban": 241667,
     "akumulasi": 966668,
     "nilai_buku": 13533332,
     "jurnal_id": null
    },
    {
     "p": 5,
     "periode": "2027-02",
     "beban": 241667,
     "akumulasi": 1208335,
     "nilai_buku": 13291665,
     "jurnal_id": null
    },
    {
     "p": 6,
     "periode": "2027-03",
     "beban": 241667,
     "akumulasi": 1450002,
     "nilai_buku": 13049998,
     "jurnal_id": null
    },
    {
     "p": 7,
     "periode": "2027-04",
     "beban": 241667,
     "akumulasi": 1691669,
     "nilai_buku": 12808331,
     "jurnal_id": null
    },
    {
     "p": 8,
     "periode": "2027-05",
     "beban": 241667,
     "akumulasi": 1933336,
     "nilai_buku": 12566664,
     "jurnal_id": null
    },
    {
     "p": 9,
     "periode": "2027-06",
     "beban": 241667,
     "akumulasi": 2175003,
     "nilai_buku": 12324997,
     "jurnal_id": null
    },
    {
     "p": 10,
     "periode": "2027-07",
     "beban": 241667,
     "akumulasi": 2416670,
     "nilai_buku": 12083330,
     "jurnal_id": null
    },
    {
     "p": 11,
     "periode": "2027-08",
     "beban": 241667,
     "akumulasi": 2658337,
     "nilai_buku": 11841663,
     "jurnal_id": null
    },
    {
     "p": 12,
     "periode": "2027-09",
     "beban": 241667,
     "akumulasi": 2900004,
     "nilai_buku": 11599996,
     "jurnal_id": null
    },
    {
     "p": 13,
     "periode": "2027-10",
     "beban": 241667,
     "akumulasi": 3141671,
     "nilai_buku": 11358329,
     "jurnal_id": null
    },
    {
     "p": 14,
     "periode": "2027-11",
     "beban": 241667,
     "akumulasi": 3383338,
     "nilai_buku": 11116662,
     "jurnal_id": null
    },
    {
     "p": 15,
     "periode": "2027-12",
     "beban": 241667,
     "akumulasi": 3625005,
     "nilai_buku": 10874995,
     "jurnal_id": null
    },
    {
     "p": 16,
     "periode": "2028-01",
     "beban": 241667,
     "akumulasi": 3866672,
     "nilai_buku": 10633328,
     "jurnal_id": null
    },
    {
     "p": 17,
     "periode": "2028-02",
     "beban": 241667,
     "akumulasi": 4108339,
     "nilai_buku": 10391661,
     "jurnal_id": null
    },
    {
     "p": 18,
     "periode": "2028-03",
     "beban": 241667,
     "akumulasi": 4350006,
     "nilai_buku": 10149994,
     "jurnal_id": null
    },
    {
     "p": 19,
     "periode": "2028-04",
     "beban": 241667,
     "akumulasi": 4591673,
     "nilai_buku": 9908327,
     "jurnal_id": null
    },
    {
     "p": 20,
     "periode": "2028-05",
     "beban": 241667,
     "akumulasi": 4833340,
     "nilai_buku": 9666660,
     "jurnal_id": null
    },
    {
     "p": 21,
     "periode": "2028-06",
     "beban": 241667,
     "akumulasi": 5075007,
     "nilai_buku": 9424993,
     "jurnal_id": null
    },
    {
     "p": 22,
     "periode": "2028-07",
     "beban": 241667,
     "akumulasi": 5316674,
     "nilai_buku": 9183326,
     "jurnal_id": null
    },
    {
     "p": 23,
     "periode": "2028-08",
     "beban": 241667,
     "akumulasi": 5558341,
     "nilai_buku": 8941659,
     "jurnal_id": null
    },
    {
     "p": 24,
     "periode": "2028-09",
     "beban": 241667,
     "akumulasi": 5800008,
     "nilai_buku": 8699992,
     "jurnal_id": null
    },
    {
     "p": 25,
     "periode": "2028-10",
     "beban": 241667,
     "akumulasi": 6041675,
     "nilai_buku": 8458325,
     "jurnal_id": null
    },
    {
     "p": 26,
     "periode": "2028-11",
     "beban": 241667,
     "akumulasi": 6283342,
     "nilai_buku": 8216658,
     "jurnal_id": null
    },
    {
     "p": 27,
     "periode": "2028-12",
     "beban": 241667,
     "akumulasi": 6525009,
     "nilai_buku": 7974991,
     "jurnal_id": null
    },
    {
     "p": 28,
     "periode": "2029-01",
     "beban": 241667,
     "akumulasi": 6766676,
     "nilai_buku": 7733324,
     "jurnal_id": null
    },
    {
     "p": 29,
     "periode": "2029-02",
     "beban": 241667,
     "akumulasi": 7008343,
     "nilai_buku": 7491657,
     "jurnal_id": null
    },
    {
     "p": 30,
     "periode": "2029-03",
     "beban": 241667,
     "akumulasi": 7250010,
     "nilai_buku": 7249990,
     "jurnal_id": null
    },
    {
     "p": 31,
     "periode": "2029-04",
     "beban": 241667,
     "akumulasi": 7491677,
     "nilai_buku": 7008323,
     "jurnal_id": null
    },
    {
     "p": 32,
     "periode": "2029-05",
     "beban": 241667,
     "akumulasi": 7733344,
     "nilai_buku": 6766656,
     "jurnal_id": null
    },
    {
     "p": 33,
     "periode": "2029-06",
     "beban": 241667,
     "akumulasi": 7975011,
     "nilai_buku": 6524989,
     "jurnal_id": null
    },
    {
     "p": 34,
     "periode": "2029-07",
     "beban": 241667,
     "akumulasi": 8216678,
     "nilai_buku": 6283322,
     "jurnal_id": null
    },
    {
     "p": 35,
     "periode": "2029-08",
     "beban": 241667,
     "akumulasi": 8458345,
     "nilai_buku": 6041655,
     "jurnal_id": null
    },
    {
     "p": 36,
     "periode": "2029-09",
     "beban": 241667,
     "akumulasi": 8700012,
     "nilai_buku": 5799988,
     "jurnal_id": null
    },
    {
     "p": 37,
     "periode": "2029-10",
     "beban": 241667,
     "akumulasi": 8941679,
     "nilai_buku": 5558321,
     "jurnal_id": null
    },
    {
     "p": 38,
     "periode": "2029-11",
     "beban": 241667,
     "akumulasi": 9183346,
     "nilai_buku": 5316654,
     "jurnal_id": null
    },
    {
     "p": 39,
     "periode": "2029-12",
     "beban": 241667,
     "akumulasi": 9425013,
     "nilai_buku": 5074987,
     "jurnal_id": null
    },
    {
     "p": 40,
     "periode": "2030-01",
     "beban": 241667,
     "akumulasi": 9666680,
     "nilai_buku": 4833320,
     "jurnal_id": null
    },
    {
     "p": 41,
     "periode": "2030-02",
     "beban": 241667,
     "akumulasi": 9908347,
     "nilai_buku": 4591653,
     "jurnal_id": null
    },
    {
     "p": 42,
     "periode": "2030-03",
     "beban": 241667,
     "akumulasi": 10150014,
     "nilai_buku": 4349986,
     "jurnal_id": null
    },
    {
     "p": 43,
     "periode": "2030-04",
     "beban": 241667,
     "akumulasi": 10391681,
     "nilai_buku": 4108319,
     "jurnal_id": null
    },
    {
     "p": 44,
     "periode": "2030-05",
     "beban": 241667,
     "akumulasi": 10633348,
     "nilai_buku": 3866652,
     "jurnal_id": null
    },
    {
     "p": 45,
     "periode": "2030-06",
     "beban": 241667,
     "akumulasi": 10875015,
     "nilai_buku": 3624985,
     "jurnal_id": null
    },
    {
     "p": 46,
     "periode": "2030-07",
     "beban": 241667,
     "akumulasi": 11116682,
     "nilai_buku": 3383318,
     "jurnal_id": null
    },
    {
     "p": 47,
     "periode": "2030-08",
     "beban": 241667,
     "akumulasi": 11358349,
     "nilai_buku": 3141651,
     "jurnal_id": null
    },
    {
     "p": 48,
     "periode": "2030-09",
     "beban": 241667,
     "akumulasi": 11600016,
     "nilai_buku": 2899984,
     "jurnal_id": null
    },
    {
     "p": 49,
     "periode": "2030-10",
     "beban": 241667,
     "akumulasi": 11841683,
     "nilai_buku": 2658317,
     "jurnal_id": null
    },
    {
     "p": 50,
     "periode": "2030-11",
     "beban": 241667,
     "akumulasi": 12083350,
     "nilai_buku": 2416650,
     "jurnal_id": null
    },
    {
     "p": 51,
     "periode": "2030-12",
     "beban": 241667,
     "akumulasi": 12325017,
     "nilai_buku": 2174983,
     "jurnal_id": null
    },
    {
     "p": 52,
     "periode": "2031-01",
     "beban": 241667,
     "akumulasi": 12566684,
     "nilai_buku": 1933316,
     "jurnal_id": null
    },
    {
     "p": 53,
     "periode": "2031-02",
     "beban": 241667,
     "akumulasi": 12808351,
     "nilai_buku": 1691649,
     "jurnal_id": null
    },
    {
     "p": 54,
     "periode": "2031-03",
     "beban": 241667,
     "akumulasi": 13050018,
     "nilai_buku": 1449982,
     "jurnal_id": null
    },
    {
     "p": 55,
     "periode": "2031-04",
     "beban": 241667,
     "akumulasi": 13291685,
     "nilai_buku": 1208315,
     "jurnal_id": null
    },
    {
     "p": 56,
     "periode": "2031-05",
     "beban": 241667,
     "akumulasi": 13533352,
     "nilai_buku": 966648,
     "jurnal_id": null
    },
    {
     "p": 57,
     "periode": "2031-06",
     "beban": 241667,
     "akumulasi": 13775019,
     "nilai_buku": 724981,
     "jurnal_id": null
    },
    {
     "p": 58,
     "periode": "2031-07",
     "beban": 241667,
     "akumulasi": 14016686,
     "nilai_buku": 483314,
     "jurnal_id": null
    },
    {
     "p": 59,
     "periode": "2031-08",
     "beban": 241667,
     "akumulasi": 14258353,
     "nilai_buku": 241647,
     "jurnal_id": null
    },
    {
     "p": 60,
     "periode": "2031-09",
     "beban": 241647,
     "akumulasi": 14500000,
     "nilai_buku": 0,
     "jurnal_id": null
    }
   ]
  },
  "AST-0002": {
   "kode": "AST-0002",
   "pembelian_id": "BP-2026-0002",
   "tgl_perolehan": "2026-10-10",
   "bulan_mulai": "2026-10",
   "status": "aktif",
   "nama": "Moving Head Beam 230W",
   "barang_id": "ALT-02",
   "kategori_id": "KAT-01",
   "nilai_perolehan": 9800000,
   "residu": 0,
   "garansi_bulan": 12,
   "garansi_sampai": "2027-10-10",
   "masa_manfaat_bulan": 60,
   "dasar_n": "masa_manfaat",
   "n": 60,
   "d": 163333,
   "terakhir": 163353,
   "pengaman": false,
   "akun_aset": "1-150",
   "akun_akm": "1-151",
   "akun_beban": "6-110",
   "jadwal": [
    {
     "p": 1,
     "periode": "2026-10",
     "beban": 163333,
     "akumulasi": 163333,
     "nilai_buku": 9636667,
     "jurnal_id": null
    },
    {
     "p": 2,
     "periode": "2026-11",
     "beban": 163333,
     "akumulasi": 326666,
     "nilai_buku": 9473334,
     "jurnal_id": null
    },
    {
     "p": 3,
     "periode": "2026-12",
     "beban": 163333,
     "akumulasi": 489999,
     "nilai_buku": 9310001,
     "jurnal_id": null
    },
    {
     "p": 4,
     "periode": "2027-01",
     "beban": 163333,
     "akumulasi": 653332,
     "nilai_buku": 9146668,
     "jurnal_id": null
    },
    {
     "p": 5,
     "periode": "2027-02",
     "beban": 163333,
     "akumulasi": 816665,
     "nilai_buku": 8983335,
     "jurnal_id": null
    },
    {
     "p": 6,
     "periode": "2027-03",
     "beban": 163333,
     "akumulasi": 979998,
     "nilai_buku": 8820002,
     "jurnal_id": null
    },
    {
     "p": 7,
     "periode": "2027-04",
     "beban": 163333,
     "akumulasi": 1143331,
     "nilai_buku": 8656669,
     "jurnal_id": null
    },
    {
     "p": 8,
     "periode": "2027-05",
     "beban": 163333,
     "akumulasi": 1306664,
     "nilai_buku": 8493336,
     "jurnal_id": null
    },
    {
     "p": 9,
     "periode": "2027-06",
     "beban": 163333,
     "akumulasi": 1469997,
     "nilai_buku": 8330003,
     "jurnal_id": null
    },
    {
     "p": 10,
     "periode": "2027-07",
     "beban": 163333,
     "akumulasi": 1633330,
     "nilai_buku": 8166670,
     "jurnal_id": null
    },
    {
     "p": 11,
     "periode": "2027-08",
     "beban": 163333,
     "akumulasi": 1796663,
     "nilai_buku": 8003337,
     "jurnal_id": null
    },
    {
     "p": 12,
     "periode": "2027-09",
     "beban": 163333,
     "akumulasi": 1959996,
     "nilai_buku": 7840004,
     "jurnal_id": null
    },
    {
     "p": 13,
     "periode": "2027-10",
     "beban": 163333,
     "akumulasi": 2123329,
     "nilai_buku": 7676671,
     "jurnal_id": null
    },
    {
     "p": 14,
     "periode": "2027-11",
     "beban": 163333,
     "akumulasi": 2286662,
     "nilai_buku": 7513338,
     "jurnal_id": null
    },
    {
     "p": 15,
     "periode": "2027-12",
     "beban": 163333,
     "akumulasi": 2449995,
     "nilai_buku": 7350005,
     "jurnal_id": null
    },
    {
     "p": 16,
     "periode": "2028-01",
     "beban": 163333,
     "akumulasi": 2613328,
     "nilai_buku": 7186672,
     "jurnal_id": null
    },
    {
     "p": 17,
     "periode": "2028-02",
     "beban": 163333,
     "akumulasi": 2776661,
     "nilai_buku": 7023339,
     "jurnal_id": null
    },
    {
     "p": 18,
     "periode": "2028-03",
     "beban": 163333,
     "akumulasi": 2939994,
     "nilai_buku": 6860006,
     "jurnal_id": null
    },
    {
     "p": 19,
     "periode": "2028-04",
     "beban": 163333,
     "akumulasi": 3103327,
     "nilai_buku": 6696673,
     "jurnal_id": null
    },
    {
     "p": 20,
     "periode": "2028-05",
     "beban": 163333,
     "akumulasi": 3266660,
     "nilai_buku": 6533340,
     "jurnal_id": null
    },
    {
     "p": 21,
     "periode": "2028-06",
     "beban": 163333,
     "akumulasi": 3429993,
     "nilai_buku": 6370007,
     "jurnal_id": null
    },
    {
     "p": 22,
     "periode": "2028-07",
     "beban": 163333,
     "akumulasi": 3593326,
     "nilai_buku": 6206674,
     "jurnal_id": null
    },
    {
     "p": 23,
     "periode": "2028-08",
     "beban": 163333,
     "akumulasi": 3756659,
     "nilai_buku": 6043341,
     "jurnal_id": null
    },
    {
     "p": 24,
     "periode": "2028-09",
     "beban": 163333,
     "akumulasi": 3919992,
     "nilai_buku": 5880008,
     "jurnal_id": null
    },
    {
     "p": 25,
     "periode": "2028-10",
     "beban": 163333,
     "akumulasi": 4083325,
     "nilai_buku": 5716675,
     "jurnal_id": null
    },
    {
     "p": 26,
     "periode": "2028-11",
     "beban": 163333,
     "akumulasi": 4246658,
     "nilai_buku": 5553342,
     "jurnal_id": null
    },
    {
     "p": 27,
     "periode": "2028-12",
     "beban": 163333,
     "akumulasi": 4409991,
     "nilai_buku": 5390009,
     "jurnal_id": null
    },
    {
     "p": 28,
     "periode": "2029-01",
     "beban": 163333,
     "akumulasi": 4573324,
     "nilai_buku": 5226676,
     "jurnal_id": null
    },
    {
     "p": 29,
     "periode": "2029-02",
     "beban": 163333,
     "akumulasi": 4736657,
     "nilai_buku": 5063343,
     "jurnal_id": null
    },
    {
     "p": 30,
     "periode": "2029-03",
     "beban": 163333,
     "akumulasi": 4899990,
     "nilai_buku": 4900010,
     "jurnal_id": null
    },
    {
     "p": 31,
     "periode": "2029-04",
     "beban": 163333,
     "akumulasi": 5063323,
     "nilai_buku": 4736677,
     "jurnal_id": null
    },
    {
     "p": 32,
     "periode": "2029-05",
     "beban": 163333,
     "akumulasi": 5226656,
     "nilai_buku": 4573344,
     "jurnal_id": null
    },
    {
     "p": 33,
     "periode": "2029-06",
     "beban": 163333,
     "akumulasi": 5389989,
     "nilai_buku": 4410011,
     "jurnal_id": null
    },
    {
     "p": 34,
     "periode": "2029-07",
     "beban": 163333,
     "akumulasi": 5553322,
     "nilai_buku": 4246678,
     "jurnal_id": null
    },
    {
     "p": 35,
     "periode": "2029-08",
     "beban": 163333,
     "akumulasi": 5716655,
     "nilai_buku": 4083345,
     "jurnal_id": null
    },
    {
     "p": 36,
     "periode": "2029-09",
     "beban": 163333,
     "akumulasi": 5879988,
     "nilai_buku": 3920012,
     "jurnal_id": null
    },
    {
     "p": 37,
     "periode": "2029-10",
     "beban": 163333,
     "akumulasi": 6043321,
     "nilai_buku": 3756679,
     "jurnal_id": null
    },
    {
     "p": 38,
     "periode": "2029-11",
     "beban": 163333,
     "akumulasi": 6206654,
     "nilai_buku": 3593346,
     "jurnal_id": null
    },
    {
     "p": 39,
     "periode": "2029-12",
     "beban": 163333,
     "akumulasi": 6369987,
     "nilai_buku": 3430013,
     "jurnal_id": null
    },
    {
     "p": 40,
     "periode": "2030-01",
     "beban": 163333,
     "akumulasi": 6533320,
     "nilai_buku": 3266680,
     "jurnal_id": null
    },
    {
     "p": 41,
     "periode": "2030-02",
     "beban": 163333,
     "akumulasi": 6696653,
     "nilai_buku": 3103347,
     "jurnal_id": null
    },
    {
     "p": 42,
     "periode": "2030-03",
     "beban": 163333,
     "akumulasi": 6859986,
     "nilai_buku": 2940014,
     "jurnal_id": null
    },
    {
     "p": 43,
     "periode": "2030-04",
     "beban": 163333,
     "akumulasi": 7023319,
     "nilai_buku": 2776681,
     "jurnal_id": null
    },
    {
     "p": 44,
     "periode": "2030-05",
     "beban": 163333,
     "akumulasi": 7186652,
     "nilai_buku": 2613348,
     "jurnal_id": null
    },
    {
     "p": 45,
     "periode": "2030-06",
     "beban": 163333,
     "akumulasi": 7349985,
     "nilai_buku": 2450015,
     "jurnal_id": null
    },
    {
     "p": 46,
     "periode": "2030-07",
     "beban": 163333,
     "akumulasi": 7513318,
     "nilai_buku": 2286682,
     "jurnal_id": null
    },
    {
     "p": 47,
     "periode": "2030-08",
     "beban": 163333,
     "akumulasi": 7676651,
     "nilai_buku": 2123349,
     "jurnal_id": null
    },
    {
     "p": 48,
     "periode": "2030-09",
     "beban": 163333,
     "akumulasi": 7839984,
     "nilai_buku": 1960016,
     "jurnal_id": null
    },
    {
     "p": 49,
     "periode": "2030-10",
     "beban": 163333,
     "akumulasi": 8003317,
     "nilai_buku": 1796683,
     "jurnal_id": null
    },
    {
     "p": 50,
     "periode": "2030-11",
     "beban": 163333,
     "akumulasi": 8166650,
     "nilai_buku": 1633350,
     "jurnal_id": null
    },
    {
     "p": 51,
     "periode": "2030-12",
     "beban": 163333,
     "akumulasi": 8329983,
     "nilai_buku": 1470017,
     "jurnal_id": null
    },
    {
     "p": 52,
     "periode": "2031-01",
     "beban": 163333,
     "akumulasi": 8493316,
     "nilai_buku": 1306684,
     "jurnal_id": null
    },
    {
     "p": 53,
     "periode": "2031-02",
     "beban": 163333,
     "akumulasi": 8656649,
     "nilai_buku": 1143351,
     "jurnal_id": null
    },
    {
     "p": 54,
     "periode": "2031-03",
     "beban": 163333,
     "akumulasi": 8819982,
     "nilai_buku": 980018,
     "jurnal_id": null
    },
    {
     "p": 55,
     "periode": "2031-04",
     "beban": 163333,
     "akumulasi": 8983315,
     "nilai_buku": 816685,
     "jurnal_id": null
    },
    {
     "p": 56,
     "periode": "2031-05",
     "beban": 163333,
     "akumulasi": 9146648,
     "nilai_buku": 653352,
     "jurnal_id": null
    },
    {
     "p": 57,
     "periode": "2031-06",
     "beban": 163333,
     "akumulasi": 9309981,
     "nilai_buku": 490019,
     "jurnal_id": null
    },
    {
     "p": 58,
     "periode": "2031-07",
     "beban": 163333,
     "akumulasi": 9473314,
     "nilai_buku": 326686,
     "jurnal_id": null
    },
    {
     "p": 59,
     "periode": "2031-08",
     "beban": 163333,
     "akumulasi": 9636647,
     "nilai_buku": 163353,
     "jurnal_id": null
    },
    {
     "p": 60,
     "periode": "2031-09",
     "beban": 163353,
     "akumulasi": 9800000,
     "nilai_buku": 0,
     "jurnal_id": null
    }
   ]
  },
  "AST-0003": {
   "kode": "AST-0003",
   "pembelian_id": "BP-2026-0003",
   "tgl_perolehan": "2026-10-15",
   "bulan_mulai": "2026-10",
   "status": "aktif",
   "nama": "Handy Talky (HT)",
   "barang_id": "ALT-05",
   "kategori_id": "KAT-03",
   "nilai_perolehan": 950000,
   "residu": 0,
   "garansi_bulan": 24,
   "garansi_sampai": "2028-10-15",
   "masa_manfaat_bulan": 24,
   "dasar_n": "garansi",
   "n": 24,
   "d": 39583,
   "terakhir": 39591,
   "pengaman": false,
   "akun_aset": "1-150",
   "akun_akm": "1-151",
   "akun_beban": "6-110",
   "jadwal": [
    {
     "p": 1,
     "periode": "2026-10",
     "beban": 39583,
     "akumulasi": 39583,
     "nilai_buku": 910417,
     "jurnal_id": null
    },
    {
     "p": 2,
     "periode": "2026-11",
     "beban": 39583,
     "akumulasi": 79166,
     "nilai_buku": 870834,
     "jurnal_id": null
    },
    {
     "p": 3,
     "periode": "2026-12",
     "beban": 39583,
     "akumulasi": 118749,
     "nilai_buku": 831251,
     "jurnal_id": null
    },
    {
     "p": 4,
     "periode": "2027-01",
     "beban": 39583,
     "akumulasi": 158332,
     "nilai_buku": 791668,
     "jurnal_id": null
    },
    {
     "p": 5,
     "periode": "2027-02",
     "beban": 39583,
     "akumulasi": 197915,
     "nilai_buku": 752085,
     "jurnal_id": null
    },
    {
     "p": 6,
     "periode": "2027-03",
     "beban": 39583,
     "akumulasi": 237498,
     "nilai_buku": 712502,
     "jurnal_id": null
    },
    {
     "p": 7,
     "periode": "2027-04",
     "beban": 39583,
     "akumulasi": 277081,
     "nilai_buku": 672919,
     "jurnal_id": null
    },
    {
     "p": 8,
     "periode": "2027-05",
     "beban": 39583,
     "akumulasi": 316664,
     "nilai_buku": 633336,
     "jurnal_id": null
    },
    {
     "p": 9,
     "periode": "2027-06",
     "beban": 39583,
     "akumulasi": 356247,
     "nilai_buku": 593753,
     "jurnal_id": null
    },
    {
     "p": 10,
     "periode": "2027-07",
     "beban": 39583,
     "akumulasi": 395830,
     "nilai_buku": 554170,
     "jurnal_id": null
    },
    {
     "p": 11,
     "periode": "2027-08",
     "beban": 39583,
     "akumulasi": 435413,
     "nilai_buku": 514587,
     "jurnal_id": null
    },
    {
     "p": 12,
     "periode": "2027-09",
     "beban": 39583,
     "akumulasi": 474996,
     "nilai_buku": 475004,
     "jurnal_id": null
    },
    {
     "p": 13,
     "periode": "2027-10",
     "beban": 39583,
     "akumulasi": 514579,
     "nilai_buku": 435421,
     "jurnal_id": null
    },
    {
     "p": 14,
     "periode": "2027-11",
     "beban": 39583,
     "akumulasi": 554162,
     "nilai_buku": 395838,
     "jurnal_id": null
    },
    {
     "p": 15,
     "periode": "2027-12",
     "beban": 39583,
     "akumulasi": 593745,
     "nilai_buku": 356255,
     "jurnal_id": null
    },
    {
     "p": 16,
     "periode": "2028-01",
     "beban": 39583,
     "akumulasi": 633328,
     "nilai_buku": 316672,
     "jurnal_id": null
    },
    {
     "p": 17,
     "periode": "2028-02",
     "beban": 39583,
     "akumulasi": 672911,
     "nilai_buku": 277089,
     "jurnal_id": null
    },
    {
     "p": 18,
     "periode": "2028-03",
     "beban": 39583,
     "akumulasi": 712494,
     "nilai_buku": 237506,
     "jurnal_id": null
    },
    {
     "p": 19,
     "periode": "2028-04",
     "beban": 39583,
     "akumulasi": 752077,
     "nilai_buku": 197923,
     "jurnal_id": null
    },
    {
     "p": 20,
     "periode": "2028-05",
     "beban": 39583,
     "akumulasi": 791660,
     "nilai_buku": 158340,
     "jurnal_id": null
    },
    {
     "p": 21,
     "periode": "2028-06",
     "beban": 39583,
     "akumulasi": 831243,
     "nilai_buku": 118757,
     "jurnal_id": null
    },
    {
     "p": 22,
     "periode": "2028-07",
     "beban": 39583,
     "akumulasi": 870826,
     "nilai_buku": 79174,
     "jurnal_id": null
    },
    {
     "p": 23,
     "periode": "2028-08",
     "beban": 39583,
     "akumulasi": 910409,
     "nilai_buku": 39591,
     "jurnal_id": null
    },
    {
     "p": 24,
     "periode": "2028-09",
     "beban": 39591,
     "akumulasi": 950000,
     "nilai_buku": 0,
     "jurnal_id": null
    }
   ]
  },
  "AST-0004": {
   "kode": "AST-0004",
   "pembelian_id": "BP-2026-0003",
   "tgl_perolehan": "2026-10-15",
   "bulan_mulai": "2026-10",
   "status": "aktif",
   "nama": "Handy Talky (HT)",
   "barang_id": "ALT-05",
   "kategori_id": "KAT-03",
   "nilai_perolehan": 950000,
   "residu": 0,
   "garansi_bulan": 24,
   "garansi_sampai": "2028-10-15",
   "masa_manfaat_bulan": 24,
   "dasar_n": "garansi",
   "n": 24,
   "d": 39583,
   "terakhir": 39591,
   "pengaman": false,
   "akun_aset": "1-150",
   "akun_akm": "1-151",
   "akun_beban": "6-110",
   "jadwal": [
    {
     "p": 1,
     "periode": "2026-10",
     "beban": 39583,
     "akumulasi": 39583,
     "nilai_buku": 910417,
     "jurnal_id": null
    },
    {
     "p": 2,
     "periode": "2026-11",
     "beban": 39583,
     "akumulasi": 79166,
     "nilai_buku": 870834,
     "jurnal_id": null
    },
    {
     "p": 3,
     "periode": "2026-12",
     "beban": 39583,
     "akumulasi": 118749,
     "nilai_buku": 831251,
     "jurnal_id": null
    },
    {
     "p": 4,
     "periode": "2027-01",
     "beban": 39583,
     "akumulasi": 158332,
     "nilai_buku": 791668,
     "jurnal_id": null
    },
    {
     "p": 5,
     "periode": "2027-02",
     "beban": 39583,
     "akumulasi": 197915,
     "nilai_buku": 752085,
     "jurnal_id": null
    },
    {
     "p": 6,
     "periode": "2027-03",
     "beban": 39583,
     "akumulasi": 237498,
     "nilai_buku": 712502,
     "jurnal_id": null
    },
    {
     "p": 7,
     "periode": "2027-04",
     "beban": 39583,
     "akumulasi": 277081,
     "nilai_buku": 672919,
     "jurnal_id": null
    },
    {
     "p": 8,
     "periode": "2027-05",
     "beban": 39583,
     "akumulasi": 316664,
     "nilai_buku": 633336,
     "jurnal_id": null
    },
    {
     "p": 9,
     "periode": "2027-06",
     "beban": 39583,
     "akumulasi": 356247,
     "nilai_buku": 593753,
     "jurnal_id": null
    },
    {
     "p": 10,
     "periode": "2027-07",
     "beban": 39583,
     "akumulasi": 395830,
     "nilai_buku": 554170,
     "jurnal_id": null
    },
    {
     "p": 11,
     "periode": "2027-08",
     "beban": 39583,
     "akumulasi": 435413,
     "nilai_buku": 514587,
     "jurnal_id": null
    },
    {
     "p": 12,
     "periode": "2027-09",
     "beban": 39583,
     "akumulasi": 474996,
     "nilai_buku": 475004,
     "jurnal_id": null
    },
    {
     "p": 13,
     "periode": "2027-10",
     "beban": 39583,
     "akumulasi": 514579,
     "nilai_buku": 435421,
     "jurnal_id": null
    },
    {
     "p": 14,
     "periode": "2027-11",
     "beban": 39583,
     "akumulasi": 554162,
     "nilai_buku": 395838,
     "jurnal_id": null
    },
    {
     "p": 15,
     "periode": "2027-12",
     "beban": 39583,
     "akumulasi": 593745,
     "nilai_buku": 356255,
     "jurnal_id": null
    },
    {
     "p": 16,
     "periode": "2028-01",
     "beban": 39583,
     "akumulasi": 633328,
     "nilai_buku": 316672,
     "jurnal_id": null
    },
    {
     "p": 17,
     "periode": "2028-02",
     "beban": 39583,
     "akumulasi": 672911,
     "nilai_buku": 277089,
     "jurnal_id": null
    },
    {
     "p": 18,
     "periode": "2028-03",
     "beban": 39583,
     "akumulasi": 712494,
     "nilai_buku": 237506,
     "jurnal_id": null
    },
    {
     "p": 19,
     "periode": "2028-04",
     "beban": 39583,
     "akumulasi": 752077,
     "nilai_buku": 197923,
     "jurnal_id": null
    },
    {
     "p": 20,
     "periode": "2028-05",
     "beban": 39583,
     "akumulasi": 791660,
     "nilai_buku": 158340,
     "jurnal_id": null
    },
    {
     "p": 21,
     "periode": "2028-06",
     "beban": 39583,
     "akumulasi": 831243,
     "nilai_buku": 118757,
     "jurnal_id": null
    },
    {
     "p": 22,
     "periode": "2028-07",
     "beban": 39583,
     "akumulasi": 870826,
     "nilai_buku": 79174,
     "jurnal_id": null
    },
    {
     "p": 23,
     "periode": "2028-08",
     "beban": 39583,
     "akumulasi": 910409,
     "nilai_buku": 39591,
     "jurnal_id": null
    },
    {
     "p": 24,
     "periode": "2028-09",
     "beban": 39591,
     "akumulasi": 950000,
     "nilai_buku": 0,
     "jurnal_id": null
    }
   ]
  },
  "AST-0005": {
   "kode": "AST-0005",
   "pembelian_id": "BP-2026-0003",
   "tgl_perolehan": "2026-10-15",
   "bulan_mulai": "2026-10",
   "status": "aktif",
   "nama": "Handy Talky (HT)",
   "barang_id": "ALT-05",
   "kategori_id": "KAT-03",
   "nilai_perolehan": 950000,
   "residu": 0,
   "garansi_bulan": 24,
   "garansi_sampai": "2028-10-15",
   "masa_manfaat_bulan": 24,
   "dasar_n": "garansi",
   "n": 24,
   "d": 39583,
   "terakhir": 39591,
   "pengaman": false,
   "akun_aset": "1-150",
   "akun_akm": "1-151",
   "akun_beban": "6-110",
   "jadwal": [
    {
     "p": 1,
     "periode": "2026-10",
     "beban": 39583,
     "akumulasi": 39583,
     "nilai_buku": 910417,
     "jurnal_id": null
    },
    {
     "p": 2,
     "periode": "2026-11",
     "beban": 39583,
     "akumulasi": 79166,
     "nilai_buku": 870834,
     "jurnal_id": null
    },
    {
     "p": 3,
     "periode": "2026-12",
     "beban": 39583,
     "akumulasi": 118749,
     "nilai_buku": 831251,
     "jurnal_id": null
    },
    {
     "p": 4,
     "periode": "2027-01",
     "beban": 39583,
     "akumulasi": 158332,
     "nilai_buku": 791668,
     "jurnal_id": null
    },
    {
     "p": 5,
     "periode": "2027-02",
     "beban": 39583,
     "akumulasi": 197915,
     "nilai_buku": 752085,
     "jurnal_id": null
    },
    {
     "p": 6,
     "periode": "2027-03",
     "beban": 39583,
     "akumulasi": 237498,
     "nilai_buku": 712502,
     "jurnal_id": null
    },
    {
     "p": 7,
     "periode": "2027-04",
     "beban": 39583,
     "akumulasi": 277081,
     "nilai_buku": 672919,
     "jurnal_id": null
    },
    {
     "p": 8,
     "periode": "2027-05",
     "beban": 39583,
     "akumulasi": 316664,
     "nilai_buku": 633336,
     "jurnal_id": null
    },
    {
     "p": 9,
     "periode": "2027-06",
     "beban": 39583,
     "akumulasi": 356247,
     "nilai_buku": 593753,
     "jurnal_id": null
    },
    {
     "p": 10,
     "periode": "2027-07",
     "beban": 39583,
     "akumulasi": 395830,
     "nilai_buku": 554170,
     "jurnal_id": null
    },
    {
     "p": 11,
     "periode": "2027-08",
     "beban": 39583,
     "akumulasi": 435413,
     "nilai_buku": 514587,
     "jurnal_id": null
    },
    {
     "p": 12,
     "periode": "2027-09",
     "beban": 39583,
     "akumulasi": 474996,
     "nilai_buku": 475004,
     "jurnal_id": null
    },
    {
     "p": 13,
     "periode": "2027-10",
     "beban": 39583,
     "akumulasi": 514579,
     "nilai_buku": 435421,
     "jurnal_id": null
    },
    {
     "p": 14,
     "periode": "2027-11",
     "beban": 39583,
     "akumulasi": 554162,
     "nilai_buku": 395838,
     "jurnal_id": null
    },
    {
     "p": 15,
     "periode": "2027-12",
     "beban": 39583,
     "akumulasi": 593745,
     "nilai_buku": 356255,
     "jurnal_id": null
    },
    {
     "p": 16,
     "periode": "2028-01",
     "beban": 39583,
     "akumulasi": 633328,
     "nilai_buku": 316672,
     "jurnal_id": null
    },
    {
     "p": 17,
     "periode": "2028-02",
     "beban": 39583,
     "akumulasi": 672911,
     "nilai_buku": 277089,
     "jurnal_id": null
    },
    {
     "p": 18,
     "periode": "2028-03",
     "beban": 39583,
     "akumulasi": 712494,
     "nilai_buku": 237506,
     "jurnal_id": null
    },
    {
     "p": 19,
     "periode": "2028-04",
     "beban": 39583,
     "akumulasi": 752077,
     "nilai_buku": 197923,
     "jurnal_id": null
    },
    {
     "p": 20,
     "periode": "2028-05",
     "beban": 39583,
     "akumulasi": 791660,
     "nilai_buku": 158340,
     "jurnal_id": null
    },
    {
     "p": 21,
     "periode": "2028-06",
     "beban": 39583,
     "akumulasi": 831243,
     "nilai_buku": 118757,
     "jurnal_id": null
    },
    {
     "p": 22,
     "periode": "2028-07",
     "beban": 39583,
     "akumulasi": 870826,
     "nilai_buku": 79174,
     "jurnal_id": null
    },
    {
     "p": 23,
     "periode": "2028-08",
     "beban": 39583,
     "akumulasi": 910409,
     "nilai_buku": 39591,
     "jurnal_id": null
    },
    {
     "p": 24,
     "periode": "2028-09",
     "beban": 39591,
     "akumulasi": 950000,
     "nilai_buku": 0,
     "jurnal_id": null
    }
   ]
  },
  "AST-0006": {
   "kode": "AST-0006",
   "pembelian_id": "BP-2026-0003",
   "tgl_perolehan": "2026-10-15",
   "bulan_mulai": "2026-10",
   "status": "aktif",
   "nama": "Handy Talky (HT)",
   "barang_id": "ALT-05",
   "kategori_id": "KAT-03",
   "nilai_perolehan": 950000,
   "residu": 0,
   "garansi_bulan": 24,
   "garansi_sampai": "2028-10-15",
   "masa_manfaat_bulan": 24,
   "dasar_n": "garansi",
   "n": 24,
   "d": 39583,
   "terakhir": 39591,
   "pengaman": false,
   "akun_aset": "1-150",
   "akun_akm": "1-151",
   "akun_beban": "6-110",
   "jadwal": [
    {
     "p": 1,
     "periode": "2026-10",
     "beban": 39583,
     "akumulasi": 39583,
     "nilai_buku": 910417,
     "jurnal_id": null
    },
    {
     "p": 2,
     "periode": "2026-11",
     "beban": 39583,
     "akumulasi": 79166,
     "nilai_buku": 870834,
     "jurnal_id": null
    },
    {
     "p": 3,
     "periode": "2026-12",
     "beban": 39583,
     "akumulasi": 118749,
     "nilai_buku": 831251,
     "jurnal_id": null
    },
    {
     "p": 4,
     "periode": "2027-01",
     "beban": 39583,
     "akumulasi": 158332,
     "nilai_buku": 791668,
     "jurnal_id": null
    },
    {
     "p": 5,
     "periode": "2027-02",
     "beban": 39583,
     "akumulasi": 197915,
     "nilai_buku": 752085,
     "jurnal_id": null
    },
    {
     "p": 6,
     "periode": "2027-03",
     "beban": 39583,
     "akumulasi": 237498,
     "nilai_buku": 712502,
     "jurnal_id": null
    },
    {
     "p": 7,
     "periode": "2027-04",
     "beban": 39583,
     "akumulasi": 277081,
     "nilai_buku": 672919,
     "jurnal_id": null
    },
    {
     "p": 8,
     "periode": "2027-05",
     "beban": 39583,
     "akumulasi": 316664,
     "nilai_buku": 633336,
     "jurnal_id": null
    },
    {
     "p": 9,
     "periode": "2027-06",
     "beban": 39583,
     "akumulasi": 356247,
     "nilai_buku": 593753,
     "jurnal_id": null
    },
    {
     "p": 10,
     "periode": "2027-07",
     "beban": 39583,
     "akumulasi": 395830,
     "nilai_buku": 554170,
     "jurnal_id": null
    },
    {
     "p": 11,
     "periode": "2027-08",
     "beban": 39583,
     "akumulasi": 435413,
     "nilai_buku": 514587,
     "jurnal_id": null
    },
    {
     "p": 12,
     "periode": "2027-09",
     "beban": 39583,
     "akumulasi": 474996,
     "nilai_buku": 475004,
     "jurnal_id": null
    },
    {
     "p": 13,
     "periode": "2027-10",
     "beban": 39583,
     "akumulasi": 514579,
     "nilai_buku": 435421,
     "jurnal_id": null
    },
    {
     "p": 14,
     "periode": "2027-11",
     "beban": 39583,
     "akumulasi": 554162,
     "nilai_buku": 395838,
     "jurnal_id": null
    },
    {
     "p": 15,
     "periode": "2027-12",
     "beban": 39583,
     "akumulasi": 593745,
     "nilai_buku": 356255,
     "jurnal_id": null
    },
    {
     "p": 16,
     "periode": "2028-01",
     "beban": 39583,
     "akumulasi": 633328,
     "nilai_buku": 316672,
     "jurnal_id": null
    },
    {
     "p": 17,
     "periode": "2028-02",
     "beban": 39583,
     "akumulasi": 672911,
     "nilai_buku": 277089,
     "jurnal_id": null
    },
    {
     "p": 18,
     "periode": "2028-03",
     "beban": 39583,
     "akumulasi": 712494,
     "nilai_buku": 237506,
     "jurnal_id": null
    },
    {
     "p": 19,
     "periode": "2028-04",
     "beban": 39583,
     "akumulasi": 752077,
     "nilai_buku": 197923,
     "jurnal_id": null
    },
    {
     "p": 20,
     "periode": "2028-05",
     "beban": 39583,
     "akumulasi": 791660,
     "nilai_buku": 158340,
     "jurnal_id": null
    },
    {
     "p": 21,
     "periode": "2028-06",
     "beban": 39583,
     "akumulasi": 831243,
     "nilai_buku": 118757,
     "jurnal_id": null
    },
    {
     "p": 22,
     "periode": "2028-07",
     "beban": 39583,
     "akumulasi": 870826,
     "nilai_buku": 79174,
     "jurnal_id": null
    },
    {
     "p": 23,
     "periode": "2028-08",
     "beban": 39583,
     "akumulasi": 910409,
     "nilai_buku": 39591,
     "jurnal_id": null
    },
    {
     "p": 24,
     "periode": "2028-09",
     "beban": 39591,
     "akumulasi": 950000,
     "nilai_buku": 0,
     "jurnal_id": null
    }
   ]
  },
  "AST-0007": {
   "kode": "AST-0007",
   "pembelian_id": "BP-2026-0004",
   "tgl_perolehan": "2026-10-20",
   "bulan_mulai": "2026-10",
   "status": "aktif",
   "nama": "Kamera Mirrorless",
   "barang_id": "ALT-04",
   "kategori_id": "KAT-02",
   "nilai_perolehan": 18500000,
   "residu": 0,
   "garansi_bulan": 12,
   "garansi_sampai": "2027-10-20",
   "masa_manfaat_bulan": 48,
   "dasar_n": "masa_manfaat",
   "n": 48,
   "d": 385417,
   "terakhir": 385401,
   "pengaman": false,
   "akun_aset": "1-150",
   "akun_akm": "1-151",
   "akun_beban": "6-110",
   "jadwal": [
    {
     "p": 1,
     "periode": "2026-10",
     "beban": 385417,
     "akumulasi": 385417,
     "nilai_buku": 18114583,
     "jurnal_id": null
    },
    {
     "p": 2,
     "periode": "2026-11",
     "beban": 385417,
     "akumulasi": 770834,
     "nilai_buku": 17729166,
     "jurnal_id": null
    },
    {
     "p": 3,
     "periode": "2026-12",
     "beban": 385417,
     "akumulasi": 1156251,
     "nilai_buku": 17343749,
     "jurnal_id": null
    },
    {
     "p": 4,
     "periode": "2027-01",
     "beban": 385417,
     "akumulasi": 1541668,
     "nilai_buku": 16958332,
     "jurnal_id": null
    },
    {
     "p": 5,
     "periode": "2027-02",
     "beban": 385417,
     "akumulasi": 1927085,
     "nilai_buku": 16572915,
     "jurnal_id": null
    },
    {
     "p": 6,
     "periode": "2027-03",
     "beban": 385417,
     "akumulasi": 2312502,
     "nilai_buku": 16187498,
     "jurnal_id": null
    },
    {
     "p": 7,
     "periode": "2027-04",
     "beban": 385417,
     "akumulasi": 2697919,
     "nilai_buku": 15802081,
     "jurnal_id": null
    },
    {
     "p": 8,
     "periode": "2027-05",
     "beban": 385417,
     "akumulasi": 3083336,
     "nilai_buku": 15416664,
     "jurnal_id": null
    },
    {
     "p": 9,
     "periode": "2027-06",
     "beban": 385417,
     "akumulasi": 3468753,
     "nilai_buku": 15031247,
     "jurnal_id": null
    },
    {
     "p": 10,
     "periode": "2027-07",
     "beban": 385417,
     "akumulasi": 3854170,
     "nilai_buku": 14645830,
     "jurnal_id": null
    },
    {
     "p": 11,
     "periode": "2027-08",
     "beban": 385417,
     "akumulasi": 4239587,
     "nilai_buku": 14260413,
     "jurnal_id": null
    },
    {
     "p": 12,
     "periode": "2027-09",
     "beban": 385417,
     "akumulasi": 4625004,
     "nilai_buku": 13874996,
     "jurnal_id": null
    },
    {
     "p": 13,
     "periode": "2027-10",
     "beban": 385417,
     "akumulasi": 5010421,
     "nilai_buku": 13489579,
     "jurnal_id": null
    },
    {
     "p": 14,
     "periode": "2027-11",
     "beban": 385417,
     "akumulasi": 5395838,
     "nilai_buku": 13104162,
     "jurnal_id": null
    },
    {
     "p": 15,
     "periode": "2027-12",
     "beban": 385417,
     "akumulasi": 5781255,
     "nilai_buku": 12718745,
     "jurnal_id": null
    },
    {
     "p": 16,
     "periode": "2028-01",
     "beban": 385417,
     "akumulasi": 6166672,
     "nilai_buku": 12333328,
     "jurnal_id": null
    },
    {
     "p": 17,
     "periode": "2028-02",
     "beban": 385417,
     "akumulasi": 6552089,
     "nilai_buku": 11947911,
     "jurnal_id": null
    },
    {
     "p": 18,
     "periode": "2028-03",
     "beban": 385417,
     "akumulasi": 6937506,
     "nilai_buku": 11562494,
     "jurnal_id": null
    },
    {
     "p": 19,
     "periode": "2028-04",
     "beban": 385417,
     "akumulasi": 7322923,
     "nilai_buku": 11177077,
     "jurnal_id": null
    },
    {
     "p": 20,
     "periode": "2028-05",
     "beban": 385417,
     "akumulasi": 7708340,
     "nilai_buku": 10791660,
     "jurnal_id": null
    },
    {
     "p": 21,
     "periode": "2028-06",
     "beban": 385417,
     "akumulasi": 8093757,
     "nilai_buku": 10406243,
     "jurnal_id": null
    },
    {
     "p": 22,
     "periode": "2028-07",
     "beban": 385417,
     "akumulasi": 8479174,
     "nilai_buku": 10020826,
     "jurnal_id": null
    },
    {
     "p": 23,
     "periode": "2028-08",
     "beban": 385417,
     "akumulasi": 8864591,
     "nilai_buku": 9635409,
     "jurnal_id": null
    },
    {
     "p": 24,
     "periode": "2028-09",
     "beban": 385417,
     "akumulasi": 9250008,
     "nilai_buku": 9249992,
     "jurnal_id": null
    },
    {
     "p": 25,
     "periode": "2028-10",
     "beban": 385417,
     "akumulasi": 9635425,
     "nilai_buku": 8864575,
     "jurnal_id": null
    },
    {
     "p": 26,
     "periode": "2028-11",
     "beban": 385417,
     "akumulasi": 10020842,
     "nilai_buku": 8479158,
     "jurnal_id": null
    },
    {
     "p": 27,
     "periode": "2028-12",
     "beban": 385417,
     "akumulasi": 10406259,
     "nilai_buku": 8093741,
     "jurnal_id": null
    },
    {
     "p": 28,
     "periode": "2029-01",
     "beban": 385417,
     "akumulasi": 10791676,
     "nilai_buku": 7708324,
     "jurnal_id": null
    },
    {
     "p": 29,
     "periode": "2029-02",
     "beban": 385417,
     "akumulasi": 11177093,
     "nilai_buku": 7322907,
     "jurnal_id": null
    },
    {
     "p": 30,
     "periode": "2029-03",
     "beban": 385417,
     "akumulasi": 11562510,
     "nilai_buku": 6937490,
     "jurnal_id": null
    },
    {
     "p": 31,
     "periode": "2029-04",
     "beban": 385417,
     "akumulasi": 11947927,
     "nilai_buku": 6552073,
     "jurnal_id": null
    },
    {
     "p": 32,
     "periode": "2029-05",
     "beban": 385417,
     "akumulasi": 12333344,
     "nilai_buku": 6166656,
     "jurnal_id": null
    },
    {
     "p": 33,
     "periode": "2029-06",
     "beban": 385417,
     "akumulasi": 12718761,
     "nilai_buku": 5781239,
     "jurnal_id": null
    },
    {
     "p": 34,
     "periode": "2029-07",
     "beban": 385417,
     "akumulasi": 13104178,
     "nilai_buku": 5395822,
     "jurnal_id": null
    },
    {
     "p": 35,
     "periode": "2029-08",
     "beban": 385417,
     "akumulasi": 13489595,
     "nilai_buku": 5010405,
     "jurnal_id": null
    },
    {
     "p": 36,
     "periode": "2029-09",
     "beban": 385417,
     "akumulasi": 13875012,
     "nilai_buku": 4624988,
     "jurnal_id": null
    },
    {
     "p": 37,
     "periode": "2029-10",
     "beban": 385417,
     "akumulasi": 14260429,
     "nilai_buku": 4239571,
     "jurnal_id": null
    },
    {
     "p": 38,
     "periode": "2029-11",
     "beban": 385417,
     "akumulasi": 14645846,
     "nilai_buku": 3854154,
     "jurnal_id": null
    },
    {
     "p": 39,
     "periode": "2029-12",
     "beban": 385417,
     "akumulasi": 15031263,
     "nilai_buku": 3468737,
     "jurnal_id": null
    },
    {
     "p": 40,
     "periode": "2030-01",
     "beban": 385417,
     "akumulasi": 15416680,
     "nilai_buku": 3083320,
     "jurnal_id": null
    },
    {
     "p": 41,
     "periode": "2030-02",
     "beban": 385417,
     "akumulasi": 15802097,
     "nilai_buku": 2697903,
     "jurnal_id": null
    },
    {
     "p": 42,
     "periode": "2030-03",
     "beban": 385417,
     "akumulasi": 16187514,
     "nilai_buku": 2312486,
     "jurnal_id": null
    },
    {
     "p": 43,
     "periode": "2030-04",
     "beban": 385417,
     "akumulasi": 16572931,
     "nilai_buku": 1927069,
     "jurnal_id": null
    },
    {
     "p": 44,
     "periode": "2030-05",
     "beban": 385417,
     "akumulasi": 16958348,
     "nilai_buku": 1541652,
     "jurnal_id": null
    },
    {
     "p": 45,
     "periode": "2030-06",
     "beban": 385417,
     "akumulasi": 17343765,
     "nilai_buku": 1156235,
     "jurnal_id": null
    },
    {
     "p": 46,
     "periode": "2030-07",
     "beban": 385417,
     "akumulasi": 17729182,
     "nilai_buku": 770818,
     "jurnal_id": null
    },
    {
     "p": 47,
     "periode": "2030-08",
     "beban": 385417,
     "akumulasi": 18114599,
     "nilai_buku": 385401,
     "jurnal_id": null
    },
    {
     "p": 48,
     "periode": "2030-09",
     "beban": 385401,
     "akumulasi": 18500000,
     "nilai_buku": 0,
     "jurnal_id": null
    }
   ]
  },
  "AST-0008": {
   "kode": "AST-0008",
   "pembelian_id": "BP-2026-0005",
   "tgl_perolehan": "2026-10-22",
   "bulan_mulai": "2026-10",
   "status": "aktif",
   "nama": "Mixer Digital 16 Channel",
   "barang_id": "ALT-03",
   "kategori_id": "KAT-01",
   "nilai_perolehan": 8900000,
   "residu": 0,
   "garansi_bulan": 12,
   "garansi_sampai": "2027-10-22",
   "masa_manfaat_bulan": 60,
   "dasar_n": "masa_manfaat",
   "n": 60,
   "d": 148333,
   "terakhir": 148353,
   "pengaman": false,
   "akun_aset": "1-150",
   "akun_akm": "1-151",
   "akun_beban": "6-110",
   "jadwal": [
    {
     "p": 1,
     "periode": "2026-10",
     "beban": 148333,
     "akumulasi": 148333,
     "nilai_buku": 8751667,
     "jurnal_id": null
    },
    {
     "p": 2,
     "periode": "2026-11",
     "beban": 148333,
     "akumulasi": 296666,
     "nilai_buku": 8603334,
     "jurnal_id": null
    },
    {
     "p": 3,
     "periode": "2026-12",
     "beban": 148333,
     "akumulasi": 444999,
     "nilai_buku": 8455001,
     "jurnal_id": null
    },
    {
     "p": 4,
     "periode": "2027-01",
     "beban": 148333,
     "akumulasi": 593332,
     "nilai_buku": 8306668,
     "jurnal_id": null
    },
    {
     "p": 5,
     "periode": "2027-02",
     "beban": 148333,
     "akumulasi": 741665,
     "nilai_buku": 8158335,
     "jurnal_id": null
    },
    {
     "p": 6,
     "periode": "2027-03",
     "beban": 148333,
     "akumulasi": 889998,
     "nilai_buku": 8010002,
     "jurnal_id": null
    },
    {
     "p": 7,
     "periode": "2027-04",
     "beban": 148333,
     "akumulasi": 1038331,
     "nilai_buku": 7861669,
     "jurnal_id": null
    },
    {
     "p": 8,
     "periode": "2027-05",
     "beban": 148333,
     "akumulasi": 1186664,
     "nilai_buku": 7713336,
     "jurnal_id": null
    },
    {
     "p": 9,
     "periode": "2027-06",
     "beban": 148333,
     "akumulasi": 1334997,
     "nilai_buku": 7565003,
     "jurnal_id": null
    },
    {
     "p": 10,
     "periode": "2027-07",
     "beban": 148333,
     "akumulasi": 1483330,
     "nilai_buku": 7416670,
     "jurnal_id": null
    },
    {
     "p": 11,
     "periode": "2027-08",
     "beban": 148333,
     "akumulasi": 1631663,
     "nilai_buku": 7268337,
     "jurnal_id": null
    },
    {
     "p": 12,
     "periode": "2027-09",
     "beban": 148333,
     "akumulasi": 1779996,
     "nilai_buku": 7120004,
     "jurnal_id": null
    },
    {
     "p": 13,
     "periode": "2027-10",
     "beban": 148333,
     "akumulasi": 1928329,
     "nilai_buku": 6971671,
     "jurnal_id": null
    },
    {
     "p": 14,
     "periode": "2027-11",
     "beban": 148333,
     "akumulasi": 2076662,
     "nilai_buku": 6823338,
     "jurnal_id": null
    },
    {
     "p": 15,
     "periode": "2027-12",
     "beban": 148333,
     "akumulasi": 2224995,
     "nilai_buku": 6675005,
     "jurnal_id": null
    },
    {
     "p": 16,
     "periode": "2028-01",
     "beban": 148333,
     "akumulasi": 2373328,
     "nilai_buku": 6526672,
     "jurnal_id": null
    },
    {
     "p": 17,
     "periode": "2028-02",
     "beban": 148333,
     "akumulasi": 2521661,
     "nilai_buku": 6378339,
     "jurnal_id": null
    },
    {
     "p": 18,
     "periode": "2028-03",
     "beban": 148333,
     "akumulasi": 2669994,
     "nilai_buku": 6230006,
     "jurnal_id": null
    },
    {
     "p": 19,
     "periode": "2028-04",
     "beban": 148333,
     "akumulasi": 2818327,
     "nilai_buku": 6081673,
     "jurnal_id": null
    },
    {
     "p": 20,
     "periode": "2028-05",
     "beban": 148333,
     "akumulasi": 2966660,
     "nilai_buku": 5933340,
     "jurnal_id": null
    },
    {
     "p": 21,
     "periode": "2028-06",
     "beban": 148333,
     "akumulasi": 3114993,
     "nilai_buku": 5785007,
     "jurnal_id": null
    },
    {
     "p": 22,
     "periode": "2028-07",
     "beban": 148333,
     "akumulasi": 3263326,
     "nilai_buku": 5636674,
     "jurnal_id": null
    },
    {
     "p": 23,
     "periode": "2028-08",
     "beban": 148333,
     "akumulasi": 3411659,
     "nilai_buku": 5488341,
     "jurnal_id": null
    },
    {
     "p": 24,
     "periode": "2028-09",
     "beban": 148333,
     "akumulasi": 3559992,
     "nilai_buku": 5340008,
     "jurnal_id": null
    },
    {
     "p": 25,
     "periode": "2028-10",
     "beban": 148333,
     "akumulasi": 3708325,
     "nilai_buku": 5191675,
     "jurnal_id": null
    },
    {
     "p": 26,
     "periode": "2028-11",
     "beban": 148333,
     "akumulasi": 3856658,
     "nilai_buku": 5043342,
     "jurnal_id": null
    },
    {
     "p": 27,
     "periode": "2028-12",
     "beban": 148333,
     "akumulasi": 4004991,
     "nilai_buku": 4895009,
     "jurnal_id": null
    },
    {
     "p": 28,
     "periode": "2029-01",
     "beban": 148333,
     "akumulasi": 4153324,
     "nilai_buku": 4746676,
     "jurnal_id": null
    },
    {
     "p": 29,
     "periode": "2029-02",
     "beban": 148333,
     "akumulasi": 4301657,
     "nilai_buku": 4598343,
     "jurnal_id": null
    },
    {
     "p": 30,
     "periode": "2029-03",
     "beban": 148333,
     "akumulasi": 4449990,
     "nilai_buku": 4450010,
     "jurnal_id": null
    },
    {
     "p": 31,
     "periode": "2029-04",
     "beban": 148333,
     "akumulasi": 4598323,
     "nilai_buku": 4301677,
     "jurnal_id": null
    },
    {
     "p": 32,
     "periode": "2029-05",
     "beban": 148333,
     "akumulasi": 4746656,
     "nilai_buku": 4153344,
     "jurnal_id": null
    },
    {
     "p": 33,
     "periode": "2029-06",
     "beban": 148333,
     "akumulasi": 4894989,
     "nilai_buku": 4005011,
     "jurnal_id": null
    },
    {
     "p": 34,
     "periode": "2029-07",
     "beban": 148333,
     "akumulasi": 5043322,
     "nilai_buku": 3856678,
     "jurnal_id": null
    },
    {
     "p": 35,
     "periode": "2029-08",
     "beban": 148333,
     "akumulasi": 5191655,
     "nilai_buku": 3708345,
     "jurnal_id": null
    },
    {
     "p": 36,
     "periode": "2029-09",
     "beban": 148333,
     "akumulasi": 5339988,
     "nilai_buku": 3560012,
     "jurnal_id": null
    },
    {
     "p": 37,
     "periode": "2029-10",
     "beban": 148333,
     "akumulasi": 5488321,
     "nilai_buku": 3411679,
     "jurnal_id": null
    },
    {
     "p": 38,
     "periode": "2029-11",
     "beban": 148333,
     "akumulasi": 5636654,
     "nilai_buku": 3263346,
     "jurnal_id": null
    },
    {
     "p": 39,
     "periode": "2029-12",
     "beban": 148333,
     "akumulasi": 5784987,
     "nilai_buku": 3115013,
     "jurnal_id": null
    },
    {
     "p": 40,
     "periode": "2030-01",
     "beban": 148333,
     "akumulasi": 5933320,
     "nilai_buku": 2966680,
     "jurnal_id": null
    },
    {
     "p": 41,
     "periode": "2030-02",
     "beban": 148333,
     "akumulasi": 6081653,
     "nilai_buku": 2818347,
     "jurnal_id": null
    },
    {
     "p": 42,
     "periode": "2030-03",
     "beban": 148333,
     "akumulasi": 6229986,
     "nilai_buku": 2670014,
     "jurnal_id": null
    },
    {
     "p": 43,
     "periode": "2030-04",
     "beban": 148333,
     "akumulasi": 6378319,
     "nilai_buku": 2521681,
     "jurnal_id": null
    },
    {
     "p": 44,
     "periode": "2030-05",
     "beban": 148333,
     "akumulasi": 6526652,
     "nilai_buku": 2373348,
     "jurnal_id": null
    },
    {
     "p": 45,
     "periode": "2030-06",
     "beban": 148333,
     "akumulasi": 6674985,
     "nilai_buku": 2225015,
     "jurnal_id": null
    },
    {
     "p": 46,
     "periode": "2030-07",
     "beban": 148333,
     "akumulasi": 6823318,
     "nilai_buku": 2076682,
     "jurnal_id": null
    },
    {
     "p": 47,
     "periode": "2030-08",
     "beban": 148333,
     "akumulasi": 6971651,
     "nilai_buku": 1928349,
     "jurnal_id": null
    },
    {
     "p": 48,
     "periode": "2030-09",
     "beban": 148333,
     "akumulasi": 7119984,
     "nilai_buku": 1780016,
     "jurnal_id": null
    },
    {
     "p": 49,
     "periode": "2030-10",
     "beban": 148333,
     "akumulasi": 7268317,
     "nilai_buku": 1631683,
     "jurnal_id": null
    },
    {
     "p": 50,
     "periode": "2030-11",
     "beban": 148333,
     "akumulasi": 7416650,
     "nilai_buku": 1483350,
     "jurnal_id": null
    },
    {
     "p": 51,
     "periode": "2030-12",
     "beban": 148333,
     "akumulasi": 7564983,
     "nilai_buku": 1335017,
     "jurnal_id": null
    },
    {
     "p": 52,
     "periode": "2031-01",
     "beban": 148333,
     "akumulasi": 7713316,
     "nilai_buku": 1186684,
     "jurnal_id": null
    },
    {
     "p": 53,
     "periode": "2031-02",
     "beban": 148333,
     "akumulasi": 7861649,
     "nilai_buku": 1038351,
     "jurnal_id": null
    },
    {
     "p": 54,
     "periode": "2031-03",
     "beban": 148333,
     "akumulasi": 8009982,
     "nilai_buku": 890018,
     "jurnal_id": null
    },
    {
     "p": 55,
     "periode": "2031-04",
     "beban": 148333,
     "akumulasi": 8158315,
     "nilai_buku": 741685,
     "jurnal_id": null
    },
    {
     "p": 56,
     "periode": "2031-05",
     "beban": 148333,
     "akumulasi": 8306648,
     "nilai_buku": 593352,
     "jurnal_id": null
    },
    {
     "p": 57,
     "periode": "2031-06",
     "beban": 148333,
     "akumulasi": 8454981,
     "nilai_buku": 445019,
     "jurnal_id": null
    },
    {
     "p": 58,
     "periode": "2031-07",
     "beban": 148333,
     "akumulasi": 8603314,
     "nilai_buku": 296686,
     "jurnal_id": null
    },
    {
     "p": 59,
     "periode": "2031-08",
     "beban": 148333,
     "akumulasi": 8751647,
     "nilai_buku": 148353,
     "jurnal_id": null
    },
    {
     "p": 60,
     "periode": "2031-09",
     "beban": 148353,
     "akumulasi": 8900000,
     "nilai_buku": 0,
     "jurnal_id": null
    }
   ]
  },
  "AST-0009": {
   "kode": "AST-0009",
   "pembelian_id": "BP-2026-0006",
   "tgl_perolehan": "2026-10-26",
   "bulan_mulai": "2026-10",
   "status": "aktif",
   "nama": "Laptop Operasional",
   "barang_id": "ALT-06",
   "kategori_id": "KAT-04",
   "nilai_perolehan": 9500000,
   "residu": 0,
   "garansi_bulan": 24,
   "garansi_sampai": "2028-10-26",
   "masa_manfaat_bulan": 48,
   "dasar_n": "garansi",
   "n": 24,
   "d": 395833,
   "terakhir": 395841,
   "pengaman": false,
   "akun_aset": "1-150",
   "akun_akm": "1-151",
   "akun_beban": "6-110",
   "jadwal": [
    {
     "p": 1,
     "periode": "2026-10",
     "beban": 395833,
     "akumulasi": 395833,
     "nilai_buku": 9104167,
     "jurnal_id": null
    },
    {
     "p": 2,
     "periode": "2026-11",
     "beban": 395833,
     "akumulasi": 791666,
     "nilai_buku": 8708334,
     "jurnal_id": null
    },
    {
     "p": 3,
     "periode": "2026-12",
     "beban": 395833,
     "akumulasi": 1187499,
     "nilai_buku": 8312501,
     "jurnal_id": null
    },
    {
     "p": 4,
     "periode": "2027-01",
     "beban": 395833,
     "akumulasi": 1583332,
     "nilai_buku": 7916668,
     "jurnal_id": null
    },
    {
     "p": 5,
     "periode": "2027-02",
     "beban": 395833,
     "akumulasi": 1979165,
     "nilai_buku": 7520835,
     "jurnal_id": null
    },
    {
     "p": 6,
     "periode": "2027-03",
     "beban": 395833,
     "akumulasi": 2374998,
     "nilai_buku": 7125002,
     "jurnal_id": null
    },
    {
     "p": 7,
     "periode": "2027-04",
     "beban": 395833,
     "akumulasi": 2770831,
     "nilai_buku": 6729169,
     "jurnal_id": null
    },
    {
     "p": 8,
     "periode": "2027-05",
     "beban": 395833,
     "akumulasi": 3166664,
     "nilai_buku": 6333336,
     "jurnal_id": null
    },
    {
     "p": 9,
     "periode": "2027-06",
     "beban": 395833,
     "akumulasi": 3562497,
     "nilai_buku": 5937503,
     "jurnal_id": null
    },
    {
     "p": 10,
     "periode": "2027-07",
     "beban": 395833,
     "akumulasi": 3958330,
     "nilai_buku": 5541670,
     "jurnal_id": null
    },
    {
     "p": 11,
     "periode": "2027-08",
     "beban": 395833,
     "akumulasi": 4354163,
     "nilai_buku": 5145837,
     "jurnal_id": null
    },
    {
     "p": 12,
     "periode": "2027-09",
     "beban": 395833,
     "akumulasi": 4749996,
     "nilai_buku": 4750004,
     "jurnal_id": null
    },
    {
     "p": 13,
     "periode": "2027-10",
     "beban": 395833,
     "akumulasi": 5145829,
     "nilai_buku": 4354171,
     "jurnal_id": null
    },
    {
     "p": 14,
     "periode": "2027-11",
     "beban": 395833,
     "akumulasi": 5541662,
     "nilai_buku": 3958338,
     "jurnal_id": null
    },
    {
     "p": 15,
     "periode": "2027-12",
     "beban": 395833,
     "akumulasi": 5937495,
     "nilai_buku": 3562505,
     "jurnal_id": null
    },
    {
     "p": 16,
     "periode": "2028-01",
     "beban": 395833,
     "akumulasi": 6333328,
     "nilai_buku": 3166672,
     "jurnal_id": null
    },
    {
     "p": 17,
     "periode": "2028-02",
     "beban": 395833,
     "akumulasi": 6729161,
     "nilai_buku": 2770839,
     "jurnal_id": null
    },
    {
     "p": 18,
     "periode": "2028-03",
     "beban": 395833,
     "akumulasi": 7124994,
     "nilai_buku": 2375006,
     "jurnal_id": null
    },
    {
     "p": 19,
     "periode": "2028-04",
     "beban": 395833,
     "akumulasi": 7520827,
     "nilai_buku": 1979173,
     "jurnal_id": null
    },
    {
     "p": 20,
     "periode": "2028-05",
     "beban": 395833,
     "akumulasi": 7916660,
     "nilai_buku": 1583340,
     "jurnal_id": null
    },
    {
     "p": 21,
     "periode": "2028-06",
     "beban": 395833,
     "akumulasi": 8312493,
     "nilai_buku": 1187507,
     "jurnal_id": null
    },
    {
     "p": 22,
     "periode": "2028-07",
     "beban": 395833,
     "akumulasi": 8708326,
     "nilai_buku": 791674,
     "jurnal_id": null
    },
    {
     "p": 23,
     "periode": "2028-08",
     "beban": 395833,
     "akumulasi": 9104159,
     "nilai_buku": 395841,
     "jurnal_id": null
    },
    {
     "p": 24,
     "periode": "2028-09",
     "beban": 395841,
     "akumulasi": 9500000,
     "nilai_buku": 0,
     "jurnal_id": null
    }
   ]
  }
 },
 "jurnal": {
  "JU-2026-0001": {
   "no": "JU-2026-0001",
   "tanggal": "2026-10-01",
   "periode": "2026-10",
   "jenis": "umum",
   "keterangan": "Saldo awal kas, setoran modal pemilik (data contoh)",
   "baris": [
    {
     "akun": "1-110",
     "debit": 30000000,
     "kredit": 0
    },
    {
     "akun": "3-110",
     "debit": 0,
     "kredit": 30000000
    }
   ],
   "sumber_tipe": "saldo_awal",
   "sumber_id": null,
   "rincian": null,
   "pembalik_dari": null,
   "status": "disetujui",
   "dibuat_oleh": "admin",
   "dibuat_pada": "2026-11-02T05:00:00.000Z",
   "diajukan_pada": "2026-11-02T05:00:00.000Z",
   "disetujui_oleh": "admin",
   "disetujui_pada": "2026-11-02T05:00:00.000Z",
   "alasan_tolak": null
  },
  "JU-2026-0002": {
   "no": "JU-2026-0002",
   "tanggal": "2026-10-05",
   "periode": "2026-10",
   "jenis": "umum",
   "keterangan": "Pembelian peralatan BP-2026-0001, CV Sinar Audio Malang (Kredit)",
   "baris": [
    {
     "akun": "1-150",
     "debit": 14500000,
     "kredit": 0
    },
    {
     "akun": "2-110",
     "debit": 0,
     "kredit": 14500000
    }
   ],
   "sumber_tipe": "pembelian",
   "sumber_id": "BP-2026-0001",
   "rincian": null,
   "pembalik_dari": null,
   "status": "disetujui",
   "dibuat_oleh": "admin",
   "dibuat_pada": "2026-11-02T05:00:00.000Z",
   "diajukan_pada": "2026-11-02T05:00:00.000Z",
   "disetujui_oleh": "admin",
   "disetujui_pada": "2026-11-02T05:00:00.000Z",
   "alasan_tolak": null
  },
  "JU-2026-0003": {
   "no": "JU-2026-0003",
   "tanggal": "2026-10-10",
   "periode": "2026-10",
   "jenis": "umum",
   "keterangan": "Pembelian peralatan BP-2026-0002, CV Sinar Audio Malang (Tunai)",
   "baris": [
    {
     "akun": "1-150",
     "debit": 9800000,
     "kredit": 0
    },
    {
     "akun": "1-110",
     "debit": 0,
     "kredit": 9800000
    }
   ],
   "sumber_tipe": "pembelian",
   "sumber_id": "BP-2026-0002",
   "rincian": null,
   "pembalik_dari": null,
   "status": "disetujui",
   "dibuat_oleh": "admin",
   "dibuat_pada": "2026-11-02T05:00:00.000Z",
   "diajukan_pada": "2026-11-02T05:00:00.000Z",
   "disetujui_oleh": "admin",
   "disetujui_pada": "2026-11-02T05:00:00.000Z",
   "alasan_tolak": null
  },
  "JU-2026-0004": {
   "no": "JU-2026-0004",
   "tanggal": "2026-10-15",
   "periode": "2026-10",
   "jenis": "umum",
   "keterangan": "Pembelian peralatan BP-2026-0003, Setoran pemilik (Investasi)",
   "baris": [
    {
     "akun": "1-150",
     "debit": 3800000,
     "kredit": 0
    },
    {
     "akun": "3-110",
     "debit": 0,
     "kredit": 3800000
    }
   ],
   "sumber_tipe": "pembelian",
   "sumber_id": "BP-2026-0003",
   "rincian": null,
   "pembalik_dari": null,
   "status": "disetujui",
   "dibuat_oleh": "admin",
   "dibuat_pada": "2026-11-02T05:00:00.000Z",
   "diajukan_pada": "2026-11-02T05:00:00.000Z",
   "disetujui_oleh": "admin",
   "disetujui_pada": "2026-11-02T05:00:00.000Z",
   "alasan_tolak": null
  },
  "JU-2026-0005": {
   "no": "JU-2026-0005",
   "tanggal": "2026-10-20",
   "periode": "2026-10",
   "jenis": "umum",
   "keterangan": "Pembelian peralatan BP-2026-0004, Toko Kamera Ijen (Kredit)",
   "baris": [
    {
     "akun": "1-150",
     "debit": 18500000,
     "kredit": 0
    },
    {
     "akun": "2-110",
     "debit": 0,
     "kredit": 18500000
    }
   ],
   "sumber_tipe": "pembelian",
   "sumber_id": "BP-2026-0004",
   "rincian": null,
   "pembalik_dari": null,
   "status": "disetujui",
   "dibuat_oleh": "admin",
   "dibuat_pada": "2026-11-02T05:00:00.000Z",
   "diajukan_pada": "2026-11-02T05:00:00.000Z",
   "disetujui_oleh": "admin",
   "disetujui_pada": "2026-11-02T05:00:00.000Z",
   "alasan_tolak": null
  },
  "JU-2026-0006": {
   "no": "JU-2026-0006",
   "tanggal": "2026-10-22",
   "periode": "2026-10",
   "jenis": "umum",
   "keterangan": "Pembelian peralatan BP-2026-0005, CV Sinar Audio Malang (Tunai)",
   "baris": [
    {
     "akun": "1-150",
     "debit": 8900000,
     "kredit": 0
    },
    {
     "akun": "1-110",
     "debit": 0,
     "kredit": 8900000
    }
   ],
   "sumber_tipe": "pembelian",
   "sumber_id": "BP-2026-0005",
   "rincian": null,
   "pembalik_dari": null,
   "status": "disetujui",
   "dibuat_oleh": "admin",
   "dibuat_pada": "2026-11-02T05:00:00.000Z",
   "diajukan_pada": "2026-11-02T05:00:00.000Z",
   "disetujui_oleh": "admin",
   "disetujui_pada": "2026-11-02T05:00:00.000Z",
   "alasan_tolak": null
  },
  "JU-2026-0007": {
   "no": "JU-2026-0007",
   "tanggal": "2026-10-26",
   "periode": "2026-10",
   "jenis": "umum",
   "keterangan": "Pembelian peralatan BP-2026-0006, Toko Kamera Ijen (Tunai)",
   "baris": [
    {
     "akun": "1-150",
     "debit": 9500000,
     "kredit": 0
    },
    {
     "akun": "1-110",
     "debit": 0,
     "kredit": 9500000
    }
   ],
   "sumber_tipe": "pembelian",
   "sumber_id": "BP-2026-0006",
   "rincian": null,
   "pembalik_dari": null,
   "status": "disetujui",
   "dibuat_oleh": "admin",
   "dibuat_pada": "2026-11-02T05:00:00.000Z",
   "diajukan_pada": "2026-11-02T05:00:00.000Z",
   "disetujui_oleh": "admin",
   "disetujui_pada": "2026-11-02T05:00:00.000Z",
   "alasan_tolak": null
  },
  "JU-2026-0008": {
   "no": "JU-2026-0008",
   "tanggal": "2026-10-12",
   "periode": "2026-10",
   "jenis": "umum",
   "keterangan": "Pembelian perlengkapan BL-2026-0001, UD Event Supply Malang (Tunai)",
   "baris": [
    {
     "akun": "1-140",
     "debit": 1290000,
     "kredit": 0
    },
    {
     "akun": "1-110",
     "debit": 0,
     "kredit": 1290000
    }
   ],
   "sumber_tipe": "pembelian",
   "sumber_id": "BL-2026-0001",
   "rincian": null,
   "pembalik_dari": null,
   "status": "disetujui",
   "dibuat_oleh": "admin",
   "dibuat_pada": "2026-11-02T05:00:00.000Z",
   "diajukan_pada": "2026-11-02T05:00:00.000Z",
   "disetujui_oleh": "admin",
   "disetujui_pada": "2026-11-02T05:00:00.000Z",
   "alasan_tolak": null
  },
  "JU-2026-0009": {
   "no": "JU-2026-0009",
   "tanggal": "2026-10-28",
   "periode": "2026-10",
   "jenis": "umum",
   "keterangan": "Pembelian perlengkapan BL-2026-0002, UD Event Supply Malang (Kredit)",
   "baris": [
    {
     "akun": "1-140",
     "debit": 2030000,
     "kredit": 0
    },
    {
     "akun": "2-110",
     "debit": 0,
     "kredit": 2030000
    }
   ],
   "sumber_tipe": "pembelian",
   "sumber_id": "BL-2026-0002",
   "rincian": null,
   "pembalik_dari": null,
   "status": "disetujui",
   "dibuat_oleh": "admin",
   "dibuat_pada": "2026-11-02T05:00:00.000Z",
   "diajukan_pada": "2026-11-02T05:00:00.000Z",
   "disetujui_oleh": "admin",
   "disetujui_pada": "2026-11-02T05:00:00.000Z",
   "alasan_tolak": null
  },
  "JU-2026-0010": {
   "no": "JU-2026-0010",
   "tanggal": "2026-10-01",
   "periode": "2026-10",
   "jenis": "umum",
   "keterangan": "Setoran modal tambahan untuk kas operasional dan gaji (data contoh)",
   "baris": [
    {
     "akun": "1-110",
     "debit": 40000000,
     "kredit": 0
    },
    {
     "akun": "3-110",
     "debit": 0,
     "kredit": 40000000
    }
   ],
   "sumber_tipe": "saldo_awal",
   "sumber_id": null,
   "rincian": null,
   "pembalik_dari": null,
   "status": "disetujui",
   "dibuat_oleh": "owner",
   "dibuat_pada": "2026-11-16T02:00:00.000Z",
   "diajukan_pada": "2026-11-16T02:00:00.000Z",
   "disetujui_oleh": "owner",
   "disetujui_pada": "2026-11-16T02:00:00.000Z",
   "alasan_tolak": null
  }
 },
 "pembelian": {
  "BP-2026-0001": {
   "no": "BP-2026-0001",
   "jenis": "peralatan",
   "tanggal": "2026-10-05",
   "supplier_id": "SUP-01",
   "cara_bayar": "kredit",
   "jatuh_tempo": "2026-11-05",
   "keterangan": "",
   "items": [
    {
     "barang_id": "ALT-01",
     "qty": 1,
     "harga": 14500000,
     "residu": 0,
     "garansi_bulan": 24,
     "masa_manfaat_bulan": 60,
     "dasar_n": "masa_manfaat"
    }
   ],
   "total": 14500000,
   "status": "posted",
   "jurnal_id": "JU-2026-0002",
   "dibuat_oleh": "admin",
   "diubah_pada": "2026-11-02T05:00:00.000Z",
   "aset_ids": [
    "AST-0001"
   ],
   "diposting_oleh": "admin",
   "diposting_pada": "2026-11-02T05:00:00.000Z"
  },
  "BP-2026-0002": {
   "no": "BP-2026-0002",
   "jenis": "peralatan",
   "tanggal": "2026-10-10",
   "supplier_id": "SUP-01",
   "cara_bayar": "tunai",
   "jatuh_tempo": "",
   "keterangan": "",
   "items": [
    {
     "barang_id": "ALT-02",
     "qty": 1,
     "harga": 9800000,
     "residu": 0,
     "garansi_bulan": 12,
     "masa_manfaat_bulan": 60,
     "dasar_n": "masa_manfaat"
    }
   ],
   "total": 9800000,
   "status": "posted",
   "jurnal_id": "JU-2026-0003",
   "dibuat_oleh": "admin",
   "diubah_pada": "2026-11-02T05:00:00.000Z",
   "aset_ids": [
    "AST-0002"
   ],
   "diposting_oleh": "admin",
   "diposting_pada": "2026-11-02T05:00:00.000Z"
  },
  "BP-2026-0003": {
   "no": "BP-2026-0003",
   "jenis": "peralatan",
   "tanggal": "2026-10-15",
   "supplier_id": "",
   "cara_bayar": "investasi",
   "jatuh_tempo": "",
   "keterangan": "",
   "items": [
    {
     "barang_id": "ALT-05",
     "qty": 4,
     "harga": 950000,
     "residu": 0,
     "garansi_bulan": 24,
     "masa_manfaat_bulan": 24,
     "dasar_n": "garansi"
    }
   ],
   "total": 3800000,
   "status": "posted",
   "jurnal_id": "JU-2026-0004",
   "dibuat_oleh": "admin",
   "diubah_pada": "2026-11-02T05:00:00.000Z",
   "aset_ids": [
    "AST-0003",
    "AST-0004",
    "AST-0005",
    "AST-0006"
   ],
   "diposting_oleh": "admin",
   "diposting_pada": "2026-11-02T05:00:00.000Z"
  },
  "BP-2026-0004": {
   "no": "BP-2026-0004",
   "jenis": "peralatan",
   "tanggal": "2026-10-20",
   "supplier_id": "SUP-02",
   "cara_bayar": "kredit",
   "jatuh_tempo": "2026-11-20",
   "keterangan": "",
   "items": [
    {
     "barang_id": "ALT-04",
     "qty": 1,
     "harga": 18500000,
     "residu": 0,
     "garansi_bulan": 12,
     "masa_manfaat_bulan": 48,
     "dasar_n": "masa_manfaat"
    }
   ],
   "total": 18500000,
   "status": "posted",
   "jurnal_id": "JU-2026-0005",
   "dibuat_oleh": "admin",
   "diubah_pada": "2026-11-02T05:00:00.000Z",
   "aset_ids": [
    "AST-0007"
   ],
   "diposting_oleh": "admin",
   "diposting_pada": "2026-11-02T05:00:00.000Z"
  },
  "BP-2026-0005": {
   "no": "BP-2026-0005",
   "jenis": "peralatan",
   "tanggal": "2026-10-22",
   "supplier_id": "SUP-01",
   "cara_bayar": "tunai",
   "jatuh_tempo": "",
   "keterangan": "",
   "items": [
    {
     "barang_id": "ALT-03",
     "qty": 1,
     "harga": 8900000,
     "residu": 0,
     "garansi_bulan": 12,
     "masa_manfaat_bulan": 60,
     "dasar_n": "masa_manfaat"
    }
   ],
   "total": 8900000,
   "status": "posted",
   "jurnal_id": "JU-2026-0006",
   "dibuat_oleh": "admin",
   "diubah_pada": "2026-11-02T05:00:00.000Z",
   "aset_ids": [
    "AST-0008"
   ],
   "diposting_oleh": "admin",
   "diposting_pada": "2026-11-02T05:00:00.000Z"
  },
  "BP-2026-0006": {
   "no": "BP-2026-0006",
   "jenis": "peralatan",
   "tanggal": "2026-10-26",
   "supplier_id": "SUP-02",
   "cara_bayar": "tunai",
   "jatuh_tempo": "",
   "keterangan": "",
   "items": [
    {
     "barang_id": "ALT-06",
     "qty": 1,
     "harga": 9500000,
     "residu": 0,
     "garansi_bulan": 24,
     "masa_manfaat_bulan": 48,
     "dasar_n": "garansi"
    }
   ],
   "total": 9500000,
   "status": "posted",
   "jurnal_id": "JU-2026-0007",
   "dibuat_oleh": "admin",
   "diubah_pada": "2026-11-02T05:00:00.000Z",
   "aset_ids": [
    "AST-0009"
   ],
   "diposting_oleh": "admin",
   "diposting_pada": "2026-11-02T05:00:00.000Z"
  },
  "BL-2026-0001": {
   "no": "BL-2026-0001",
   "jenis": "perlengkapan",
   "tanggal": "2026-10-12",
   "supplier_id": "SUP-03",
   "cara_bayar": "tunai",
   "jatuh_tempo": "",
   "keterangan": "",
   "items": [
    {
     "barang_id": "LKP-01",
     "qty": 12,
     "harga": 85000
    },
    {
     "barang_id": "LKP-03",
     "qty": 6,
     "harga": 45000
    }
   ],
   "total": 1290000,
   "status": "posted",
   "jurnal_id": "JU-2026-0008",
   "dibuat_oleh": "admin",
   "diubah_pada": "2026-11-02T05:00:00.000Z",
   "aset_ids": [],
   "diposting_oleh": "admin",
   "diposting_pada": "2026-11-02T05:00:00.000Z"
  },
  "BL-2026-0002": {
   "no": "BL-2026-0002",
   "jenis": "perlengkapan",
   "tanggal": "2026-10-28",
   "supplier_id": "SUP-03",
   "cara_bayar": "kredit",
   "jatuh_tempo": "2026-11-28",
   "keterangan": "",
   "items": [
    {
     "barang_id": "LKP-02",
     "qty": 10,
     "harga": 18000
    },
    {
     "barang_id": "LKP-04",
     "qty": 100,
     "harga": 12500
    },
    {
     "barang_id": "LKP-05",
     "qty": 4,
     "harga": 150000
    }
   ],
   "total": 2030000,
   "status": "posted",
   "jurnal_id": "JU-2026-0009",
   "dibuat_oleh": "admin",
   "diubah_pada": "2026-11-02T05:00:00.000Z",
   "aset_ids": [],
   "diposting_oleh": "admin",
   "diposting_pada": "2026-11-02T05:00:00.000Z"
  },
  "BP-2026-0007": {
   "no": "BP-2026-0007",
   "jenis": "peralatan",
   "tanggal": "2026-11-02",
   "supplier_id": "SUP-03",
   "cara_bayar": "tunai",
   "jatuh_tempo": "",
   "keterangan": "",
   "items": [
    {
     "barang_id": "ALT-05",
     "qty": 2,
     "harga": 950000,
     "residu": 0,
     "garansi_bulan": 24,
     "masa_manfaat_bulan": 24,
     "dasar_n": "garansi"
    }
   ],
   "total": 1900000,
   "status": "draft",
   "jurnal_id": null,
   "dibuat_oleh": "admin",
   "diubah_pada": "2026-11-02T05:00:00.000Z"
  }
 },
 "supplier": {
  "SUP-01": {
   "kode": "SUP-01",
   "nama": "CV Sinar Audio Malang",
   "alamat": "Jl. Letjen Sutoyo, Malang",
   "telepon": "",
   "email": "",
   "npwp": "",
   "aktif": true
  },
  "SUP-02": {
   "kode": "SUP-02",
   "nama": "Toko Kamera Ijen",
   "alamat": "Jl. Ijen, Malang",
   "telepon": "",
   "email": "",
   "npwp": "",
   "aktif": true
  },
  "SUP-03": {
   "kode": "SUP-03",
   "nama": "UD Event Supply Malang",
   "alamat": "Jl. Raya Singosari, Malang",
   "telepon": "",
   "email": "",
   "npwp": "",
   "aktif": true
  }
 },
 "perlengkapan": {
  "LKP-01": {
   "kode": "LKP-01",
   "nama": "Gaffer Tape",
   "satuan": "roll",
   "aktif": true
  },
  "LKP-02": {
   "kode": "LKP-02",
   "nama": "Kabel Ties",
   "satuan": "pak",
   "aktif": true
  },
  "LKP-03": {
   "kode": "LKP-03",
   "nama": "Baterai AA",
   "satuan": "pak",
   "aktif": true
  },
  "LKP-04": {
   "kode": "LKP-04",
   "nama": "ID Card dan Lanyard",
   "satuan": "pcs",
   "aktif": true
  },
  "LKP-05": {
   "kode": "LKP-05",
   "nama": "Cetak Banner/X-Banner",
   "satuan": "lembar",
   "aktif": true
  }
 },
 "presensi": {
  "PRS-KRY-03-20261002": {
   "karyawan_id": "KRY-03",
   "tanggal": "2026-10-02",
   "absensi": "Hadir",
   "jam_masuk": "06:52",
   "jam_keluar": "16:41",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-01-20261027": {
   "karyawan_id": "KRY-01",
   "tanggal": "2026-10-27",
   "absensi": "Hadir",
   "jam_masuk": "07:48",
   "jam_keluar": "17:26",
   "terlambat": 0,
   "jadwal_id": "TM-01",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261016": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-16",
   "absensi": "Hadir",
   "jam_masuk": "07:56",
   "jam_keluar": "17:04",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261028": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-28",
   "absensi": "Hadir",
   "jam_masuk": "07:53",
   "jam_keluar": "17:11",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261019": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-19",
   "absensi": "Cuti",
   "jam_masuk": "",
   "jam_keluar": "",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-01-20261029": {
   "karyawan_id": "KRY-01",
   "tanggal": "2026-10-29",
   "absensi": "Hadir",
   "jam_masuk": "07:50",
   "jam_keluar": "17:21",
   "terlambat": 0,
   "jadwal_id": "TM-01",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261013": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-13",
   "absensi": "Hadir",
   "jam_masuk": "06:48",
   "jam_keluar": "16:43",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261001": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-01",
   "absensi": "Hadir",
   "jam_masuk": "08:27",
   "jam_keluar": "17:28",
   "terlambat": 27,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261021": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-21",
   "absensi": "Hadir",
   "jam_masuk": "06:46",
   "jam_keluar": "16:38",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261026": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-26",
   "absensi": "Hadir",
   "jam_masuk": "07:48",
   "jam_keluar": "17:23",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-01-20261028": {
   "karyawan_id": "KRY-01",
   "tanggal": "2026-10-28",
   "absensi": "Hadir",
   "jam_masuk": "07:56",
   "jam_keluar": "17:43",
   "terlambat": 0,
   "jadwal_id": "TM-01",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261022": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-22",
   "absensi": "Hadir",
   "jam_masuk": "05:42",
   "jam_keluar": "18:35",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261023": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-23",
   "absensi": "Hadir",
   "jam_masuk": "07:55",
   "jam_keluar": "17:39",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261005": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-05",
   "absensi": "Hadir",
   "jam_masuk": "07:22",
   "jam_keluar": "16:05",
   "terlambat": 22,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-03-20261022": {
   "karyawan_id": "KRY-03",
   "tanggal": "2026-10-22",
   "absensi": "Hadir",
   "jam_masuk": "05:37",
   "jam_keluar": "18:23",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261015": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-15",
   "absensi": "Hadir",
   "jam_masuk": "06:49",
   "jam_keluar": "16:36",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261029": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-29",
   "absensi": "Hadir",
   "jam_masuk": "07:50",
   "jam_keluar": "17:08",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261030": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-30",
   "absensi": "Hadir",
   "jam_masuk": "07:54",
   "jam_keluar": "17:11",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261028": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-28",
   "absensi": "Hadir",
   "jam_masuk": "06:51",
   "jam_keluar": "16:00",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-03-20261015": {
   "karyawan_id": "KRY-03",
   "tanggal": "2026-10-15",
   "absensi": "Hadir",
   "jam_masuk": "06:59",
   "jam_keluar": "16:04",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-03-20261012": {
   "karyawan_id": "KRY-03",
   "tanggal": "2026-10-12",
   "absensi": "Hadir",
   "jam_masuk": "07:30",
   "jam_keluar": "16:33",
   "terlambat": 30,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261019": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-19",
   "absensi": "Hadir",
   "jam_masuk": "08:06",
   "jam_keluar": "17:03",
   "terlambat": 6,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-03-20261030": {
   "karyawan_id": "KRY-03",
   "tanggal": "2026-10-30",
   "absensi": "Hadir",
   "jam_masuk": "06:54",
   "jam_keluar": "16:26",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261012": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-12",
   "absensi": "Hadir",
   "jam_masuk": "07:55",
   "jam_keluar": "17:13",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-03-20261006": {
   "karyawan_id": "KRY-03",
   "tanggal": "2026-10-06",
   "absensi": "Hadir",
   "jam_masuk": "07:09",
   "jam_keluar": "16:33",
   "terlambat": 9,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-03-20261028": {
   "karyawan_id": "KRY-03",
   "tanggal": "2026-10-28",
   "absensi": "Cuti",
   "jam_masuk": "",
   "jam_keluar": "",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-01-20261022": {
   "karyawan_id": "KRY-01",
   "tanggal": "2026-10-22",
   "absensi": "Hadir",
   "jam_masuk": "07:58",
   "jam_keluar": "17:30",
   "terlambat": 0,
   "jadwal_id": "TM-01",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261015": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-15",
   "absensi": "Hadir",
   "jam_masuk": "08:26",
   "jam_keluar": "17:15",
   "terlambat": 26,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261016": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-16",
   "absensi": "Hadir",
   "jam_masuk": "06:52",
   "jam_keluar": "16:36",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261013": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-13",
   "absensi": "Alpa",
   "jam_masuk": "",
   "jam_keluar": "",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261005": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-05",
   "absensi": "Hadir",
   "jam_masuk": "07:50",
   "jam_keluar": "17:26",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-03-20261005": {
   "karyawan_id": "KRY-03",
   "tanggal": "2026-10-05",
   "absensi": "Hadir",
   "jam_masuk": "07:00",
   "jam_keluar": "16:10",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261014": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-14",
   "absensi": "Hadir",
   "jam_masuk": "08:00",
   "jam_keluar": "17:17",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261026": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-26",
   "absensi": "Hadir",
   "jam_masuk": "06:50",
   "jam_keluar": "16:39",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261005": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-05",
   "absensi": "Sakit",
   "jam_masuk": "",
   "jam_keluar": "",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-01-20261006": {
   "karyawan_id": "KRY-01",
   "tanggal": "2026-10-06",
   "absensi": "Izin",
   "jam_masuk": "",
   "jam_keluar": "",
   "terlambat": 0,
   "jadwal_id": "TM-01",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-01-20261009": {
   "karyawan_id": "KRY-01",
   "tanggal": "2026-10-09",
   "absensi": "Hadir",
   "jam_masuk": "07:56",
   "jam_keluar": "17:19",
   "terlambat": 0,
   "jadwal_id": "TM-01",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261009": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-09",
   "absensi": "Hadir",
   "jam_masuk": "06:48",
   "jam_keluar": "16:22",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261030": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-30",
   "absensi": "Hadir",
   "jam_masuk": "06:49",
   "jam_keluar": "16:37",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261008": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-08",
   "absensi": "Hadir",
   "jam_masuk": "07:57",
   "jam_keluar": "17:01",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261027": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-27",
   "absensi": "Hadir",
   "jam_masuk": "06:46",
   "jam_keluar": "16:16",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261016": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-16",
   "absensi": "Hadir",
   "jam_masuk": "06:54",
   "jam_keluar": "16:18",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-03-20261027": {
   "karyawan_id": "KRY-03",
   "tanggal": "2026-10-27",
   "absensi": "Hadir",
   "jam_masuk": "07:22",
   "jam_keluar": "16:27",
   "terlambat": 22,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261014": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-14",
   "absensi": "Hadir",
   "jam_masuk": "07:00",
   "jam_keluar": "16:21",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261023": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-23",
   "absensi": "Hadir",
   "jam_masuk": "05:31",
   "jam_keluar": "18:10",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-03-20261026": {
   "karyawan_id": "KRY-03",
   "tanggal": "2026-10-26",
   "absensi": "Hadir",
   "jam_masuk": "06:55",
   "jam_keluar": "16:12",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-01-20261030": {
   "karyawan_id": "KRY-01",
   "tanggal": "2026-10-30",
   "absensi": "Hadir",
   "jam_masuk": "07:54",
   "jam_keluar": "17:44",
   "terlambat": 0,
   "jadwal_id": "TM-01",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261001": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-01",
   "absensi": "Hadir",
   "jam_masuk": "06:53",
   "jam_keluar": "16:03",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261009": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-09",
   "absensi": "Hadir",
   "jam_masuk": "06:59",
   "jam_keluar": "16:26",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261007": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-07",
   "absensi": "Hadir",
   "jam_masuk": "07:56",
   "jam_keluar": "17:12",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261020": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-20",
   "absensi": "Hadir",
   "jam_masuk": "06:59",
   "jam_keluar": "16:33",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261009": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-09",
   "absensi": "Hadir",
   "jam_masuk": "08:32",
   "jam_keluar": "17:37",
   "terlambat": 32,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261022": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-22",
   "absensi": "Hadir",
   "jam_masuk": "07:58",
   "jam_keluar": "17:37",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261006": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-06",
   "absensi": "Hadir",
   "jam_masuk": "08:03",
   "jam_keluar": "17:16",
   "terlambat": 3,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-01-20261002": {
   "karyawan_id": "KRY-01",
   "tanggal": "2026-10-02",
   "absensi": "Hadir",
   "jam_masuk": "07:58",
   "jam_keluar": "17:14",
   "terlambat": 0,
   "jadwal_id": "TM-01",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261029": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-29",
   "absensi": "Hadir",
   "jam_masuk": "06:46",
   "jam_keluar": "16:01",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261012": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-12",
   "absensi": "Hadir",
   "jam_masuk": "06:59",
   "jam_keluar": "16:25",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261021": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-21",
   "absensi": "Hadir",
   "jam_masuk": "07:47",
   "jam_keluar": "17:17",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261019": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-19",
   "absensi": "Hadir",
   "jam_masuk": "06:50",
   "jam_keluar": "16:02",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261008": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-08",
   "absensi": "Hadir",
   "jam_masuk": "06:49",
   "jam_keluar": "16:00",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261006": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-06",
   "absensi": "Hadir",
   "jam_masuk": "06:47",
   "jam_keluar": "16:12",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261029": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-29",
   "absensi": "Sakit",
   "jam_masuk": "",
   "jam_keluar": "",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261013": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-13",
   "absensi": "Cuti",
   "jam_masuk": "",
   "jam_keluar": "",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-03-20261008": {
   "karyawan_id": "KRY-03",
   "tanggal": "2026-10-08",
   "absensi": "Hadir",
   "jam_masuk": "07:26",
   "jam_keluar": "16:01",
   "terlambat": 26,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-03-20261007": {
   "karyawan_id": "KRY-03",
   "tanggal": "2026-10-07",
   "absensi": "Hadir",
   "jam_masuk": "06:52",
   "jam_keluar": "16:40",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261021": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-21",
   "absensi": "Hadir",
   "jam_masuk": "06:53",
   "jam_keluar": "16:13",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-03-20261016": {
   "karyawan_id": "KRY-03",
   "tanggal": "2026-10-16",
   "absensi": "Hadir",
   "jam_masuk": "06:55",
   "jam_keluar": "16:22",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261022": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-22",
   "absensi": "Hadir",
   "jam_masuk": "05:34",
   "jam_keluar": "18:12",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-01-20261012": {
   "karyawan_id": "KRY-01",
   "tanggal": "2026-10-12",
   "absensi": "Hadir",
   "jam_masuk": "07:51",
   "jam_keluar": "17:33",
   "terlambat": 0,
   "jadwal_id": "TM-01",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261023": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-23",
   "absensi": "Hadir",
   "jam_masuk": "05:37",
   "jam_keluar": "18:18",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261020": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-20",
   "absensi": "Hadir",
   "jam_masuk": "07:50",
   "jam_keluar": "17:35",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261007": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-07",
   "absensi": "Hadir",
   "jam_masuk": "06:49",
   "jam_keluar": "16:09",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261015": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-15",
   "absensi": "Hadir",
   "jam_masuk": "07:00",
   "jam_keluar": "16:00",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-03-20261023": {
   "karyawan_id": "KRY-03",
   "tanggal": "2026-10-23",
   "absensi": "Hadir",
   "jam_masuk": "05:39",
   "jam_keluar": "18:11",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261012": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-12",
   "absensi": "Hadir",
   "jam_masuk": "06:58",
   "jam_keluar": "16:35",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261006": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-06",
   "absensi": "Hadir",
   "jam_masuk": "06:56",
   "jam_keluar": "16:07",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-03-20261021": {
   "karyawan_id": "KRY-03",
   "tanggal": "2026-10-21",
   "absensi": "Hadir",
   "jam_masuk": "07:22",
   "jam_keluar": "16:23",
   "terlambat": 22,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261001": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-01",
   "absensi": "Hadir",
   "jam_masuk": "06:58",
   "jam_keluar": "16:44",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-03-20261001": {
   "karyawan_id": "KRY-03",
   "tanggal": "2026-10-01",
   "absensi": "Cuti",
   "jam_masuk": "",
   "jam_keluar": "",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-01-20261020": {
   "karyawan_id": "KRY-01",
   "tanggal": "2026-10-20",
   "absensi": "Hadir",
   "jam_masuk": "07:56",
   "jam_keluar": "17:09",
   "terlambat": 0,
   "jadwal_id": "TM-01",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261014": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-14",
   "absensi": "Hadir",
   "jam_masuk": "07:29",
   "jam_keluar": "16:27",
   "terlambat": 29,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261020": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-20",
   "absensi": "Hadir",
   "jam_masuk": "07:17",
   "jam_keluar": "16:00",
   "terlambat": 17,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-03-20261014": {
   "karyawan_id": "KRY-03",
   "tanggal": "2026-10-14",
   "absensi": "Hadir",
   "jam_masuk": "06:59",
   "jam_keluar": "16:42",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261002": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-02",
   "absensi": "Hadir",
   "jam_masuk": "08:22",
   "jam_keluar": "17:25",
   "terlambat": 22,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261027": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-27",
   "absensi": "Hadir",
   "jam_masuk": "07:50",
   "jam_keluar": "17:15",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261002": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-02",
   "absensi": "Alpa",
   "jam_masuk": "",
   "jam_keluar": "",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261002": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-02",
   "absensi": "Hadir",
   "jam_masuk": "07:15",
   "jam_keluar": "16:14",
   "terlambat": 15,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261008": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-08",
   "absensi": "Hadir",
   "jam_masuk": "06:59",
   "jam_keluar": "16:27",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-03-20261019": {
   "karyawan_id": "KRY-03",
   "tanggal": "2026-10-19",
   "absensi": "Hadir",
   "jam_masuk": "06:56",
   "jam_keluar": "16:28",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-03-20261009": {
   "karyawan_id": "KRY-03",
   "tanggal": "2026-10-09",
   "absensi": "Hadir",
   "jam_masuk": "06:46",
   "jam_keluar": "16:08",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261026": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-26",
   "absensi": "Alpa",
   "jam_masuk": "",
   "jam_keluar": "",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261007": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-07",
   "absensi": "Hadir",
   "jam_masuk": "07:32",
   "jam_keluar": "16:28",
   "terlambat": 32,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-03-20261013": {
   "karyawan_id": "KRY-03",
   "tanggal": "2026-10-13",
   "absensi": "Hadir",
   "jam_masuk": "06:46",
   "jam_keluar": "16:25",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-01-20261023": {
   "karyawan_id": "KRY-01",
   "tanggal": "2026-10-23",
   "absensi": "Hadir",
   "jam_masuk": "08:02",
   "jam_keluar": "17:32",
   "terlambat": 2,
   "jadwal_id": "TM-01",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-01-20261008": {
   "karyawan_id": "KRY-01",
   "tanggal": "2026-10-08",
   "absensi": "Hadir",
   "jam_masuk": "07:48",
   "jam_keluar": "17:05",
   "terlambat": 0,
   "jadwal_id": "TM-01",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261030": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-30",
   "absensi": "Cuti",
   "jam_masuk": "",
   "jam_keluar": "",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261028": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-28",
   "absensi": "Hadir",
   "jam_masuk": "06:48",
   "jam_keluar": "16:33",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-01-20261013": {
   "karyawan_id": "KRY-01",
   "tanggal": "2026-10-13",
   "absensi": "Hadir",
   "jam_masuk": "08:02",
   "jam_keluar": "17:02",
   "terlambat": 2,
   "jadwal_id": "TM-01",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261027": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-27",
   "absensi": "Hadir",
   "jam_masuk": "06:49",
   "jam_keluar": "16:28",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-01-20261016": {
   "karyawan_id": "KRY-01",
   "tanggal": "2026-10-16",
   "absensi": "Hadir",
   "jam_masuk": "07:50",
   "jam_keluar": "17:13",
   "terlambat": 0,
   "jadwal_id": "TM-01",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-01-20261026": {
   "karyawan_id": "KRY-01",
   "tanggal": "2026-10-26",
   "absensi": "Hadir",
   "jam_masuk": "07:48",
   "jam_keluar": "17:15",
   "terlambat": 0,
   "jadwal_id": "TM-01",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-03-20261029": {
   "karyawan_id": "KRY-03",
   "tanggal": "2026-10-29",
   "absensi": "Hadir",
   "jam_masuk": "06:46",
   "jam_keluar": "16:34",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-01-20261001": {
   "karyawan_id": "KRY-01",
   "tanggal": "2026-10-01",
   "absensi": "Hadir",
   "jam_masuk": "08:11",
   "jam_keluar": "17:04",
   "terlambat": 11,
   "jadwal_id": "TM-01",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-01-20261005": {
   "karyawan_id": "KRY-01",
   "tanggal": "2026-10-05",
   "absensi": "Hadir",
   "jam_masuk": "07:51",
   "jam_keluar": "17:37",
   "terlambat": 0,
   "jadwal_id": "TM-01",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-01-20261015": {
   "karyawan_id": "KRY-01",
   "tanggal": "2026-10-15",
   "absensi": "Hadir",
   "jam_masuk": "08:14",
   "jam_keluar": "17:34",
   "terlambat": 14,
   "jadwal_id": "TM-01",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-03-20261020": {
   "karyawan_id": "KRY-03",
   "tanggal": "2026-10-20",
   "absensi": "Hadir",
   "jam_masuk": "06:47",
   "jam_keluar": "16:29",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-01-20261021": {
   "karyawan_id": "KRY-01",
   "tanggal": "2026-10-21",
   "absensi": "Hadir",
   "jam_masuk": "07:55",
   "jam_keluar": "17:22",
   "terlambat": 0,
   "jadwal_id": "TM-01",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-01-20261007": {
   "karyawan_id": "KRY-01",
   "tanggal": "2026-10-07",
   "absensi": "Hadir",
   "jam_masuk": "07:54",
   "jam_keluar": "17:20",
   "terlambat": 0,
   "jadwal_id": "TM-01",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-01-20261014": {
   "karyawan_id": "KRY-01",
   "tanggal": "2026-10-14",
   "absensi": "Hadir",
   "jam_masuk": "08:03",
   "jam_keluar": "17:35",
   "terlambat": 3,
   "jadwal_id": "TM-01",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-01-20261019": {
   "karyawan_id": "KRY-01",
   "tanggal": "2026-10-19",
   "absensi": "Hadir",
   "jam_masuk": "07:48",
   "jam_keluar": "17:28",
   "terlambat": 0,
   "jadwal_id": "TM-01",
   "dibuat_oleh": "hrd"
  }
 },
 "jabatan": {
  "JBT-01": {
   "kode": "JBT-01",
   "nama": "Event Manager",
   "tunj_jabatan": 1500000,
   "tunj_keluarga": 400000,
   "akun_beban": "6-210",
   "aktif": true
  },
  "JBT-02": {
   "kode": "JBT-02",
   "nama": "Crew Produksi",
   "tunj_jabatan": 250000,
   "tunj_keluarga": 200000,
   "akun_beban": "6-210",
   "aktif": true
  },
  "JBT-03": {
   "kode": "JBT-03",
   "nama": "Operator Sound & Lighting",
   "tunj_jabatan": 500000,
   "tunj_keluarga": 250000,
   "akun_beban": "6-210",
   "aktif": true
  },
  "JBT-04": {
   "kode": "JBT-04",
   "nama": "Admin Keuangan",
   "tunj_jabatan": 400000,
   "tunj_keluarga": 250000,
   "akun_beban": "6-220",
   "aktif": true
  }
 },
 "jadwal": {
  "TM-01": {
   "kode": "TM-01",
   "jabatan_id": "JBT-01",
   "jam_masuk": "08:00",
   "jam_keluar": "17:00",
   "hari_kerja": 22,
   "aktif": true
  },
  "TM-02": {
   "kode": "TM-02",
   "jabatan_id": "JBT-02",
   "jam_masuk": "07:00",
   "jam_keluar": "16:00",
   "hari_kerja": 22,
   "aktif": true
  },
  "TM-03": {
   "kode": "TM-03",
   "jabatan_id": "JBT-03",
   "jam_masuk": "07:00",
   "jam_keluar": "16:00",
   "hari_kerja": 22,
   "aktif": true
  },
  "TM-04": {
   "kode": "TM-04",
   "jabatan_id": "JBT-04",
   "jam_masuk": "08:00",
   "jam_keluar": "17:00",
   "hari_kerja": 22,
   "aktif": true
  }
 },
 "golongan": {
  "GP-01": {
   "kode": "GP-01",
   "nama": "Golongan I",
   "jumlah": 3800000,
   "aktif": true
  },
  "GP-02": {
   "kode": "GP-02",
   "nama": "Golongan II",
   "jumlah": 4500000,
   "aktif": true
  },
  "GP-03": {
   "kode": "GP-03",
   "nama": "Golongan III",
   "jumlah": 5800000,
   "aktif": true
  },
  "GP-04": {
   "kode": "GP-04",
   "nama": "Golongan IV",
   "jumlah": 8000000,
   "aktif": true
  }
 },
 "karyawan": {
  "KRY-01": {
   "kode": "KRY-01",
   "nama": "Raka Aditya Wijaya",
   "status_ptkp": "K/2",
   "bank": "BCA",
   "no_rek": "1234567890",
   "aktif": true
  },
  "KRY-02": {
   "kode": "KRY-02",
   "nama": "Nadia Putri Anggraini",
   "status_ptkp": "TK/0",
   "bank": "Mandiri",
   "no_rek": "1370012345678",
   "aktif": true
  },
  "KRY-03": {
   "kode": "KRY-03",
   "nama": "Bagas Setiawan",
   "status_ptkp": "K/1",
   "bank": "BRI",
   "no_rek": "002101009876",
   "aktif": true
  },
  "KRY-04": {
   "kode": "KRY-04",
   "nama": "Dimas Prakoso",
   "status_ptkp": "TK/1",
   "bank": "BNI",
   "no_rek": "0987654321",
   "aktif": true
  },
  "KRY-05": {
   "kode": "KRY-05",
   "nama": "Fajar Ramadhan",
   "status_ptkp": "K/0",
   "bank": "BCA",
   "no_rek": "5550001234",
   "aktif": true
  }
 },
 "tunjangan": {
  "TNJ-03": {
   "kode": "TNJ-03",
   "nama": "Komunikasi",
   "nominal": 100000,
   "aktif": true
  },
  "TNJ-02": {
   "kode": "TNJ-02",
   "nama": "Makan",
   "nominal": 400000,
   "aktif": true
  },
  "TNJ-01": {
   "kode": "TNJ-01",
   "nama": "Transport",
   "nominal": 300000,
   "aktif": true
  },
  "TNJ-04": {
   "kode": "TNJ-04",
   "nama": "Kesehatan",
   "nominal": 200000,
   "aktif": true
  }
 },
 "setgaji": {
  "SET-01": {
   "kode": "SET-01",
   "karyawan_id": "KRY-01",
   "jabatan_id": "JBT-01",
   "golongan_id": "GP-04",
   "tunjangan_ids": [
    "TNJ-01",
    "TNJ-02",
    "TNJ-03",
    "TNJ-04"
   ],
   "aktif": true
  },
  "SET-02": {
   "kode": "SET-02",
   "karyawan_id": "KRY-02",
   "jabatan_id": "JBT-04",
   "golongan_id": "GP-02",
   "tunjangan_ids": [
    "TNJ-01",
    "TNJ-02",
    "TNJ-04"
   ],
   "aktif": true
  },
  "SET-03": {
   "kode": "SET-03",
   "karyawan_id": "KRY-03",
   "jabatan_id": "JBT-03",
   "golongan_id": "GP-02",
   "tunjangan_ids": [
    "TNJ-01",
    "TNJ-02"
   ],
   "aktif": true
  },
  "SET-04": {
   "kode": "SET-04",
   "karyawan_id": "KRY-04",
   "jabatan_id": "JBT-02",
   "golongan_id": "GP-01",
   "tunjangan_ids": [
    "TNJ-02"
   ],
   "aktif": true
  },
  "SET-05": {
   "kode": "SET-05",
   "karyawan_id": "KRY-05",
   "jabatan_id": "JBT-02",
   "golongan_id": "GP-01",
   "tunjangan_ids": [
    "TNJ-01",
    "TNJ-02"
   ],
   "aktif": true
  }
 }
};
