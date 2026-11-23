#!/usr/bin/env python3
"""Membangkitkan docs/logical-database.{svg,png,mmd} dan diagram per modul docs/logical-database-<modul>.{svg,png}
dari prisma/schema.prisma (tata letak manual di KONFIG, garis dirutekan otomatis kecuali relasi di tepi_kiri).

Pemakaian (dari akar repo, butuh Python 3 + Pillow dan rsvg-convert):
    python3 docs/alat/buat_logical_database.py             # tulis svg, png, dan mmd
    python3 docs/alat/buat_logical_database.py --cek-db    # sekaligus cocokkan jumlah tabel dan FK dengan Postgres (docker sia-dpro-pg)
    CEK_DB=sia_fee_event python3 docs/alat/buat_logical_database.py --cek-db   # cocokkan dengan database lain

Aturan penurunan:
- Tabel dan kolom memakai nama database (@@map / @map), bukan nama field Prisma.
- Satu @relation(fields, references) menjadi satu relasi FK. Sisi induk "1" bila semua kolom FK wajib,
  "0..1" bila ada yang opsional. Sisi anak "0..N", atau "0..1" bila kolom FK itu unik.
- Di PNG, rujukan ke pengguna (dibuat_oleh, disetujui_oleh, dst.) dan ke akun (kecuali detail_jurnal) hanya ditulis
  di kolom, tanpa garis. Begitu juga FK ke tabel di luar gambar (diagram per modul) dan pasangan di "tanpa_garis".
  Setiap relasi selain ke pengguna dan akun wajib bergaris di minimal satu gambar (dicek di akhir).
  File .mmd memuat semua relasi tanpa pengecualian.
- Kolom stempel waktu audit (KOLOM_WAKTU) tidak digambar di PNG; .mmd memuat semuanya.
- Ukuran kanvas = ukuran cetak (poin) di halaman laporan, jadi ukuran huruf di sini = ukuran huruf tercetak.
"""
import math, os, re, subprocess, sys

AKAR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SKEMA = os.path.join(AKAR, "prisma", "schema.prisma")
KELUAR = os.path.join(AKAR, "docs")
SKALAR = {"String", "Int", "Boolean", "DateTime", "Float", "Decimal", "BigInt", "Json", "Bytes"}

# Pengelompokan per siklus (nama tabel database).
KELOMPOK = [
    ("konv", "Siklus konversi", "#FDE7E4", ["supplier", "kategori_aset", "peralatan", "perlengkapan", "pembelian", "detail_pembelian",
                                           "aset", "jadwal_penyusutan", "opname", "detail_opname", "pelepasan"]),
    ("sdm", "Siklus SDM: gaji inhouse", "#E3EFFA", ["karyawan", "jabatan", "golongan", "tunjangan", "versi_nominal", "jadwal_kerja", "setting_gaji", "setting_tunjangan",
                                      "presensi", "slip_gaji", "slip_tunjangan", "penggajian"]),
    ("fee", "Siklus SDM: fee event", "#ECE4F6", ["event", "sesi_event", "penugasan_event", "kehadiran_event", "laporan_fee", "slip_fee"]),
    ("lap", "Pelaporan", "#FFF3C4", ["akun", "periode", "riwayat_periode", "jurnal", "detail_jurnal", "investasi_kas"]),
    ("sis", "Pengguna dan sistem", "#E6F2E4", ["pengguna", "sesi", "log_aktivitas", "profil_usaha", "penghitung"]),
]
GRUP_TABEL = {t: kode for kode, _, _, tabs in KELOMPOK for t in tabs}
# Tabel yang rujukannya hanya ditulis di kolom (tanpa garis). "akun" tetap digambar dari detail_jurnal.
TANPA_GARIS = {"pengguna": set(), "akun": {"detail_jurnal"}}


def bergaris(anak, induk):
    """True bila relasi anak -> induk digambar sebagai garis di diagram yang sedang dibuat (CFG). Induk di luar diagram,
    rujukan ke pengguna dan akun, serta pasangan di CFG["tanpa_garis"] hanya ditulis di kolom (FK ... -> induk)."""
    if anak not in CFG["tabel"] or induk not in CFG["tabel"]:
        return False
    if induk in TANPA_GARIS and anak not in TANPA_GARIS[induk]:
        return False
    return (anak, induk) not in CFG.get("tanpa_garis", set())

# Relasi header ke detail yang oleh aturan aplikasi wajib berisi minimal satu baris, jadi sisi anaknya digambar 1..N
# (bukan 0..N seperti hasil penurunan dari skema). Kunci: (tabel anak, tabel induk). Sumber kebenaran: validasi di src/lib.
SATU_BANYAK = {
    # skemaPembelian: baris z.array(...).min(1, "Isi minimal satu baris barang.")
    ("detail_pembelian", "pembelian"): "skema pembelian: baris minimal satu (src/lib/skema/pembelian.ts)",
    # validasiBaris: jurnal tidak disimpan bila kurang dari dua baris atau tidak seimbang (src/lib/inti/jurnal.ts)
    ("detail_jurnal", "jurnal"): "validasiBaris: minimal dua baris detail (src/lib/inti/jurnal.ts)",
    # nilai-sisa: ditolak bila tidak ada perlengkapan, dan setiap perlengkapan wajib dihitung lalu disimpan sebagai detail
    ("detail_opname", "opname"): "nilai-sisa: semua perlengkapan wajib dihitung, kosong ditolak (src/lib/aksi/konversi/nilai-sisa.ts)",
}
# Sengaja TIDAK 1..N: penggajian -> slip_gaji. Pengajuan memang butuh minimal satu slip draf, tetapi penggajian yang
# ditolak melepas slipnya (slip kembali DRAFT dan no_penggajian dikosongkan, tolakPenggajian di
# src/lib/aksi/sdm/distribusi.ts), jadi penggajian DITOLAK tidak punya slip lagi: sisi slip_gaji tetap 0..N.

# Stempel waktu audit yang tidak digambar (disebut di keterangan gambar).
KOLOM_WAKTU = {"dibuat_pada", "diubah_pada", "diajukan_pada", "dihitung_pada", "dibalik_pada", "dinilai_pada"}

# Penanda atribut: tebal = status persetujuan / aktif, miring = atribut perhitungan.
KOLOM_STATUS = re.compile(r"^(status|status_periode|aktif|alasan_tolak|alasan_balik|disetujui_oleh|disetujui_pada|diajukan_pada|dibalik_oleh|dibalik_pada|dikunci_oleh|dikunci_pada|pengaman|status_ptkp|penilaian|diputuskan_pada)$")
KOLOM_HITUNG = re.compile(r"^(nilai_perolehan|residu|garansi_bulan|garansi_sampai|masa_manfaat_bulan|dasar_n|n|d|terakhir|persen_residu|beban|akumulasi|nilai_buku|"
                          r"harga_jual|laba_rugi|total_beban|saldo_buku|nilai_sisa|jumlah|gaji_pokok|tunj_.*|potongan_absen|bruto|bruto_setahun|biaya_jabatan|neto_setahun|ptkp|pkp|pph_setahun|pph21|thp|"
                          r"total_bruto|total_pph|total_thp|jumlah_slip|hari_kerja|jumlah_presensi|hadir|izin|sakit|cuti|alpa|jam_kerja|terlambat_menit|terlambat|nominal|debit|kredit|"
                          r"tarif|jumlah_sesi|menit_tercatat|menit_diakui|jumlah_hari|fee_usulan|fee_akhir|dpp|dibayar|total_usulan|total_fee|total_dibayar)$")


def baca_skema(path):
    teks = open(path, encoding="utf-8").read()
    enum = set(re.findall(r"^enum\s+(\w+)", teks, re.M))
    model = {}
    for m in re.finditer(r"^model\s+(\w+)\s*\{(.*?)^\}", teks, re.M | re.S):
        nama, badan = m.group(1), m.group(2)
        info = {"nama": nama, "tabel": nama, "medan": [], "pk": [], "unik": [], "relasi": []}
        for baris in badan.splitlines():
            b = baris.split("//")[0].strip()
            if not b:
                continue
            if b.startswith("@@map"):
                info["tabel"] = re.search(r'"([^"]+)"', b).group(1)
            elif b.startswith("@@id"):
                info["pk"] = [x.strip() for x in re.search(r"\[(.*?)\]", b).group(1).split(",")]
            elif b.startswith("@@unique"):
                info["unik"].append([x.strip() for x in re.search(r"\[(.*?)\]", b).group(1).split(",")])
            elif b.startswith("@@"):
                continue
            else:
                f = re.match(r"(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$", b)
                if not f:
                    continue
                nm, tp, arr, opt, sisa = f.groups()
                info["medan"].append({"nm": nm, "tp": tp, "arr": bool(arr), "opt": bool(opt), "attr": sisa or ""})
        model[nama] = info
    # kolom database + kunci
    for info in model.values():
        for f in info["medan"]:
            mp = re.search(r'@map\("([^"]+)"\)', f["attr"])
            f["db"] = mp.group(1) if mp else f["nm"]
            f["skalar"] = f["tp"] in SKALAR or f["tp"] in enum
            if "@id" in f["attr"] and f["skalar"]:
                info["pk"] = [f["nm"]]
            if "@unique" in f["attr"] and f["skalar"]:
                info["unik"].append([f["nm"]])
    for info in model.values():
        nm2db = {f["nm"]: f["db"] for f in info["medan"]}
        info["nm2db"] = nm2db
        for f in info["medan"]:
            if f["skalar"]:
                continue
            r = re.search(r"@relation\(([^)]*)\)", f["attr"])
            if not r or "fields:" not in r.group(1):
                continue
            kol = re.search(r"fields:\s*\[(.*?)\]", r.group(1)).group(1).split(",")
            ref = re.search(r"references:\s*\[(.*?)\]", r.group(1)).group(1).split(",")
            kol = [k.strip() for k in kol]; ref = [k.strip() for k in ref]
            wajib = all(not next(x for x in info["medan"] if x["nm"] == k)["opt"] for k in kol)
            unik = any(set(kol) == set(u) for u in info["unik"]) or set(kol) == set(info["pk"])
            hapus = re.search(r"onDelete:\s*(\w+)", r.group(1))
            info["relasi"].append({"induk": f["tp"], "kol": kol, "ref": ref, "wajib": wajib, "unik": unik,
                                   "hapus": hapus.group(1) if hapus else ""})
    return model




def cek_db(tabel2info):
    # nama database bisa diganti lewat CEK_DB, misalnya database worktree yang sudah dimigrasi
    cmd = ["docker", "exec", "sia-dpro-pg", "psql", "-U", "sia", "-d", os.environ.get("CEK_DB", "sia_dpro"), "-Atc",
           "select table_name from information_schema.tables where table_schema='public' and table_name<>'_prisma_migrations' order by 1"]
    db = set(subprocess.run(cmd, capture_output=True, text=True, check=True).stdout.split())
    cmd[-1] = "select count(*) from information_schema.table_constraints where constraint_type='FOREIGN KEY' and table_schema='public'"
    n_fk_db = int(subprocess.run(cmd, capture_output=True, text=True, check=True).stdout.strip())
    n_fk = sum(len(i["relasi"]) for i in tabel2info.values())
    print(f"tabel: skema {len(tabel2info)}, database {len(db)}, selisih {sorted(db ^ set(tabel2info))}")
    print(f"foreign key: skema {n_fk}, database {n_fk_db}")
    cmd[-1] = "select table_name||'.'||column_name from information_schema.columns where table_schema='public' and is_nullable='NO'"
    wajib_db = set(subprocess.run(cmd, capture_output=True, text=True, check=True).stdout.split())
    beda = []
    for info in tabel2info.values():
        for r in info["relasi"]:
            ada = all(f"{info['tabel']}.{info['nm2db'][k]}" in wajib_db for k in r["kol"])
            if ada != r["wajib"]:
                beda.append((info["tabel"], r["kol"]))
    print(f"opsionalitas FK: {len(beda)} selisih dengan kolom NOT NULL di database {beda}")
    return db == set(tabel2info) and n_fk == n_fk_db and not beda

# ----------------------------------------------------------------------------------------------
# Isi kotak
# ----------------------------------------------------------------------------------------------
from svgkit import Svg, Perute, lebar_segmen, lebar_teks

UK = 6.5          # ukuran huruf isi kotak (pt cetak)
UK_JUDUL = 7.4    # nama tabel
PAD = 3.2         # bantalan horizontal kotak
LH = UK * 1.16     # tinggi baris


def pecah_segmen(awal, daftar, lebar):
    """awal: segmen penanda di baris pertama (mis. FK). daftar: [(segmen, ...)] dipisah koma. Mengembalikan daftar baris (segmen)."""
    hasil = []
    cur = list(awal); w = lebar_segmen(cur, UK)
    kosong = True
    for k, seg in enumerate(daftar):
        akhir = k == len(daftar) - 1
        tambah = list(seg) + ([] if akhir else [(", ", "r")])
        wt = lebar_segmen(tambah, UK)
        if not kosong and w + wt > lebar:
            hasil.append(cur); cur = [("    ", "r")]; w = lebar_segmen(cur, UK)
        cur += tambah; w += wt; kosong = False
    hasil.append(cur)
    return hasil


def isi_kotak(info, model, lebar):
    kolom_fk = {}
    for r in info["relasi"]:
        for k in r["kol"]:
            kolom_fk.setdefault(info["nm2db"][k], model[r["induk"]]["tabel"])
    pk_db = [info["nm2db"][k] for k in info["pk"]]
    baris = []
    pk_fk = [c for c in pk_db if c in kolom_fk]
    pk_saja = [c for c in pk_db if c not in kolom_fk]
    if pk_fk:
        baris += pecah_segmen([("PK/FK", "b"), ("  ", "r")], [[(c, "r")] for c in pk_fk], lebar)
    if pk_saja:
        baris += pecah_segmen([("PK", "b"), ("  ", "r")], [[(c, "r")] for c in pk_saja], lebar)
    fk_teks = {}; fk_garis = []
    for r in info["relasi"]:
        induk = model[r["induk"]]["tabel"]
        cols = [info["nm2db"][k] for k in r["kol"]]
        if not bergaris(info["tabel"], induk):
            fk_teks.setdefault(induk, []).extend(cols)
        else:
            fk_garis.append(cols)
    for induk, cols in fk_teks.items():
        akhir = [(" → " + induk, "r")]
        bs = pecah_segmen([("FK", "b"), ("  ", "r")], [[(c, "r")] for c in cols], lebar - lebar_segmen(akhir, UK))
        bs[-1] += akhir
        baris += bs
    fk_lain = []
    for cols in fk_garis:
        fk_lain += [c for c in cols if c not in pk_db]
    if fk_lain:
        baris += pecah_segmen([("FK", "b"), ("  ", "r")], [[(c, "r")] for c in fk_lain], lebar)
    kunci = set(pk_db) | set(kolom_fk)
    atr = []
    for f in info["medan"]:
        if not f["skalar"] or f["db"] in kunci:
            continue
        t = f["db"]
        if t in KOLOM_WAKTU:
            continue
        atr.append([(t, "b" if KOLOM_STATUS.match(t) else "i" if KOLOM_HITUNG.match(t) else "r")])
    if atr:
        baris += pecah_segmen([], atr, lebar)
    return baris


def ukuran_kotak(nama, baris):
    lebar_isi = max([lebar_segmen(b, UK) for b in baris] + [lebar_teks(nama, UK_JUDUL, "b")])
    tinggi = 3.0 + UK_JUDUL * 1.25 + 2.0 + 2.5 + len(baris) * LH + 1.5
    return lebar_isi + 2 * PAD, tinggi


# ----------------------------------------------------------------------------------------------
# Tata letak manual (koordinat poin cetak). Satu konfigurasi per gambar: diagram penuh dan diagram per modul.
#   kolom   : pita atas, kolom dari kiri ke kanan, tiap kolom ditumpuk ke bawah mulai Y0
#   lebar   : lebar kotak per kolom (termasuk bantalan); teks dibungkus sesuai lebar ini
#   gutter  : jarak kolom ke-i ke kolom ke-(i+1)
#   pita    : baris tambahan di bawah pita atas: {"x": x awal atau nama tabel acuan, "di_bawah": [tabel],
#             "jarak": jarak dari dasar tabel acuan, "kolom", "lebar", "gutter"}
#   legenda : {"x", "di_bawah", "jarak", "lebar"} atau None
#   tanpa_garis: pasangan (anak, induk) yang hanya ditulis di kolom walau kedua tabel ada di gambar
# ----------------------------------------------------------------------------------------------
Y0 = 22.0
# aset->kategori_aset dan aset->peralatan hanya bisa naik lewat tepi kiri kanvas: sisi kiri induknya tidak muat
# simbol, dan gutter pertama terpotong simbol konektor lurus dari detail_pembelian. Kolom pertama digeser lajur_kiri
# (kelipatan grid 2,5 pt) supaya tepi kiri punya dua lajur tegak, x=5 dan x=10. Keduanya dirutekan manual oleh
# tepi_kiri() di gambar(), karena perute A* memberi lajur luar ke garis yang dirutekan lebih dulu sehingga bersilangan.
# Nilai: (lajur, celah). Celah = sisi induk tempat garis berbelok ke gutter pertama. Celah antara kategori_aset dan
# peralatan terisi konektor peralatan->kategori_aset, jadi kategori_aset lewat atas dan peralatan lewat bawah.
# Garis yang berbelok lebih tinggi memakai lajur luar dan keluar dari aset lebih bawah, supaya keduanya bersarang.
TEPI_KIRI_KONVERSI = {("aset", "kategori_aset"): ("luar", "atas"), ("aset", "peralatan"): ("dalam", "bawah")}
KOLOM_KONVERSI = [["supplier", "kategori_aset", "peralatan", "perlengkapan", "detail_opname"],
                  ["pembelian", "detail_pembelian", "aset"],
                  ["jadwal_penyusutan", "pelepasan", "opname"]]
# versi_nominal di bawah slip_tunjangan: dua garis slip_gaji -> versi_nominal dan slip_tunjangan -> versi_nominal turun lurus
# di kolom kiri, garis ke golongan, tunjangan, dan jabatan menyeberang satu gutter tanpa memotong simbol lain.
KOLOM_SDM = [["penggajian", "slip_gaji", "slip_tunjangan", "versi_nominal"],
             ["karyawan", "jabatan", "jadwal_kerja", "golongan", "tunjangan"],
             ["presensi", "setting_gaji", "setting_tunjangan"]]
KOLOM_LAPORAN = [["periode", "riwayat_periode", "jurnal", "detail_jurnal", "akun", "investasi_kas"]]
SISTEM = ["pengguna", "sesi", "log_aktivitas", "profil_usaha", "penghitung"]
FEE = ["event", "sesi_event", "penugasan_event", "kehadiran_event", "laporan_fee", "slip_fee"]

KONFIG = {
    "logical-database": {
        "judul": "semua tabel",
        "lebar_kanvas": 785.0,
        "kolom": KOLOM_KONVERSI + KOLOM_LAPORAN + KOLOM_SDM,
        "lebar": [80, 96, 90, 91, 90, 84, 89],
        "gutter": [22, 24, 38, 26, 19, 22],
        "lajur_kiri": 5.0, "tepi_kiri": TEPI_KIRI_KONVERSI,
        "pita": [
            {"x": "periode", "di_bawah": ["investasi_kas", "slip_tunjangan", "versi_nominal", "setting_tunjangan"], "jarak": 22,
             "kolom": [["penugasan_event", "kehadiran_event"], ["event", "sesi_event"], ["laporan_fee"], ["slip_fee"]],
             "lebar": [96, 90, 98, 98], "gutter": [14, 16, 14]},
            {"x": 7.0, "di_bawah": ["aset", "detail_opname"], "jarak": 22,
             "kolom": [["pengguna"], ["sesi"], ["log_aktivitas"]], "lebar": [92, 92, 92], "gutter": [10, 10]},
            {"x": 7.0, "di_bawah": ["pengguna", "sesi", "log_aktivitas"], "jarak": 9,
             "kolom": [["profil_usaha"], ["penghitung"]], "lebar": [70, 60], "gutter": [10]},
        ],
        # Di diagram penuh, FK fee event ke karyawan dan jabatan ditulis di kolom supaya garis tidak menyeberangi
        # siklus SDM, begitu juga slip_fee -> event yang akan memotong garis laporan_fee -> jurnal. Garisnya
        # digambar di diagram modul fee event. pengguna -> karyawan hanya ditulis di kolom (seperti FK ke pengguna).
        "tanpa_garis": {("penugasan_event", "karyawan"), ("penugasan_event", "jabatan"), ("kehadiran_event", "karyawan"),
                        ("slip_fee", "karyawan"), ("slip_fee", "jabatan"), ("slip_fee", "event"), ("pengguna", "karyawan"),
                        ("slip_fee", "versi_nominal")},
        "legenda": {"x": 7.0, "di_bawah": ["profil_usaha", "penghitung", "kehadiran_event", "slip_fee", "sesi_event"], "jarak": 10, "lebar": 771},
    },
    "logical-database-konversi": {
        "judul": "siklus konversi",
        "kolom": KOLOM_KONVERSI, "lebar": [80, 96, 90], "gutter": [22, 24],
        "lajur_kiri": 5.0, "tepi_kiri": TEPI_KIRI_KONVERSI,
    },
    "logical-database-sdm": {
        "judul": "siklus SDM gaji inhouse",
        "kolom": KOLOM_SDM, "lebar": [90, 84, 89], "gutter": [19, 22],
    },
    "logical-database-fee-event": {
        "judul": "siklus SDM fee event",
        # penugasan_event dan slip_fee sama-sama merujuk ke karyawan dan jabatan, jadi kedua induk itu ditaruh di
        # kolom tengah supaya keempat garisnya tidak bersilangan. pengguna ikut supaya relasi akun Kapten ke karyawan
        # (pengguna.id_karyawan, 0..1) tergambar.
        # versi_nominal (tarif berversi) di bawah pengguna supaya garis slip_fee -> versi_nominal tergambar di diagram ini.
        "kolom": [["sesi_event", "kehadiran_event"], ["event", "penugasan_event"], ["jabatan", "karyawan", "pengguna", "versi_nominal"], ["laporan_fee", "slip_fee"]],
        "lebar": [100, 96, 100, 104], "gutter": [24, 26, 26], "grup_bersarang": True,
    },
    "logical-database-pelaporan": {
        "judul": "pelaporan dan sistem",
        "kolom": KOLOM_LAPORAN + [["pengguna", "sesi"], ["log_aktivitas", "profil_usaha", "penghitung"]],
        "lebar": [91, 92, 92], "gutter": [40, 16],
    },
}
CFG = KONFIG["logical-database"]


def pakai(nama, t2i):
    """Aktifkan konfigurasi gambar `nama` dan catat tabel yang digambar."""
    global CFG
    CFG = KONFIG[nama]
    CFG.setdefault("lajur_kiri", 0.0); CFG.setdefault("tepi_kiri", {}); CFG.setdefault("pita", []); CFG.setdefault("legenda", None)
    CFG["tabel"] = {t for k in CFG["kolom"] for t in k} | {t for p_ in CFG["pita"] for k in p_["kolom"] for t in k}
    assert CFG["tabel"] <= set(t2i), CFG["tabel"] - set(t2i)


def terhubung(model, a, b):
    for info in model.values():
        for r in info["relasi"]:
            if {info["tabel"], model[r["induk"]]["tabel"]} == {a, b}:
                return True
    return False


def hitung_posisi(model, t2i):
    isi, uk, pos = {}, {}, {}
    def tumpuk(kolom, lebar_kol, gutter, x, y0):
        for k, tabs in enumerate(kolom):
            for t in tabs:
                isi[t] = isi_kotak(t2i[t], model, lebar_kol[k] - 2 * PAD)
                uk[t] = ukuran_kotak(t, isi[t])
            lebar = max(uk[t][0] for t in tabs)
            y = y0
            for n, t in enumerate(tabs):
                pos[t] = [x, y, lebar, uk[t][1]]   # semua kotak sekolom selebar kolom
                if n + 1 < len(tabs) and GRUP_TABEL[t] != GRUP_TABEL[tabs[n + 1]]:
                    sel = 26   # beda grup: ruang untuk tepi kotak grup dan judul grup berikutnya
                elif n + 1 < len(tabs) and terhubung(model, t, tabs[n + 1]):
                    sel = CFG.get("gap_hubung", 17)
                else:
                    sel = CFG.get("gap", 9)
                y += uk[t][1] + sel
            x += lebar + (gutter[k] if k < len(gutter) else 0)
        return x
    x = tumpuk(CFG["kolom"], CFG["lebar"], CFG["gutter"], 7.0 + CFG["lajur_kiri"], Y0)
    print(f"pita atas selebar {x:.0f}")
    for p_ in CFG["pita"]:
        y = max(pos[t][1] + pos[t][3] for t in p_["di_bawah"]) + p_["jarak"]
        x0 = pos[p_["x"]][0] if isinstance(p_["x"], str) else p_["x"]
        xa = tumpuk(p_["kolom"], p_["lebar"], p_["gutter"], x0, y)
        print(f"pita {p_['kolom'][0][0]}: x {x0:.0f} sampai {xa:.0f}, y {y:.0f}")
    lg = CFG["legenda"]
    if lg:
        lg["pos"] = (lg["x"], max(pos[t][1] + pos[t][3] for t in lg["di_bawah"]) + lg["jarak"])
    return isi, uk, pos


def ukuran_kanvas(pos, grp):
    kanan = max([x + w for x, y, w, h in pos.values()] + [x + w for x, y, w, h in grp.values()])
    bawah = max([y + h for x, y, w, h in pos.values()] + [y + h for x, y, w, h in grp.values()])
    lg = CFG["legenda"]
    if lg:
        kanan = max(kanan, lg["pos"][0] + lg["lebar"]); bawah = max(bawah, lg["pos"][1] + TINGGI_LEGENDA)
    return max(CFG.get("lebar_kanvas", 0.0), kanan + 5), bawah + 5


def _potong(k, p0, p1):
    """True bila segmen tegak/datar p0-p1 memotong persegi k=(x,y,w,h)."""
    x0, x1 = sorted((p0[0], p1[0])); y0, y1 = sorted((p0[1], p1[1]))
    return not (x1 < k[0] or x0 > k[0] + k[2] or y1 < k[1] or y0 > k[1] + k[3])


def simbol(svg, titik, arah, jenis, warna="#333"):
    """titik = tepi kotak, arah = vektor satuan menjauhi kotak. jenis: satu, nol_satu, nol_banyak."""
    ex, ey = titik; ux, uy = arah; vx, vy = -uy, ux
    P = lambda d, s=0.0: (ex + ux * d + vx * s, ey + uy * d + vy * s)
    if jenis == "satu":
        for d in (2.6, 5.0):
            svg.garis([P(d, -2.8), P(d, 2.8)], warna, 0.7)
    elif jenis == "nol_satu":
        svg.garis([P(2.6, -2.8), P(2.6, 2.8)], warna, 0.7)
        svg.circle(*P(6.3), 1.8, "#FFFFFF", warna, 0.7)
    elif jenis == "satu_banyak":
        for sgn in (-3.2, 0, 3.2):
            svg.garis([P(0, sgn), P(5.0, 0)], warna, 0.7)
        svg.garis([P(7.0, -2.8), P(7.0, 2.8)], warna, 0.7)
    elif jenis == "nol_banyak":
        for sgn in (-3.2, 0, 3.2):
            svg.garis([P(0, sgn), P(5.0, 0)], warna, 0.7)
        svg.circle(*P(7.2), 1.8, "#FFFFFF", warna, 0.7)


def arah_sisi(sisi):
    return {"L": (-1, 0), "R": (1, 0), "T": (0, -1), "B": (0, 1)}[sisi]


def gambar(model, t2i, path_svg, path_png):
    isi, uk, pos = hitung_posisi(model, t2i)
    # kelompok (hanya tabel yang ada di gambar ini)
    grp = {}
    for kode, judul, warna, tabs in KELOMPOK:
        tabs = [t for t in tabs if t in pos]
        if not tabs:
            continue
        # grup yang memuat kolom pertama melebar lajur_kiri ke kiri supaya lajur garis di tepi kiri tetap di dalamnya
        x0 = min(pos[t][0] for t in tabs) - 5 - (CFG["lajur_kiri"] if set(tabs) & set(CFG["kolom"][0]) else 0)
        y0 = min(pos[t][1] for t in tabs) - 13
        x1 = max(pos[t][0] + pos[t][2] for t in tabs) + 5; y1 = max(pos[t][1] + pos[t][3] for t in tabs) + 5
        if x1 - x0 < lebar_teks(judul, 8.4, "b") + 10:
            raise SystemExit(f"judul grup {judul!r} lebih lebar dari kotaknya; perlebar kolom atau pindahkan tabel")
        grp[kode] = (x0, y0, x1 - x0, y1 - y0)
    for k1, g1 in grp.items():
        for k2, g2 in grp.items():
            if k1 < k2 and not CFG.get("grup_bersarang") and g1[0] < g2[0] + g2[2] and g2[0] < g1[0] + g1[2] and g1[1] < g2[1] + g2[3] and g2[1] < g1[1] + g1[3]:
                raise SystemExit(f"kotak grup {k1} dan {k2} bertumpuk")
    W, H = ukuran_kanvas(pos, grp)
    svg = Svg(W, H)
    # kotak grup besar digambar lebih dulu, jadi grup yang bersarang di dalamnya tetap terlihat
    for kode, judul, warna, _ in sorted(KELOMPOK, key=lambda k_: -(grp[k_[0]][2] * grp[k_[0]][3]) if k_[0] in grp else 0):
        if kode in grp:
            x0, y0, w0, h0 = grp[kode]
            svg.rect(x0, y0, w0, h0, warna, "#9a9a9a", 0.6, 4)
            svg.teks(x0 + 5, y0 + 9.2, [(judul, "b")], 8.4, "#333")
    # perute
    rt = Perute(W, H, 2.5)
    for t, (x, y, w, h) in pos.items():
        rt.blok_rect(x, y, w, h, margin=0.0)
        rt.tandai_dekat(x, y, w, h)
    for kode, (x, y, w, h) in grp.items():
        rt.blok_rect(x + 3, y + 1, lebar_teks(next(j for k, j, _, _ in KELOMPOK if k == kode), 8.4, "b") + 4, 11)
    def langsung(a, b):
        pa, pb = pos[a], pos[b]
        # tegak: berhimpit secara horizontal
        for (u, v, ax, ay, aw, ah, bx, by, bw, bh, tegak) in (
            (a, b, pa[0], pa[1], pa[2], pa[3], pb[0], pb[1], pb[2], pb[3], True),
            (a, b, pa[1], pa[0], pa[3], pa[2], pb[1], pb[0], pb[3], pb[2], False)):
            lo = max(ax, bx); hi = min(ax + aw, bx + bw)
            if hi - lo < 12:
                continue
            if by >= ay + ah:
                g0, g1, a_dulu = ay + ah, by, True
            elif ay >= by + bh:
                g0, g1, a_dulu = by + bh, ay, False
            else:
                continue
            if not (12 <= g1 - g0 <= 24):
                continue
            for k in range(0, int(hi - lo) // 6):
                c = lo + 6 + k * 6
                if c > hi - 6:
                    break
                if tegak:
                    box = (c - 2, g0, 4, g1 - g0)
                    p0, p1 = (c, g0), (c, g1)
                else:
                    box = (g0, c - 2, g1 - g0, 4)
                    p0, p1 = (g0, c), (g1, c)
                if any(t not in (a, b) and not (box[0] + box[2] < q[0] or box[0] > q[0] + q[2] or box[1] + box[3] < q[1] or box[1] > q[1] + q[3]) for t, q in pos.items()):
                    continue
                if rt._ujung_dekat(p0) or rt._ujung_dekat(p1):
                    continue
                rt.ujung.extend([p0, p1])
                if tegak:
                    sa, sb = ("B", "T") if a_dulu else ("T", "B")
                    pts = [p0, p1] if a_dulu else [p1, p0]
                else:
                    sa, sb = ("R", "L") if a_dulu else ("L", "R")
                    pts = [p0, p1] if a_dulu else [p1, p0]
                return pts, sa, sb
        return None
    def tepi_kiri(a, b):
        """Rute manual relasi TEPI_KIRI (anak a di kolom kedua, induk b di kolom pertama): keluar dari sisi kiri a di
        bawah dasar kolom pertama, naik di lajur tepi kiri, berbelok ke kanan lewat celah di atas atau di bawah b,
        lalu dari tengah gutter pertama masuk ke sisi kanan b. Semua titik dihitung dari posisi kotak, dibulatkan ke grid."""
        lajur, celah = CFG["tepi_kiri"][(a, b)]
        g = rt.g
        grid = lambda v: round(v / g) * g
        kol0 = CFG["kolom"][0]
        xa, ya, wa, ha = pos[a]; xb, yb, wb, hb = pos[b]
        # lajur dalam 2 pt dari kotak kolom pertama, lajur luar LAJUR_KIRI di sebelah kirinya
        x_lajur = grid(pos[kol0[0]][0] - 2.0) - (CFG["lajur_kiri"] if lajur == "luar" else 0.0)
        # keluar dari a minimal 5 pt di bawah dasar kolom pertama; lajur luar 10 pt lebih bawah supaya kaki gagak
        # kedua garis di sisi kiri a tidak bertumpuk
        y_dasar = max(pos[t][1] + pos[t][3] for t in kol0)
        y_keluar = math.ceil((y_dasar + 5.0) / g) * g + (10.0 if lajur == "luar" else 0.0)
        if not ya + 4 <= y_keluar <= ya + ha - 4:
            raise RuntimeError(f"port {y_keluar:.1f} di luar sisi kiri {a} untuk rute tepi kiri")
        # berbelok di tengah celah antara b dan tetangganya, masuk ke sisi kanan b dekat sudut di sisi celah itu
        n = kol0.index(b) + (-1 if celah == "atas" else 1)
        if not 0 <= n < len(kol0):
            raise RuntimeError(f"{b} tidak punya tetangga di sisi {celah} untuk rute tepi kiri")
        xt, yt, wt, ht = pos[kol0[n]]
        if celah == "atas":
            y_celah, y_masuk = grid((yt + ht + yb) / 2), grid(yb + 4)
        else:
            y_celah, y_masuk = grid((yb + hb + yt) / 2), grid(yb + hb - 4)
        x_gutter = grid((xb + wb + pos[CFG["kolom"][1][0]][0]) / 2)
        pts = [(xa, y_keluar), (x_lajur, y_keluar), (x_lajur, y_celah), (x_gutter, y_celah), (x_gutter, y_masuk), (xb + wb, y_masuk)]
        rt.tandai_polyline(pts); rt.ujung.extend([pts[0], pts[-1]])
        return pts, "L", "R"
    garis = []
    for info in model.values():
        for r in info["relasi"]:
            induk = model[r["induk"]]["tabel"]
            if not bergaris(info["tabel"], induk):
                continue
            garis.append((info["tabel"], induk, r))
    def jarak(g):
        a, b = pos[g[0]], pos[g[1]]
        return abs(a[0] - b[0]) + abs(a[1] - b[1])
    ganda = {}
    for a, b, r in garis:
        ganda[(a, b)] = ganda.get((a, b), 0) + 1
    hasil = []
    for a, b, r in sorted(garis, key=jarak):
        if a == b:
            x0, y0, w0, h0 = pos[a]
            xr = x0 + w0; y1 = y0 + h0 - 44; y2 = y1 + 15
            pts = [(xr, y1), (xr + 15, y1), (xr + 15, y2), (xr, y2)]
            rt.ujung.extend([pts[0], pts[-1]]); rt.tandai_polyline(pts)
            rt.daftarkan_simbol(pts[0], (1, 0)); rt.daftarkan_simbol(pts[-1], (1, 0))
            hasil.append((a, b, r, pts, "R", "R"))
            continue
        try:
            d = tepi_kiri(a, b) if (a, b) in CFG["tepi_kiri"] else langsung(a, b)
            pts, sisi_a, sisi_b = d if d else rt.rute(tuple(pos[a]), tuple(pos[b]), tangkai=10.0)
        except RuntimeError as e:
            print("GAGAL rute", a, b, e); continue
        rt.daftarkan_simbol(pts[0], arah_sisi(sisi_a)); rt.daftarkan_simbol(pts[-1], arah_sisi(sisi_b))
        hasil.append((a, b, r, pts, sisi_a, sisi_b))
    warna_grup = {"konv": "#9C2F25", "sdm": "#1B5E94", "fee": "#5B3F8C", "lap": "#6B5B00", "sis": "#2F6B2A"}
    grup_tabel = {t: kode for kode, _, _, tabs in KELOMPOK for t in tabs}
    wr = lambda a: warna_grup[grup_tabel[a]]
    for a, b, r, pts, sa, sb in hasil:
        svg.garis(pts, wr(a), 0.7)
    # kotak
    for t, (x, y, w, h) in pos.items():
        svg.rect(x, y, w, h, "#FFFFFF", "#555", 0.7, 2)
        hh = 3.0 + UK_JUDUL * 1.25 + 2.0
        svg.rect(x + 0.35, y + 0.35, w - 0.7, hh - 0.35, "#ECECEC")
        svg.garis([(x, y + hh), (x + w, y + hh)], "#555", 0.6)
        svg.teks(x + w / 2, y + 3.0 + UK_JUDUL, [(t, "b")], UK_JUDUL, "#111", "middle")
        yy = y + hh + 2.5 + UK
        for b in isi[t]:
            svg.teks(x + PAD, yy, b, UK)
            yy += LH
    # simbol kardinalitas dan label
    for a, b, r, pts, sa, sb in hasil:
        anak = "nol_satu" if r["unik"] else "satu_banyak" if (a, b) in SATU_BANYAK else "nol_banyak"
        simbol(svg, pts[0], arah_sisi(sa), anak, wr(a))
        simbol(svg, pts[-1], arah_sisi(sb), "satu" if r["wajib"] else "nol_satu", wr(a))
        if ganda[(a, b)] > 1 or a == b:
            label = ", ".join(t2i[a]["nm2db"][k] for k in r["kol"])
            lw = lebar_teks(label, UK, "i")
            cocok = None
            for p0, p1 in sorted(zip(pts, pts[1:]), key=lambda s_: -(abs(s_[0][0] - s_[1][0]) + abs(s_[0][1] - s_[1][1]))):
                mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
                panjang = abs(p0[0] - p1[0]) + abs(p0[1] - p1[1])
                if abs(p0[0] - p1[0]) < 0.01 and panjang >= lw + 4:      # tegak: teks diputar
                    kotak = (mx - UK - 1.5, my - lw / 2, UK + 1.5, lw)
                    mode = "v"
                elif abs(p0[1] - p1[1]) < 0.01 and panjang >= lw + 4:     # datar
                    kotak = (mx - lw / 2, my - UK - 1.5, lw, UK + 1.5)
                    mode = "h"
                else:
                    continue
                if any(not (kotak[0] + kotak[2] < q[0] or kotak[0] > q[0] + q[2] or kotak[1] + kotak[3] < q[1] or kotak[1] > q[1] + q[3]) for q in pos.values()):
                    continue
                cocok = (mode, mx, my); break
            if cocok is None:
                # cari tempat kosong terdekat di sekitar titik tengah segmen terpanjang
                p0, p1 = max(zip(pts, pts[1:]), key=lambda s_: abs(s_[0][0] - s_[1][0]) + abs(s_[0][1] - s_[1][1]))
                cx, cy = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
                kandidat = sorted(((dx, dy) for dx in range(-80, 81, 4) for dy in range(-40, 41, 3)), key=lambda d: d[0] ** 2 + d[1] ** 2)
                for (dx, dy), mode_ in [(d_, m_) for d_ in kandidat for m_ in ("v", "h")]:
                    kotak = (cx + dx - lw / 2, cy + dy - UK, lw, UK + 1.5) if mode_ == "h" else (cx + dx - UK, cy + dy - lw / 2, UK + 1.5, lw)
                    if kotak[0] < 2 or kotak[0] + kotak[2] > W - 2 or kotak[1] < 2 or kotak[1] + kotak[3] > H - 2:
                        continue
                    if any(not (kotak[0] + kotak[2] + 1 < q[0] or kotak[0] - 1 > q[0] + q[2] or kotak[1] + kotak[3] < q[1] or kotak[1] > q[1] + q[3]) for q in pos.values()):
                        continue
                    if any(_potong((kotak[0] - 2.5, kotak[1] - 2.5, kotak[2] + 5, kotak[3] + 5), s0, s1) for _, _, _, pp, _, _ in hasil for s0, s1 in zip(pp, pp[1:])):
                        continue
                    if any(not (kotak[0] + kotak[2] < gx or kotak[0] > gx + gw or kotak[1] + kotak[3] < gy or kotak[1] > gy + 12) for (gx, gy, gw, gh) in grp.values()):
                        continue
                    cocok = ("h0" if mode_ == "h" else "v0", cx + dx, cy + dy); break
            if cocok is None:
                print("label tidak muat:", label); continue
            if cocok[0] == "h0":
                svg.teks(cocok[1], cocok[2], [(label, "i")], UK, wr(a), "middle")
                continue
            if cocok[0] == "v0":
                svg.teks(cocok[1] + UK / 2 - 1, cocok[2] + lw / 2, [(label, "i")], UK, wr(a), "start", putar=-90)
                continue
            mode, mx, my = cocok
            if mode == "v":
                svg.rect(mx - UK - 0.6, my - lw / 2 - 1, UK + 1.2, lw + 2, "#FFFFFF")
                svg.teks(mx - 1.2, my + lw / 2, [(label, "i")], UK, wr(a), "start", putar=-90)
            else:
                svg.rect(mx - lw / 2 - 1, my - UK - 0.6, lw + 2, UK + 1.2, "#FFFFFF")
                svg.teks(mx, my - 1.2, [(label, "i")], UK, wr(a), "middle")
    if CFG["legenda"]:
        legenda(svg)
    svg.simpan(path_svg, path_png)
    return pos, grp, hasil, (W, H)


TINGGI_LEGENDA = 3 * LH + 12


def legenda(svg):
    """Keterangan mendatar di dasar gambar: tiga baris teks di kiri, contoh simbol kardinalitas di kanan."""
    x, y = CFG["legenda"]["pos"]
    lebar_box = CFG["legenda"]["lebar"]
    svg.rect(x, y, lebar_box, TINGGI_LEGENDA, "#FFFFFF", "#9a9a9a", 0.6, 3)
    baris = [
        [("Keterangan.", "b"), ("  ", "r"), ("PK", "b"), (" kunci utama, ", "r"), ("FK", "b"), (" kunci tamu. Garis menghubungkan FK ke tabel induknya. FK ke ", "r"), ("pengguna", "b"), (" dan ", "r"),
         ("akun", "b"), (", juga sebagian FK", "r")],
        [("fee event, hanya ditulis di kolom (\u2192 nama tabel) tanpa garis. Garis relasi fee event lengkap ada di gambar per modul. ", "r"), ("status", "b"), (" tebal: status persetujuan dan aktif.", "r")],
        [("miring", "i"), (": atribut perhitungan (penyusutan, gaji, fee). Kolom stempel waktu audit (dibuat_pada, diubah_pada, diajukan_pada, dst.) tidak digambar.", "r")],
    ]
    yy = y + 6 + UK
    for b in baris:
        svg.teks(x + 5, yy, b, UK); yy += LH
    lebar_teks_maks = max(lebar_segmen(b, UK) for b in baris)
    # contoh simbol kardinalitas: dua kolom, dua baris
    contoh = [("satu", "tepat satu (1)"), ("nol_satu", "nol atau satu (0..1)"), ("nol_banyak", "nol atau banyak (0..N)"), ("satu_banyak", "satu atau banyak (1..N)")]
    lebar_kol = max(lebar_teks(k, UK) for _, k in contoh) + 21 + 10
    x0 = x + lebar_box - 2 * lebar_kol - 4
    assert x0 > x + 5 + lebar_teks_maks + 8, ("legenda bertumpuk", x0, x + 5 + lebar_teks_maks)
    for n, (jenis, ket) in enumerate(contoh):
        xs = x0 + (n % 2) * lebar_kol; ys = y + 9 + (n // 2) * 11
        svg.garis([(xs, ys), (xs + 16, ys)], "#444", 0.7)
        simbol(svg, (xs + 16, ys), (-1, 0), jenis, "#444")
        svg.teks(xs + 21, ys + 2.3, ket, UK)


def periksa_simbol(hasil, pos):
    """Periksa geometri: tidak ada garis yang melewati simbol kardinalitas garis lain, dan tidak ada garis yang
    menembus kotak tabel selain di ujungnya. Mengembalikan daftar pelanggaran (teks)."""
    masalah = []
    zona = []
    for n, (a, b, r, pts, sa, sb) in enumerate(hasil):
        for ttk, sisi in ((pts[0], sa), (pts[-1], sb)):
            ux, uy = arah_sisi(sisi)
            x0, x1 = sorted((ttk[0], ttk[0] + ux * 10.5)) if ux else (ttk[0] - 4.0, ttk[0] + 4.0)
            y0, y1 = sorted((ttk[1], ttk[1] + uy * 10.5)) if uy else (ttk[1] - 4.0, ttk[1] + 4.0)
            zona.append((n, a, b, ttk, (x0, y0, x1, y1)))
    for n, (a, b, r, pts, sa, sb) in enumerate(hasil):
        for p0, p1 in zip(pts, pts[1:]):
            sx0, sx1 = sorted((p0[0], p1[0])); sy0, sy1 = sorted((p0[1], p1[1]))
            for n2, a2, b2, ttk, (x0, y0, x1, y1) in zona:
                if n2 == n:
                    continue
                if not (sx1 < x0 or sx0 > x1 or sy1 < y0 or sy0 > y1):
                    masalah.append(f"garis {a}->{b} melewati simbol {a2}->{b2} di {ttk[0]:.0f},{ttk[1]:.0f}")
        for t, (x, y, w, h) in pos.items():
            for p0, p1 in zip(pts, pts[1:]):
                sx0, sx1 = sorted((p0[0], p1[0])); sy0, sy1 = sorted((p0[1], p1[1]))
                if sx1 > x + 0.8 and sx0 < x + w - 0.8 and sy1 > y + 0.8 and sy0 < y + h - 0.8:
                    masalah.append(f"garis {a}->{b} menembus kotak {t}")
    return masalah


def tulis_mermaid(model, path):
    """Versi teks portabel (Mermaid erDiagram): semua tabel, semua kolom, dan semua relasi FK tanpa pengecualian."""
    tipe = {"String": "string", "Int": "int", "Boolean": "boolean", "DateTime": "datetime", "Float": "float"}
    o = ["%% DIBANGKITKAN dari prisma/schema.prisma oleh docs/alat/buat_logical_database.py. Jangan diubah manual.", "erDiagram"]
    for info in sorted(model.values(), key=lambda i: i["tabel"]):
        pk = {info["nm2db"][k] for k in info["pk"]}
        fk = {info["nm2db"][k] for r in info["relasi"] for k in r["kol"]}
        o.append(f"  {info['tabel']} {{")
        for f in info["medan"]:
            if not f["skalar"]:
                continue
            tanda = ", ".join(x for x, ada in (("PK", f["db"] in pk), ("FK", f["db"] in fk)) if ada)
            o.append(f"    {tipe.get(f['tp'], 'string')} {f['db']} {tanda}".rstrip())
        o.append("  }")
    for info in sorted(model.values(), key=lambda i: i["tabel"]):
        for r in info["relasi"]:
            kiri = "||" if r["wajib"] else "|o"
            kanan = "o|" if r["unik"] else "|{" if (info["tabel"], model[r["induk"]]["tabel"]) in SATU_BANYAK else "o{"
            o.append(f"  {model[r['induk']]['tabel']} {kiri}--{kanan} {info['tabel']} : \"{', '.join(info['nm2db'][k] for k in r['kol'])}\"")
    open(path, "w", encoding="utf-8").write("\n".join(o) + "\n")


if __name__ == "__main__":
    model = baca_skema(SKEMA)
    t2i = {m["tabel"]: m for m in model.values()}
    ada = {t for _, _, _, ts in KELOMPOK for t in ts}
    assert ada == set(t2i), f"tabel di luar kelompok: {ada ^ set(t2i)}"
    ok = cek_db(t2i) if "--cek-db" in sys.argv else True
    # setiap relasi FK harus tergambar sebagai garis di minimal satu gambar (penuh atau per modul)
    tergambar = set()
    for nama in KONFIG:
        pakai(nama, t2i)
        print(f"== {nama}")
        pos, grp, hasil, (W, H) = gambar(model, t2i, os.path.join(KELUAR, nama + ".svg"), os.path.join(KELUAR, nama + ".png"))
        masalah = periksa_simbol(hasil, pos)
        for m in masalah:
            print("PERIKSA:", m)
        ok = ok and not masalah
        tergambar |= {(a, b, tuple(r["kol"])) for a, b, r, *_ in hasil}
        panjang = sum(abs(p[0] - q[0]) + abs(p[1] - q[1]) for *_, pts, _, _ in hasil for p, q in zip(pts, pts[1:]))
        print(f"{len(pos)} tabel; {len(hasil)} garis; panjang garis {panjang:.0f} pt; kanvas {W:.0f}x{H:.0f} pt")
    tulis_mermaid(model, os.path.join(KELUAR, "logical-database.mmd"))
    belum = [(i["tabel"], model[r["induk"]]["tabel"]) for i in model.values() for r in i["relasi"]
             if (i["tabel"], model[r["induk"]]["tabel"], tuple(r["kol"])) not in tergambar
             and model[r["induk"]]["tabel"] not in TANPA_GARIS]
    print("relasi tanpa garis di semua gambar (selain ke pengguna dan akun):", belum or "tidak ada")
    print("OK" if ok else "ADA MASALAH")
