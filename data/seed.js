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
   "nama": "Biaya Gaji Tenaga Kerja Langsung",
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
  "ALT-03": {
   "kode": "ALT-03",
   "nama": "Setrika Uap",
   "satuan": "unit",
   "kategori_id": "KAT-02",
   "aktif": true
  },
  "ALT-02": {
   "kode": "ALT-02",
   "nama": "Mesin Pengering",
   "satuan": "unit",
   "kategori_id": "KAT-01",
   "aktif": true
  },
  "ALT-04": {
   "kode": "ALT-04",
   "nama": "Timbangan Digital 30 kg",
   "satuan": "unit",
   "kategori_id": "KAT-02",
   "aktif": true
  },
  "ALT-01": {
   "kode": "ALT-01",
   "nama": "Mesin Cuci 10 kg",
   "satuan": "unit",
   "kategori_id": "KAT-01",
   "aktif": true
  }
 },
 "meta": {
  "counters": {
   "JU2026": 7,
   "BP2026": 4,
   "BL2026": 2,
   "AST": 4,
   "SUP": 3,
   "ALT": 4,
   "LKP": 4,
   "KAT": 3,
   "KRY": 5,
   "JBT": 4,
   "GP": 4,
   "TNJ": 4,
   "TM": 4,
   "SET": 5
  },
  "profil": {
   "nama": "Laundry Sukses Mandiri",
   "ket": "SIA Konversi & SDM"
  }
 },
 "kategori": {
  "KAT-03": {
   "kode": "KAT-03",
   "nama": "Perangkat Kantor",
   "masa_manfaat_bulan": 48,
   "persen_residu": 0,
   "akun_aset": "1-150",
   "akun_akumulasi": "1-151",
   "akun_beban": "6-110",
   "aktif": true
  },
  "KAT-02": {
   "kode": "KAT-02",
   "nama": "Peralatan Kecil",
   "masa_manfaat_bulan": 24,
   "persen_residu": 0,
   "akun_aset": "1-150",
   "akun_akumulasi": "1-151",
   "akun_beban": "6-110",
   "aktif": true
  },
  "KAT-01": {
   "kode": "KAT-01",
   "nama": "Mesin Laundry",
   "masa_manfaat_bulan": 60,
   "persen_residu": 0,
   "akun_aset": "1-150",
   "akun_akumulasi": "1-151",
   "akun_beban": "6-110",
   "aktif": true
  }
 },
 "aset": {
  "AST-0004": {
   "kode": "AST-0004",
   "pembelian_id": "BP-2026-0003",
   "tgl_perolehan": "2026-10-15",
   "bulan_mulai": "2026-10",
   "status": "aktif",
   "nama": "Setrika Uap",
   "barang_id": "ALT-03",
   "kategori_id": "KAT-02",
   "nilai_perolehan": 1250000,
   "residu": 0,
   "garansi_bulan": 24,
   "garansi_sampai": "2028-10-15",
   "masa_manfaat_bulan": 24,
   "dasar_n": "garansi",
   "n": 24,
   "d": 52083,
   "terakhir": 52091,
   "pengaman": false,
   "akun_aset": "1-150",
   "akun_akm": "1-151",
   "akun_beban": "6-110",
   "jadwal": [
    {
     "p": 1,
     "periode": "2026-10",
     "beban": 52083,
     "akumulasi": 52083,
     "nilai_buku": 1197917,
     "jurnal_id": null
    },
    {
     "p": 2,
     "periode": "2026-11",
     "beban": 52083,
     "akumulasi": 104166,
     "nilai_buku": 1145834,
     "jurnal_id": null
    },
    {
     "p": 3,
     "periode": "2026-12",
     "beban": 52083,
     "akumulasi": 156249,
     "nilai_buku": 1093751,
     "jurnal_id": null
    },
    {
     "p": 4,
     "periode": "2027-01",
     "beban": 52083,
     "akumulasi": 208332,
     "nilai_buku": 1041668,
     "jurnal_id": null
    },
    {
     "p": 5,
     "periode": "2027-02",
     "beban": 52083,
     "akumulasi": 260415,
     "nilai_buku": 989585,
     "jurnal_id": null
    },
    {
     "p": 6,
     "periode": "2027-03",
     "beban": 52083,
     "akumulasi": 312498,
     "nilai_buku": 937502,
     "jurnal_id": null
    },
    {
     "p": 7,
     "periode": "2027-04",
     "beban": 52083,
     "akumulasi": 364581,
     "nilai_buku": 885419,
     "jurnal_id": null
    },
    {
     "p": 8,
     "periode": "2027-05",
     "beban": 52083,
     "akumulasi": 416664,
     "nilai_buku": 833336,
     "jurnal_id": null
    },
    {
     "p": 9,
     "periode": "2027-06",
     "beban": 52083,
     "akumulasi": 468747,
     "nilai_buku": 781253,
     "jurnal_id": null
    },
    {
     "p": 10,
     "periode": "2027-07",
     "beban": 52083,
     "akumulasi": 520830,
     "nilai_buku": 729170,
     "jurnal_id": null
    },
    {
     "p": 11,
     "periode": "2027-08",
     "beban": 52083,
     "akumulasi": 572913,
     "nilai_buku": 677087,
     "jurnal_id": null
    },
    {
     "p": 12,
     "periode": "2027-09",
     "beban": 52083,
     "akumulasi": 624996,
     "nilai_buku": 625004,
     "jurnal_id": null
    },
    {
     "p": 13,
     "periode": "2027-10",
     "beban": 52083,
     "akumulasi": 677079,
     "nilai_buku": 572921,
     "jurnal_id": null
    },
    {
     "p": 14,
     "periode": "2027-11",
     "beban": 52083,
     "akumulasi": 729162,
     "nilai_buku": 520838,
     "jurnal_id": null
    },
    {
     "p": 15,
     "periode": "2027-12",
     "beban": 52083,
     "akumulasi": 781245,
     "nilai_buku": 468755,
     "jurnal_id": null
    },
    {
     "p": 16,
     "periode": "2028-01",
     "beban": 52083,
     "akumulasi": 833328,
     "nilai_buku": 416672,
     "jurnal_id": null
    },
    {
     "p": 17,
     "periode": "2028-02",
     "beban": 52083,
     "akumulasi": 885411,
     "nilai_buku": 364589,
     "jurnal_id": null
    },
    {
     "p": 18,
     "periode": "2028-03",
     "beban": 52083,
     "akumulasi": 937494,
     "nilai_buku": 312506,
     "jurnal_id": null
    },
    {
     "p": 19,
     "periode": "2028-04",
     "beban": 52083,
     "akumulasi": 989577,
     "nilai_buku": 260423,
     "jurnal_id": null
    },
    {
     "p": 20,
     "periode": "2028-05",
     "beban": 52083,
     "akumulasi": 1041660,
     "nilai_buku": 208340,
     "jurnal_id": null
    },
    {
     "p": 21,
     "periode": "2028-06",
     "beban": 52083,
     "akumulasi": 1093743,
     "nilai_buku": 156257,
     "jurnal_id": null
    },
    {
     "p": 22,
     "periode": "2028-07",
     "beban": 52083,
     "akumulasi": 1145826,
     "nilai_buku": 104174,
     "jurnal_id": null
    },
    {
     "p": 23,
     "periode": "2028-08",
     "beban": 52083,
     "akumulasi": 1197909,
     "nilai_buku": 52091,
     "jurnal_id": null
    },
    {
     "p": 24,
     "periode": "2028-09",
     "beban": 52091,
     "akumulasi": 1250000,
     "nilai_buku": 0,
     "jurnal_id": null
    }
   ]
  },
  "AST-0001": {
   "kode": "AST-0001",
   "pembelian_id": "BP-2026-0001",
   "tgl_perolehan": "2026-10-05",
   "bulan_mulai": "2026-10",
   "status": "aktif",
   "nama": "Mesin Cuci 10 kg",
   "barang_id": "ALT-01",
   "kategori_id": "KAT-01",
   "nilai_perolehan": 10000000,
   "residu": 0,
   "garansi_bulan": 60,
   "garansi_sampai": "2031-10-05",
   "masa_manfaat_bulan": 60,
   "dasar_n": "garansi",
   "n": 60,
   "d": 166667,
   "terakhir": 166647,
   "pengaman": false,
   "akun_aset": "1-150",
   "akun_akm": "1-151",
   "akun_beban": "6-110",
   "jadwal": [
    {
     "p": 1,
     "periode": "2026-10",
     "beban": 166667,
     "akumulasi": 166667,
     "nilai_buku": 9833333,
     "jurnal_id": null
    },
    {
     "p": 2,
     "periode": "2026-11",
     "beban": 166667,
     "akumulasi": 333334,
     "nilai_buku": 9666666,
     "jurnal_id": null
    },
    {
     "p": 3,
     "periode": "2026-12",
     "beban": 166667,
     "akumulasi": 500001,
     "nilai_buku": 9499999,
     "jurnal_id": null
    },
    {
     "p": 4,
     "periode": "2027-01",
     "beban": 166667,
     "akumulasi": 666668,
     "nilai_buku": 9333332,
     "jurnal_id": null
    },
    {
     "p": 5,
     "periode": "2027-02",
     "beban": 166667,
     "akumulasi": 833335,
     "nilai_buku": 9166665,
     "jurnal_id": null
    },
    {
     "p": 6,
     "periode": "2027-03",
     "beban": 166667,
     "akumulasi": 1000002,
     "nilai_buku": 8999998,
     "jurnal_id": null
    },
    {
     "p": 7,
     "periode": "2027-04",
     "beban": 166667,
     "akumulasi": 1166669,
     "nilai_buku": 8833331,
     "jurnal_id": null
    },
    {
     "p": 8,
     "periode": "2027-05",
     "beban": 166667,
     "akumulasi": 1333336,
     "nilai_buku": 8666664,
     "jurnal_id": null
    },
    {
     "p": 9,
     "periode": "2027-06",
     "beban": 166667,
     "akumulasi": 1500003,
     "nilai_buku": 8499997,
     "jurnal_id": null
    },
    {
     "p": 10,
     "periode": "2027-07",
     "beban": 166667,
     "akumulasi": 1666670,
     "nilai_buku": 8333330,
     "jurnal_id": null
    },
    {
     "p": 11,
     "periode": "2027-08",
     "beban": 166667,
     "akumulasi": 1833337,
     "nilai_buku": 8166663,
     "jurnal_id": null
    },
    {
     "p": 12,
     "periode": "2027-09",
     "beban": 166667,
     "akumulasi": 2000004,
     "nilai_buku": 7999996,
     "jurnal_id": null
    },
    {
     "p": 13,
     "periode": "2027-10",
     "beban": 166667,
     "akumulasi": 2166671,
     "nilai_buku": 7833329,
     "jurnal_id": null
    },
    {
     "p": 14,
     "periode": "2027-11",
     "beban": 166667,
     "akumulasi": 2333338,
     "nilai_buku": 7666662,
     "jurnal_id": null
    },
    {
     "p": 15,
     "periode": "2027-12",
     "beban": 166667,
     "akumulasi": 2500005,
     "nilai_buku": 7499995,
     "jurnal_id": null
    },
    {
     "p": 16,
     "periode": "2028-01",
     "beban": 166667,
     "akumulasi": 2666672,
     "nilai_buku": 7333328,
     "jurnal_id": null
    },
    {
     "p": 17,
     "periode": "2028-02",
     "beban": 166667,
     "akumulasi": 2833339,
     "nilai_buku": 7166661,
     "jurnal_id": null
    },
    {
     "p": 18,
     "periode": "2028-03",
     "beban": 166667,
     "akumulasi": 3000006,
     "nilai_buku": 6999994,
     "jurnal_id": null
    },
    {
     "p": 19,
     "periode": "2028-04",
     "beban": 166667,
     "akumulasi": 3166673,
     "nilai_buku": 6833327,
     "jurnal_id": null
    },
    {
     "p": 20,
     "periode": "2028-05",
     "beban": 166667,
     "akumulasi": 3333340,
     "nilai_buku": 6666660,
     "jurnal_id": null
    },
    {
     "p": 21,
     "periode": "2028-06",
     "beban": 166667,
     "akumulasi": 3500007,
     "nilai_buku": 6499993,
     "jurnal_id": null
    },
    {
     "p": 22,
     "periode": "2028-07",
     "beban": 166667,
     "akumulasi": 3666674,
     "nilai_buku": 6333326,
     "jurnal_id": null
    },
    {
     "p": 23,
     "periode": "2028-08",
     "beban": 166667,
     "akumulasi": 3833341,
     "nilai_buku": 6166659,
     "jurnal_id": null
    },
    {
     "p": 24,
     "periode": "2028-09",
     "beban": 166667,
     "akumulasi": 4000008,
     "nilai_buku": 5999992,
     "jurnal_id": null
    },
    {
     "p": 25,
     "periode": "2028-10",
     "beban": 166667,
     "akumulasi": 4166675,
     "nilai_buku": 5833325,
     "jurnal_id": null
    },
    {
     "p": 26,
     "periode": "2028-11",
     "beban": 166667,
     "akumulasi": 4333342,
     "nilai_buku": 5666658,
     "jurnal_id": null
    },
    {
     "p": 27,
     "periode": "2028-12",
     "beban": 166667,
     "akumulasi": 4500009,
     "nilai_buku": 5499991,
     "jurnal_id": null
    },
    {
     "p": 28,
     "periode": "2029-01",
     "beban": 166667,
     "akumulasi": 4666676,
     "nilai_buku": 5333324,
     "jurnal_id": null
    },
    {
     "p": 29,
     "periode": "2029-02",
     "beban": 166667,
     "akumulasi": 4833343,
     "nilai_buku": 5166657,
     "jurnal_id": null
    },
    {
     "p": 30,
     "periode": "2029-03",
     "beban": 166667,
     "akumulasi": 5000010,
     "nilai_buku": 4999990,
     "jurnal_id": null
    },
    {
     "p": 31,
     "periode": "2029-04",
     "beban": 166667,
     "akumulasi": 5166677,
     "nilai_buku": 4833323,
     "jurnal_id": null
    },
    {
     "p": 32,
     "periode": "2029-05",
     "beban": 166667,
     "akumulasi": 5333344,
     "nilai_buku": 4666656,
     "jurnal_id": null
    },
    {
     "p": 33,
     "periode": "2029-06",
     "beban": 166667,
     "akumulasi": 5500011,
     "nilai_buku": 4499989,
     "jurnal_id": null
    },
    {
     "p": 34,
     "periode": "2029-07",
     "beban": 166667,
     "akumulasi": 5666678,
     "nilai_buku": 4333322,
     "jurnal_id": null
    },
    {
     "p": 35,
     "periode": "2029-08",
     "beban": 166667,
     "akumulasi": 5833345,
     "nilai_buku": 4166655,
     "jurnal_id": null
    },
    {
     "p": 36,
     "periode": "2029-09",
     "beban": 166667,
     "akumulasi": 6000012,
     "nilai_buku": 3999988,
     "jurnal_id": null
    },
    {
     "p": 37,
     "periode": "2029-10",
     "beban": 166667,
     "akumulasi": 6166679,
     "nilai_buku": 3833321,
     "jurnal_id": null
    },
    {
     "p": 38,
     "periode": "2029-11",
     "beban": 166667,
     "akumulasi": 6333346,
     "nilai_buku": 3666654,
     "jurnal_id": null
    },
    {
     "p": 39,
     "periode": "2029-12",
     "beban": 166667,
     "akumulasi": 6500013,
     "nilai_buku": 3499987,
     "jurnal_id": null
    },
    {
     "p": 40,
     "periode": "2030-01",
     "beban": 166667,
     "akumulasi": 6666680,
     "nilai_buku": 3333320,
     "jurnal_id": null
    },
    {
     "p": 41,
     "periode": "2030-02",
     "beban": 166667,
     "akumulasi": 6833347,
     "nilai_buku": 3166653,
     "jurnal_id": null
    },
    {
     "p": 42,
     "periode": "2030-03",
     "beban": 166667,
     "akumulasi": 7000014,
     "nilai_buku": 2999986,
     "jurnal_id": null
    },
    {
     "p": 43,
     "periode": "2030-04",
     "beban": 166667,
     "akumulasi": 7166681,
     "nilai_buku": 2833319,
     "jurnal_id": null
    },
    {
     "p": 44,
     "periode": "2030-05",
     "beban": 166667,
     "akumulasi": 7333348,
     "nilai_buku": 2666652,
     "jurnal_id": null
    },
    {
     "p": 45,
     "periode": "2030-06",
     "beban": 166667,
     "akumulasi": 7500015,
     "nilai_buku": 2499985,
     "jurnal_id": null
    },
    {
     "p": 46,
     "periode": "2030-07",
     "beban": 166667,
     "akumulasi": 7666682,
     "nilai_buku": 2333318,
     "jurnal_id": null
    },
    {
     "p": 47,
     "periode": "2030-08",
     "beban": 166667,
     "akumulasi": 7833349,
     "nilai_buku": 2166651,
     "jurnal_id": null
    },
    {
     "p": 48,
     "periode": "2030-09",
     "beban": 166667,
     "akumulasi": 8000016,
     "nilai_buku": 1999984,
     "jurnal_id": null
    },
    {
     "p": 49,
     "periode": "2030-10",
     "beban": 166667,
     "akumulasi": 8166683,
     "nilai_buku": 1833317,
     "jurnal_id": null
    },
    {
     "p": 50,
     "periode": "2030-11",
     "beban": 166667,
     "akumulasi": 8333350,
     "nilai_buku": 1666650,
     "jurnal_id": null
    },
    {
     "p": 51,
     "periode": "2030-12",
     "beban": 166667,
     "akumulasi": 8500017,
     "nilai_buku": 1499983,
     "jurnal_id": null
    },
    {
     "p": 52,
     "periode": "2031-01",
     "beban": 166667,
     "akumulasi": 8666684,
     "nilai_buku": 1333316,
     "jurnal_id": null
    },
    {
     "p": 53,
     "periode": "2031-02",
     "beban": 166667,
     "akumulasi": 8833351,
     "nilai_buku": 1166649,
     "jurnal_id": null
    },
    {
     "p": 54,
     "periode": "2031-03",
     "beban": 166667,
     "akumulasi": 9000018,
     "nilai_buku": 999982,
     "jurnal_id": null
    },
    {
     "p": 55,
     "periode": "2031-04",
     "beban": 166667,
     "akumulasi": 9166685,
     "nilai_buku": 833315,
     "jurnal_id": null
    },
    {
     "p": 56,
     "periode": "2031-05",
     "beban": 166667,
     "akumulasi": 9333352,
     "nilai_buku": 666648,
     "jurnal_id": null
    },
    {
     "p": 57,
     "periode": "2031-06",
     "beban": 166667,
     "akumulasi": 9500019,
     "nilai_buku": 499981,
     "jurnal_id": null
    },
    {
     "p": 58,
     "periode": "2031-07",
     "beban": 166667,
     "akumulasi": 9666686,
     "nilai_buku": 333314,
     "jurnal_id": null
    },
    {
     "p": 59,
     "periode": "2031-08",
     "beban": 166667,
     "akumulasi": 9833353,
     "nilai_buku": 166647,
     "jurnal_id": null
    },
    {
     "p": 60,
     "periode": "2031-09",
     "beban": 166647,
     "akumulasi": 10000000,
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
   "nama": "Setrika Uap",
   "barang_id": "ALT-03",
   "kategori_id": "KAT-02",
   "nilai_perolehan": 1250000,
   "residu": 0,
   "garansi_bulan": 24,
   "garansi_sampai": "2028-10-15",
   "masa_manfaat_bulan": 24,
   "dasar_n": "garansi",
   "n": 24,
   "d": 52083,
   "terakhir": 52091,
   "pengaman": false,
   "akun_aset": "1-150",
   "akun_akm": "1-151",
   "akun_beban": "6-110",
   "jadwal": [
    {
     "p": 1,
     "periode": "2026-10",
     "beban": 52083,
     "akumulasi": 52083,
     "nilai_buku": 1197917,
     "jurnal_id": null
    },
    {
     "p": 2,
     "periode": "2026-11",
     "beban": 52083,
     "akumulasi": 104166,
     "nilai_buku": 1145834,
     "jurnal_id": null
    },
    {
     "p": 3,
     "periode": "2026-12",
     "beban": 52083,
     "akumulasi": 156249,
     "nilai_buku": 1093751,
     "jurnal_id": null
    },
    {
     "p": 4,
     "periode": "2027-01",
     "beban": 52083,
     "akumulasi": 208332,
     "nilai_buku": 1041668,
     "jurnal_id": null
    },
    {
     "p": 5,
     "periode": "2027-02",
     "beban": 52083,
     "akumulasi": 260415,
     "nilai_buku": 989585,
     "jurnal_id": null
    },
    {
     "p": 6,
     "periode": "2027-03",
     "beban": 52083,
     "akumulasi": 312498,
     "nilai_buku": 937502,
     "jurnal_id": null
    },
    {
     "p": 7,
     "periode": "2027-04",
     "beban": 52083,
     "akumulasi": 364581,
     "nilai_buku": 885419,
     "jurnal_id": null
    },
    {
     "p": 8,
     "periode": "2027-05",
     "beban": 52083,
     "akumulasi": 416664,
     "nilai_buku": 833336,
     "jurnal_id": null
    },
    {
     "p": 9,
     "periode": "2027-06",
     "beban": 52083,
     "akumulasi": 468747,
     "nilai_buku": 781253,
     "jurnal_id": null
    },
    {
     "p": 10,
     "periode": "2027-07",
     "beban": 52083,
     "akumulasi": 520830,
     "nilai_buku": 729170,
     "jurnal_id": null
    },
    {
     "p": 11,
     "periode": "2027-08",
     "beban": 52083,
     "akumulasi": 572913,
     "nilai_buku": 677087,
     "jurnal_id": null
    },
    {
     "p": 12,
     "periode": "2027-09",
     "beban": 52083,
     "akumulasi": 624996,
     "nilai_buku": 625004,
     "jurnal_id": null
    },
    {
     "p": 13,
     "periode": "2027-10",
     "beban": 52083,
     "akumulasi": 677079,
     "nilai_buku": 572921,
     "jurnal_id": null
    },
    {
     "p": 14,
     "periode": "2027-11",
     "beban": 52083,
     "akumulasi": 729162,
     "nilai_buku": 520838,
     "jurnal_id": null
    },
    {
     "p": 15,
     "periode": "2027-12",
     "beban": 52083,
     "akumulasi": 781245,
     "nilai_buku": 468755,
     "jurnal_id": null
    },
    {
     "p": 16,
     "periode": "2028-01",
     "beban": 52083,
     "akumulasi": 833328,
     "nilai_buku": 416672,
     "jurnal_id": null
    },
    {
     "p": 17,
     "periode": "2028-02",
     "beban": 52083,
     "akumulasi": 885411,
     "nilai_buku": 364589,
     "jurnal_id": null
    },
    {
     "p": 18,
     "periode": "2028-03",
     "beban": 52083,
     "akumulasi": 937494,
     "nilai_buku": 312506,
     "jurnal_id": null
    },
    {
     "p": 19,
     "periode": "2028-04",
     "beban": 52083,
     "akumulasi": 989577,
     "nilai_buku": 260423,
     "jurnal_id": null
    },
    {
     "p": 20,
     "periode": "2028-05",
     "beban": 52083,
     "akumulasi": 1041660,
     "nilai_buku": 208340,
     "jurnal_id": null
    },
    {
     "p": 21,
     "periode": "2028-06",
     "beban": 52083,
     "akumulasi": 1093743,
     "nilai_buku": 156257,
     "jurnal_id": null
    },
    {
     "p": 22,
     "periode": "2028-07",
     "beban": 52083,
     "akumulasi": 1145826,
     "nilai_buku": 104174,
     "jurnal_id": null
    },
    {
     "p": 23,
     "periode": "2028-08",
     "beban": 52083,
     "akumulasi": 1197909,
     "nilai_buku": 52091,
     "jurnal_id": null
    },
    {
     "p": 24,
     "periode": "2028-09",
     "beban": 52091,
     "akumulasi": 1250000,
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
   "nama": "Mesin Pengering",
   "barang_id": "ALT-02",
   "kategori_id": "KAT-01",
   "nilai_perolehan": 7200000,
   "residu": 0,
   "garansi_bulan": 12,
   "garansi_sampai": "2027-10-10",
   "masa_manfaat_bulan": 60,
   "dasar_n": "masa_manfaat",
   "n": 60,
   "d": 120000,
   "terakhir": 120000,
   "pengaman": false,
   "akun_aset": "1-150",
   "akun_akm": "1-151",
   "akun_beban": "6-110",
   "jadwal": [
    {
     "p": 1,
     "periode": "2026-10",
     "beban": 120000,
     "akumulasi": 120000,
     "nilai_buku": 7080000,
     "jurnal_id": null
    },
    {
     "p": 2,
     "periode": "2026-11",
     "beban": 120000,
     "akumulasi": 240000,
     "nilai_buku": 6960000,
     "jurnal_id": null
    },
    {
     "p": 3,
     "periode": "2026-12",
     "beban": 120000,
     "akumulasi": 360000,
     "nilai_buku": 6840000,
     "jurnal_id": null
    },
    {
     "p": 4,
     "periode": "2027-01",
     "beban": 120000,
     "akumulasi": 480000,
     "nilai_buku": 6720000,
     "jurnal_id": null
    },
    {
     "p": 5,
     "periode": "2027-02",
     "beban": 120000,
     "akumulasi": 600000,
     "nilai_buku": 6600000,
     "jurnal_id": null
    },
    {
     "p": 6,
     "periode": "2027-03",
     "beban": 120000,
     "akumulasi": 720000,
     "nilai_buku": 6480000,
     "jurnal_id": null
    },
    {
     "p": 7,
     "periode": "2027-04",
     "beban": 120000,
     "akumulasi": 840000,
     "nilai_buku": 6360000,
     "jurnal_id": null
    },
    {
     "p": 8,
     "periode": "2027-05",
     "beban": 120000,
     "akumulasi": 960000,
     "nilai_buku": 6240000,
     "jurnal_id": null
    },
    {
     "p": 9,
     "periode": "2027-06",
     "beban": 120000,
     "akumulasi": 1080000,
     "nilai_buku": 6120000,
     "jurnal_id": null
    },
    {
     "p": 10,
     "periode": "2027-07",
     "beban": 120000,
     "akumulasi": 1200000,
     "nilai_buku": 6000000,
     "jurnal_id": null
    },
    {
     "p": 11,
     "periode": "2027-08",
     "beban": 120000,
     "akumulasi": 1320000,
     "nilai_buku": 5880000,
     "jurnal_id": null
    },
    {
     "p": 12,
     "periode": "2027-09",
     "beban": 120000,
     "akumulasi": 1440000,
     "nilai_buku": 5760000,
     "jurnal_id": null
    },
    {
     "p": 13,
     "periode": "2027-10",
     "beban": 120000,
     "akumulasi": 1560000,
     "nilai_buku": 5640000,
     "jurnal_id": null
    },
    {
     "p": 14,
     "periode": "2027-11",
     "beban": 120000,
     "akumulasi": 1680000,
     "nilai_buku": 5520000,
     "jurnal_id": null
    },
    {
     "p": 15,
     "periode": "2027-12",
     "beban": 120000,
     "akumulasi": 1800000,
     "nilai_buku": 5400000,
     "jurnal_id": null
    },
    {
     "p": 16,
     "periode": "2028-01",
     "beban": 120000,
     "akumulasi": 1920000,
     "nilai_buku": 5280000,
     "jurnal_id": null
    },
    {
     "p": 17,
     "periode": "2028-02",
     "beban": 120000,
     "akumulasi": 2040000,
     "nilai_buku": 5160000,
     "jurnal_id": null
    },
    {
     "p": 18,
     "periode": "2028-03",
     "beban": 120000,
     "akumulasi": 2160000,
     "nilai_buku": 5040000,
     "jurnal_id": null
    },
    {
     "p": 19,
     "periode": "2028-04",
     "beban": 120000,
     "akumulasi": 2280000,
     "nilai_buku": 4920000,
     "jurnal_id": null
    },
    {
     "p": 20,
     "periode": "2028-05",
     "beban": 120000,
     "akumulasi": 2400000,
     "nilai_buku": 4800000,
     "jurnal_id": null
    },
    {
     "p": 21,
     "periode": "2028-06",
     "beban": 120000,
     "akumulasi": 2520000,
     "nilai_buku": 4680000,
     "jurnal_id": null
    },
    {
     "p": 22,
     "periode": "2028-07",
     "beban": 120000,
     "akumulasi": 2640000,
     "nilai_buku": 4560000,
     "jurnal_id": null
    },
    {
     "p": 23,
     "periode": "2028-08",
     "beban": 120000,
     "akumulasi": 2760000,
     "nilai_buku": 4440000,
     "jurnal_id": null
    },
    {
     "p": 24,
     "periode": "2028-09",
     "beban": 120000,
     "akumulasi": 2880000,
     "nilai_buku": 4320000,
     "jurnal_id": null
    },
    {
     "p": 25,
     "periode": "2028-10",
     "beban": 120000,
     "akumulasi": 3000000,
     "nilai_buku": 4200000,
     "jurnal_id": null
    },
    {
     "p": 26,
     "periode": "2028-11",
     "beban": 120000,
     "akumulasi": 3120000,
     "nilai_buku": 4080000,
     "jurnal_id": null
    },
    {
     "p": 27,
     "periode": "2028-12",
     "beban": 120000,
     "akumulasi": 3240000,
     "nilai_buku": 3960000,
     "jurnal_id": null
    },
    {
     "p": 28,
     "periode": "2029-01",
     "beban": 120000,
     "akumulasi": 3360000,
     "nilai_buku": 3840000,
     "jurnal_id": null
    },
    {
     "p": 29,
     "periode": "2029-02",
     "beban": 120000,
     "akumulasi": 3480000,
     "nilai_buku": 3720000,
     "jurnal_id": null
    },
    {
     "p": 30,
     "periode": "2029-03",
     "beban": 120000,
     "akumulasi": 3600000,
     "nilai_buku": 3600000,
     "jurnal_id": null
    },
    {
     "p": 31,
     "periode": "2029-04",
     "beban": 120000,
     "akumulasi": 3720000,
     "nilai_buku": 3480000,
     "jurnal_id": null
    },
    {
     "p": 32,
     "periode": "2029-05",
     "beban": 120000,
     "akumulasi": 3840000,
     "nilai_buku": 3360000,
     "jurnal_id": null
    },
    {
     "p": 33,
     "periode": "2029-06",
     "beban": 120000,
     "akumulasi": 3960000,
     "nilai_buku": 3240000,
     "jurnal_id": null
    },
    {
     "p": 34,
     "periode": "2029-07",
     "beban": 120000,
     "akumulasi": 4080000,
     "nilai_buku": 3120000,
     "jurnal_id": null
    },
    {
     "p": 35,
     "periode": "2029-08",
     "beban": 120000,
     "akumulasi": 4200000,
     "nilai_buku": 3000000,
     "jurnal_id": null
    },
    {
     "p": 36,
     "periode": "2029-09",
     "beban": 120000,
     "akumulasi": 4320000,
     "nilai_buku": 2880000,
     "jurnal_id": null
    },
    {
     "p": 37,
     "periode": "2029-10",
     "beban": 120000,
     "akumulasi": 4440000,
     "nilai_buku": 2760000,
     "jurnal_id": null
    },
    {
     "p": 38,
     "periode": "2029-11",
     "beban": 120000,
     "akumulasi": 4560000,
     "nilai_buku": 2640000,
     "jurnal_id": null
    },
    {
     "p": 39,
     "periode": "2029-12",
     "beban": 120000,
     "akumulasi": 4680000,
     "nilai_buku": 2520000,
     "jurnal_id": null
    },
    {
     "p": 40,
     "periode": "2030-01",
     "beban": 120000,
     "akumulasi": 4800000,
     "nilai_buku": 2400000,
     "jurnal_id": null
    },
    {
     "p": 41,
     "periode": "2030-02",
     "beban": 120000,
     "akumulasi": 4920000,
     "nilai_buku": 2280000,
     "jurnal_id": null
    },
    {
     "p": 42,
     "periode": "2030-03",
     "beban": 120000,
     "akumulasi": 5040000,
     "nilai_buku": 2160000,
     "jurnal_id": null
    },
    {
     "p": 43,
     "periode": "2030-04",
     "beban": 120000,
     "akumulasi": 5160000,
     "nilai_buku": 2040000,
     "jurnal_id": null
    },
    {
     "p": 44,
     "periode": "2030-05",
     "beban": 120000,
     "akumulasi": 5280000,
     "nilai_buku": 1920000,
     "jurnal_id": null
    },
    {
     "p": 45,
     "periode": "2030-06",
     "beban": 120000,
     "akumulasi": 5400000,
     "nilai_buku": 1800000,
     "jurnal_id": null
    },
    {
     "p": 46,
     "periode": "2030-07",
     "beban": 120000,
     "akumulasi": 5520000,
     "nilai_buku": 1680000,
     "jurnal_id": null
    },
    {
     "p": 47,
     "periode": "2030-08",
     "beban": 120000,
     "akumulasi": 5640000,
     "nilai_buku": 1560000,
     "jurnal_id": null
    },
    {
     "p": 48,
     "periode": "2030-09",
     "beban": 120000,
     "akumulasi": 5760000,
     "nilai_buku": 1440000,
     "jurnal_id": null
    },
    {
     "p": 49,
     "periode": "2030-10",
     "beban": 120000,
     "akumulasi": 5880000,
     "nilai_buku": 1320000,
     "jurnal_id": null
    },
    {
     "p": 50,
     "periode": "2030-11",
     "beban": 120000,
     "akumulasi": 6000000,
     "nilai_buku": 1200000,
     "jurnal_id": null
    },
    {
     "p": 51,
     "periode": "2030-12",
     "beban": 120000,
     "akumulasi": 6120000,
     "nilai_buku": 1080000,
     "jurnal_id": null
    },
    {
     "p": 52,
     "periode": "2031-01",
     "beban": 120000,
     "akumulasi": 6240000,
     "nilai_buku": 960000,
     "jurnal_id": null
    },
    {
     "p": 53,
     "periode": "2031-02",
     "beban": 120000,
     "akumulasi": 6360000,
     "nilai_buku": 840000,
     "jurnal_id": null
    },
    {
     "p": 54,
     "periode": "2031-03",
     "beban": 120000,
     "akumulasi": 6480000,
     "nilai_buku": 720000,
     "jurnal_id": null
    },
    {
     "p": 55,
     "periode": "2031-04",
     "beban": 120000,
     "akumulasi": 6600000,
     "nilai_buku": 600000,
     "jurnal_id": null
    },
    {
     "p": 56,
     "periode": "2031-05",
     "beban": 120000,
     "akumulasi": 6720000,
     "nilai_buku": 480000,
     "jurnal_id": null
    },
    {
     "p": 57,
     "periode": "2031-06",
     "beban": 120000,
     "akumulasi": 6840000,
     "nilai_buku": 360000,
     "jurnal_id": null
    },
    {
     "p": 58,
     "periode": "2031-07",
     "beban": 120000,
     "akumulasi": 6960000,
     "nilai_buku": 240000,
     "jurnal_id": null
    },
    {
     "p": 59,
     "periode": "2031-08",
     "beban": 120000,
     "akumulasi": 7080000,
     "nilai_buku": 120000,
     "jurnal_id": null
    },
    {
     "p": 60,
     "periode": "2031-09",
     "beban": 120000,
     "akumulasi": 7200000,
     "nilai_buku": 0,
     "jurnal_id": null
    }
   ]
  }
 },
 "jurnal": {
  "JU-2026-0002": {
   "no": "JU-2026-0002",
   "tanggal": "2026-10-05",
   "periode": "2026-10",
   "jenis": "umum",
   "keterangan": "Pembelian peralatan BP-2026-0001, CV Sumber Elektronik Malang (Kredit)",
   "baris": [
    {
     "akun": "1-150",
     "debit": 10000000,
     "kredit": 0
    },
    {
     "akun": "2-110",
     "debit": 0,
     "kredit": 10000000
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
  "JU-2026-0003": {
   "no": "JU-2026-0003",
   "tanggal": "2026-10-10",
   "periode": "2026-10",
   "jenis": "umum",
   "keterangan": "Pembelian peralatan BP-2026-0002, CV Sumber Elektronik Malang (Tunai)",
   "baris": [
    {
     "akun": "1-150",
     "debit": 7200000,
     "kredit": 0
    },
    {
     "akun": "1-110",
     "debit": 0,
     "kredit": 7200000
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
     "debit": 2500000,
     "kredit": 0
    },
    {
     "akun": "3-110",
     "debit": 0,
     "kredit": 2500000
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
   "tanggal": "2026-10-12",
   "periode": "2026-10",
   "jenis": "umum",
   "keterangan": "Pembelian perlengkapan BL-2026-0001, UD Bersih Abadi (Tunai)",
   "baris": [
    {
     "akun": "1-140",
     "debit": 740000,
     "kredit": 0
    },
    {
     "akun": "1-110",
     "debit": 0,
     "kredit": 740000
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
  "JU-2026-0006": {
   "no": "JU-2026-0006",
   "tanggal": "2026-10-28",
   "periode": "2026-10",
   "jenis": "umum",
   "keterangan": "Pembelian perlengkapan BL-2026-0002, Toko Sinar Jaya (Kredit)",
   "baris": [
    {
     "akun": "1-140",
     "debit": 290000,
     "kredit": 0
    },
    {
     "akun": "2-110",
     "debit": 0,
     "kredit": 290000
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
  "JU-2026-0007": {
   "no": "JU-2026-0007",
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
  "BP-2026-0004": {
   "no": "BP-2026-0004",
   "jenis": "peralatan",
   "tanggal": "2026-11-02",
   "supplier_id": "SUP-02",
   "cara_bayar": "tunai",
   "jatuh_tempo": "",
   "keterangan": "",
   "items": [
    {
     "barang_id": "ALT-04",
     "qty": 1,
     "harga": 450000,
     "residu": 0,
     "garansi_bulan": 12,
     "masa_manfaat_bulan": 36,
     "dasar_n": "masa_manfaat"
    }
   ],
   "total": 450000,
   "status": "draft",
   "jurnal_id": null,
   "dibuat_oleh": "admin",
   "diubah_pada": "2026-11-02T05:00:00.000Z"
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
     "harga": 7200000,
     "residu": 0,
     "garansi_bulan": 12,
     "masa_manfaat_bulan": 60,
     "dasar_n": "masa_manfaat"
    }
   ],
   "total": 7200000,
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
     "harga": 10000000,
     "residu": 0,
     "garansi_bulan": 60,
     "masa_manfaat_bulan": 60,
     "dasar_n": "garansi"
    }
   ],
   "total": 10000000,
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
  "BL-2026-0002": {
   "no": "BL-2026-0002",
   "jenis": "perlengkapan",
   "tanggal": "2026-10-28",
   "supplier_id": "SUP-02",
   "cara_bayar": "kredit",
   "jatuh_tempo": "2026-11-28",
   "keterangan": "",
   "items": [
    {
     "barang_id": "LKP-03",
     "qty": 10,
     "harga": 25000
    },
    {
     "barang_id": "LKP-04",
     "qty": 2,
     "harga": 20000
    }
   ],
   "total": 290000,
   "status": "posted",
   "jurnal_id": "JU-2026-0006",
   "dibuat_oleh": "admin",
   "diubah_pada": "2026-11-02T05:00:00.000Z",
   "aset_ids": [],
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
     "barang_id": "ALT-03",
     "qty": 2,
     "harga": 1250000,
     "residu": 0,
     "garansi_bulan": 24,
     "masa_manfaat_bulan": 24,
     "dasar_n": "garansi"
    }
   ],
   "total": 2500000,
   "status": "posted",
   "jurnal_id": "JU-2026-0004",
   "dibuat_oleh": "admin",
   "diubah_pada": "2026-11-02T05:00:00.000Z",
   "aset_ids": [
    "AST-0003",
    "AST-0004"
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
     "barang_id": "LKP-02",
     "qty": 6,
     "harga": 30000
    },
    {
     "barang_id": "LKP-01",
     "qty": 20,
     "harga": 28000
    }
   ],
   "total": 740000,
   "status": "posted",
   "jurnal_id": "JU-2026-0005",
   "dibuat_oleh": "admin",
   "diubah_pada": "2026-11-02T05:00:00.000Z",
   "aset_ids": [],
   "diposting_oleh": "admin",
   "diposting_pada": "2026-11-02T05:00:00.000Z"
  }
 },
 "supplier": {
  "SUP-02": {
   "kode": "SUP-02",
   "nama": "Toko Sinar Jaya",
   "alamat": "Jl. Raya Singosari, Malang",
   "telepon": "",
   "email": "",
   "npwp": "",
   "aktif": true
  },
  "SUP-03": {
   "kode": "SUP-03",
   "nama": "UD Bersih Abadi",
   "alamat": "Jl. Soekarno Hatta, Malang",
   "telepon": "",
   "email": "",
   "npwp": "",
   "aktif": true
  },
  "SUP-01": {
   "kode": "SUP-01",
   "nama": "CV Sumber Elektronik Malang",
   "alamat": "Jl. Letjen Sutoyo, Malang",
   "telepon": "",
   "email": "",
   "npwp": "",
   "aktif": true
  }
 },
 "perlengkapan": {
  "LKP-02": {
   "kode": "LKP-02",
   "nama": "Pewangi",
   "satuan": "liter",
   "aktif": true
  },
  "LKP-01": {
   "kode": "LKP-01",
   "nama": "Deterjen Cair",
   "satuan": "liter",
   "aktif": true
  },
  "LKP-04": {
   "kode": "LKP-04",
   "nama": "Hanger",
   "satuan": "lusin",
   "aktif": true
  },
  "LKP-03": {
   "kode": "LKP-03",
   "nama": "Plastik Kemasan",
   "satuan": "pak",
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
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261028": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-28",
   "absensi": "Hadir",
   "jam_masuk": "07:53",
   "jam_keluar": "17:11",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261019": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-19",
   "absensi": "Cuti",
   "jam_masuk": "",
   "jam_keluar": "",
   "terlambat": 0,
   "jadwal_id": "TM-03",
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
   "jam_masuk": "07:48",
   "jam_keluar": "17:43",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261001": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-01",
   "absensi": "Hadir",
   "jam_masuk": "08:27",
   "jam_keluar": "17:28",
   "terlambat": 27,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261021": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-21",
   "absensi": "Hadir",
   "jam_masuk": "07:46",
   "jam_keluar": "17:38",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261026": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-26",
   "absensi": "Hadir",
   "jam_masuk": "07:48",
   "jam_keluar": "17:23",
   "terlambat": 0,
   "jadwal_id": "TM-02",
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
   "jam_masuk": "08:17",
   "jam_keluar": "17:25",
   "terlambat": 17,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261023": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-23",
   "absensi": "Hadir",
   "jam_masuk": "07:55",
   "jam_keluar": "17:39",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261005": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-05",
   "absensi": "Hadir",
   "jam_masuk": "08:22",
   "jam_keluar": "17:05",
   "terlambat": 22,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-03-20261022": {
   "karyawan_id": "KRY-03",
   "tanggal": "2026-10-22",
   "absensi": "Hadir",
   "jam_masuk": "06:57",
   "jam_keluar": "16:43",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261015": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-15",
   "absensi": "Hadir",
   "jam_masuk": "07:49",
   "jam_keluar": "17:36",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261029": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-29",
   "absensi": "Hadir",
   "jam_masuk": "07:50",
   "jam_keluar": "17:08",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261030": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-30",
   "absensi": "Hadir",
   "jam_masuk": "07:54",
   "jam_keluar": "17:11",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261028": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-28",
   "absensi": "Hadir",
   "jam_masuk": "06:51",
   "jam_keluar": "16:00",
   "terlambat": 0,
   "jadwal_id": "TM-03",
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
   "jadwal_id": "TM-02",
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
   "jadwal_id": "TM-02",
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
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261016": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-16",
   "absensi": "Hadir",
   "jam_masuk": "07:52",
   "jam_keluar": "17:36",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261013": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-13",
   "absensi": "Alpa",
   "jam_masuk": "",
   "jam_keluar": "",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261005": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-05",
   "absensi": "Hadir",
   "jam_masuk": "07:50",
   "jam_keluar": "17:26",
   "terlambat": 0,
   "jadwal_id": "TM-02",
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
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261026": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-26",
   "absensi": "Hadir",
   "jam_masuk": "06:50",
   "jam_keluar": "16:39",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261005": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-05",
   "absensi": "Sakit",
   "jam_masuk": "",
   "jam_keluar": "",
   "terlambat": 0,
   "jadwal_id": "TM-03",
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
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261030": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-30",
   "absensi": "Hadir",
   "jam_masuk": "06:49",
   "jam_keluar": "16:37",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261008": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-08",
   "absensi": "Hadir",
   "jam_masuk": "07:57",
   "jam_keluar": "17:01",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261027": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-27",
   "absensi": "Hadir",
   "jam_masuk": "06:46",
   "jam_keluar": "16:16",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261016": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-16",
   "absensi": "Hadir",
   "jam_masuk": "06:54",
   "jam_keluar": "16:18",
   "terlambat": 0,
   "jadwal_id": "TM-03",
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
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261023": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-23",
   "absensi": "Hadir",
   "jam_masuk": "06:51",
   "jam_keluar": "16:00",
   "terlambat": 0,
   "jadwal_id": "TM-03",
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
   "jam_masuk": "07:53",
   "jam_keluar": "17:03",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261009": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-09",
   "absensi": "Hadir",
   "jam_masuk": "07:59",
   "jam_keluar": "17:26",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261007": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-07",
   "absensi": "Hadir",
   "jam_masuk": "07:56",
   "jam_keluar": "17:12",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261020": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-20",
   "absensi": "Hadir",
   "jam_masuk": "06:59",
   "jam_keluar": "16:33",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261009": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-09",
   "absensi": "Hadir",
   "jam_masuk": "08:32",
   "jam_keluar": "17:37",
   "terlambat": 32,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261022": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-22",
   "absensi": "Hadir",
   "jam_masuk": "07:58",
   "jam_keluar": "17:37",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261006": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-06",
   "absensi": "Hadir",
   "jam_masuk": "08:03",
   "jam_keluar": "17:16",
   "terlambat": 3,
   "jadwal_id": "TM-02",
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
   "jam_masuk": "07:46",
   "jam_keluar": "17:01",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261012": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-12",
   "absensi": "Hadir",
   "jam_masuk": "07:59",
   "jam_keluar": "17:25",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261021": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-21",
   "absensi": "Hadir",
   "jam_masuk": "07:47",
   "jam_keluar": "17:17",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261019": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-19",
   "absensi": "Hadir",
   "jam_masuk": "07:50",
   "jam_keluar": "17:02",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261008": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-08",
   "absensi": "Hadir",
   "jam_masuk": "06:49",
   "jam_keluar": "16:00",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261006": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-06",
   "absensi": "Hadir",
   "jam_masuk": "07:47",
   "jam_keluar": "17:12",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261029": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-29",
   "absensi": "Sakit",
   "jam_masuk": "",
   "jam_keluar": "",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261013": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-13",
   "absensi": "Cuti",
   "jam_masuk": "",
   "jam_keluar": "",
   "terlambat": 0,
   "jadwal_id": "TM-03",
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
   "jadwal_id": "TM-03",
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
   "jam_masuk": "07:19",
   "jam_keluar": "16:32",
   "terlambat": 19,
   "jadwal_id": "TM-03",
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
   "jam_masuk": "07:47",
   "jam_keluar": "17:38",
   "terlambat": 0,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261020": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-20",
   "absensi": "Hadir",
   "jam_masuk": "07:50",
   "jam_keluar": "17:35",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261007": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-07",
   "absensi": "Hadir",
   "jam_masuk": "06:49",
   "jam_keluar": "16:09",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261015": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-15",
   "absensi": "Hadir",
   "jam_masuk": "07:00",
   "jam_keluar": "16:00",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-03-20261023": {
   "karyawan_id": "KRY-03",
   "tanggal": "2026-10-23",
   "absensi": "Hadir",
   "jam_masuk": "06:59",
   "jam_keluar": "16:01",
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
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261006": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-06",
   "absensi": "Hadir",
   "jam_masuk": "06:56",
   "jam_keluar": "16:07",
   "terlambat": 0,
   "jadwal_id": "TM-03",
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
   "jadwal_id": "TM-03",
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
   "jam_masuk": "08:29",
   "jam_keluar": "17:27",
   "terlambat": 29,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261020": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-20",
   "absensi": "Hadir",
   "jam_masuk": "08:17",
   "jam_keluar": "17:00",
   "terlambat": 17,
   "jadwal_id": "TM-04",
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
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-02-20261027": {
   "karyawan_id": "KRY-02",
   "tanggal": "2026-10-27",
   "absensi": "Hadir",
   "jam_masuk": "07:50",
   "jam_keluar": "17:15",
   "terlambat": 0,
   "jadwal_id": "TM-02",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-04-20261002": {
   "karyawan_id": "KRY-04",
   "tanggal": "2026-10-02",
   "absensi": "Alpa",
   "jam_masuk": "",
   "jam_keluar": "",
   "terlambat": 0,
   "jadwal_id": "TM-03",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261002": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-02",
   "absensi": "Hadir",
   "jam_masuk": "08:15",
   "jam_keluar": "17:14",
   "terlambat": 15,
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261008": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-08",
   "absensi": "Hadir",
   "jam_masuk": "07:59",
   "jam_keluar": "17:27",
   "terlambat": 0,
   "jadwal_id": "TM-04",
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
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261007": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-07",
   "absensi": "Hadir",
   "jam_masuk": "08:32",
   "jam_keluar": "17:28",
   "terlambat": 32,
   "jadwal_id": "TM-04",
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
   "jadwal_id": "TM-04",
   "dibuat_oleh": "hrd"
  },
  "PRS-KRY-05-20261028": {
   "karyawan_id": "KRY-05",
   "tanggal": "2026-10-28",
   "absensi": "Hadir",
   "jam_masuk": "07:48",
   "jam_keluar": "17:33",
   "terlambat": 0,
   "jadwal_id": "TM-04",
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
   "jam_masuk": "07:49",
   "jam_keluar": "17:28",
   "terlambat": 0,
   "jadwal_id": "TM-04",
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
   "nama": "Kepala Toko",
   "tunj_jabatan": 750000,
   "tunj_keluarga": 300000,
   "akun_beban": "6-220",
   "aktif": true
  },
  "JBT-04": {
   "kode": "JBT-04",
   "nama": "Kurir Antar-Jemput",
   "tunj_jabatan": 200000,
   "tunj_keluarga": 200000,
   "akun_beban": "6-210",
   "aktif": true
  },
  "JBT-02": {
   "kode": "JBT-02",
   "nama": "Kasir / Admin",
   "tunj_jabatan": 300000,
   "tunj_keluarga": 200000,
   "akun_beban": "6-220",
   "aktif": true
  },
  "JBT-03": {
   "kode": "JBT-03",
   "nama": "Operator Cuci & Setrika",
   "tunj_jabatan": 250000,
   "tunj_keluarga": 200000,
   "akun_beban": "6-210",
   "aktif": true
  }
 },
 "jadwal": {
  "TM-02": {
   "kode": "TM-02",
   "jabatan_id": "JBT-02",
   "jam_masuk": "08:00",
   "jam_keluar": "17:00",
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
  },
  "TM-03": {
   "kode": "TM-03",
   "jabatan_id": "JBT-03",
   "jam_masuk": "07:00",
   "jam_keluar": "16:00",
   "hari_kerja": 22,
   "aktif": true
  },
  "TM-01": {
   "kode": "TM-01",
   "jabatan_id": "JBT-01",
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
   "jumlah": 3550000,
   "aktif": true
  },
  "GP-04": {
   "kode": "GP-04",
   "nama": "Golongan IV",
   "jumlah": 5500000,
   "aktif": true
  },
  "GP-03": {
   "kode": "GP-03",
   "nama": "Golongan III",
   "jumlah": 4500000,
   "aktif": true
  },
  "GP-02": {
   "kode": "GP-02",
   "nama": "Golongan II",
   "jumlah": 3800000,
   "aktif": true
  }
 },
 "karyawan": {
  "KRY-04": {
   "kode": "KRY-04",
   "nama": "Dewi Lestari",
   "status_ptkp": "TK/0",
   "bank": "BNI",
   "no_rek": "0987654321",
   "aktif": true
  },
  "KRY-02": {
   "kode": "KRY-02",
   "nama": "Siti Rahmawati",
   "status_ptkp": "TK/0",
   "bank": "Mandiri",
   "no_rek": "1370012345678",
   "aktif": true
  },
  "KRY-01": {
   "kode": "KRY-01",
   "nama": "Andi Pratama",
   "status_ptkp": "K/2",
   "bank": "BCA",
   "no_rek": "1234567890",
   "aktif": true
  },
  "KRY-05": {
   "kode": "KRY-05",
   "nama": "Rizky Maulana",
   "status_ptkp": "K/0",
   "bank": "BCA",
   "no_rek": "5550001234",
   "aktif": true
  },
  "KRY-03": {
   "kode": "KRY-03",
   "nama": "Budi Santoso",
   "status_ptkp": "K/1",
   "bank": "BRI",
   "no_rek": "002101009876",
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
  "SET-04": {
   "kode": "SET-04",
   "karyawan_id": "KRY-04",
   "jabatan_id": "JBT-03",
   "golongan_id": "GP-01",
   "tunjangan_ids": [
    "TNJ-02"
   ],
   "aktif": true
  },
  "SET-05": {
   "kode": "SET-05",
   "karyawan_id": "KRY-05",
   "jabatan_id": "JBT-04",
   "golongan_id": "GP-01",
   "tunjangan_ids": [
    "TNJ-01",
    "TNJ-02"
   ],
   "aktif": true
  },
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
  "SET-03": {
   "kode": "SET-03",
   "karyawan_id": "KRY-03",
   "jabatan_id": "JBT-03",
   "golongan_id": "GP-01",
   "tunjangan_ids": [
    "TNJ-01",
    "TNJ-02"
   ],
   "aktif": true
  },
  "SET-02": {
   "kode": "SET-02",
   "karyawan_id": "KRY-02",
   "jabatan_id": "JBT-02",
   "golongan_id": "GP-02",
   "tunjangan_ids": [
    "TNJ-01",
    "TNJ-02",
    "TNJ-04"
   ],
   "aktif": true
  }
 }
};
