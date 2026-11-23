#!/usr/bin/env python3
"""Membangkitkan docs/use-case.{svg,png}. Aktor dan izin dibaca dari src/lib/peran.ts (IZIN).

Pemakaian (dari akar repo):
    python3 docs/alat/buat_use_case.py           # gambar memakai tata letak tersimpan di TATA_LETAK
    python3 docs/alat/buat_use_case.py --cari    # cari tata letak baru (anil simulasi), cetak TATA_LETAK, lalu gambar

Tiap use case menyebut kunci IZIN yang mendasarinya. Skrip berhenti bila aktor di daftar ini berbeda
dengan IZIN di peran.ts, jadi diagram tidak bisa menyimpang diam-diam dari aturan akses.
Kanvas = ukuran cetak (poin) di laporan: huruf di sini = huruf tercetak.
"""
import math, os, random, re, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from svgkit import Svg, lebar_teks, lebar_segmen

AKAR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
W, H = 785.0, 504.0
UK = 7.6            # huruf use case (pt cetak)
UK_AKTOR = 8.6
RX, RY = 52.0, 12.5  # elips seragam
KOLOM, BARIS = 5, 7
X0, Y0, X1, Y1 = 64.0, 52.0, 721.0, 444.0   # kotak batas sistem

# kunci: (label, kunci IZIN atau None, aktor). Aktor: A Admin, H HRD, O Owner, K Kapten, P Pengguna (peran staf).
UC = {
    "masuk":   ("Masuk ke aplikasi\ndengan akun per peran", None, "PK"),
    "dash":    ("Lihat dashboard", None, "PK"),
    "lap":     ("Lihat jurnal, buku besar,\nneraca saldo (dua tahap)", None, "P"),
    "kartu":   ("Lihat kartu aset", None, "P"),
    "cetak":   ("Cetak laporan", None, "P"),
    "cetakslip": ("Cetak slip gaji\ndan slip fee", None, "P"),
    "draf":    ("Kelola draf pembelian\nperalatan, perlengkapan", "pembelian.kelola-draf", "A"),
    "cepat":   ("Tambah supplier atau\nbarang dari form", "master-konversi.tambah-cepat", "A"),
    "posting": ("Posting pembelian", "pembelian.posting", "AO"),
    "aset":    ("Buat kartu aset dan\njadwal penyusutan", None, ""),
    "balik":   ("Balik pembelian\n(jurnal pembalik)", "pembelian.balik", "O"),
    "sisa":    ("Input nilai sisa\nperlengkapan", "nilai-sisa.input", "A"),
    "susut":   ("Proses penyusutan\nbulanan", "penyusutan.proses", "A"),
    "drafjp":  ("Buat draf jurnal\npenyesuaian", None, ""),
    "ajujp":   ("Ajukan jurnal\npenyesuaian", "jurnal-penyesuaian.ajukan", "A"),
    "ajulepas": ("Ajukan pelepasan\nperalatan", "pelepasan.ajukan", "A"),
    "setlepas": ("Setujui atau tolak\npelepasan peralatan", "pelepasan.putuskan", "O"),
    "setjp":   ("Setujui atau tolak\njurnal penyesuaian", "jurnal-penyesuaian.putuskan", "O"),
    "mkonv":   ("Kelola master supplier,\nperalatan, perlengkapan", "master-konversi.ubah", "AO"),
    "presensi": ("Input presensi harian", "presensi.kelola", "H"),
    "gaji":    ("Hitung gaji dan PPh 21\n(slip draf)", "gaji.hitung", "H"),
    "dist":    ("Ajukan distribusi\ngaji", "penggajian.ajukan", "H"),
    "setgaji": ("Setujui atau tolak\npenggajian", "penggajian.putuskan", "O"),
    "msdm":    ("Kelola master SDM", "master-sdm.ubah", "HO"),
    "kunci":   ("Tutup periode (mengunci\nperiode) dan buka kunci", "periode.kunci", "O"),
    "katakun": ("Kelola akun, kategori,\nprofil, status master", "master.akun-kategori+master.nonaktifkan+profil.ubah", "O"),
    "pengguna": ("Kelola pengguna", "pengguna.kelola", "O"),
    "event":   ("Catat event, sesi,\npenugasan, kehadiran", "event.kelola", "HO"),
    "nilai":   ("Nilai progres kehadiran\n(Sesuai atau Kurang)", "event.nilai", "KO"),
    "kurang":  ("Isi jam diakui\ndan catatan", None, ""),
    "lapor":   ("Kirim laporan progres\nke Owner", "event.lapor", "K"),
    "putfee":  ("Tentukan fee akhir, setujui\natau tolak laporan", "fee-event.putuskan", "O"),
    "slipfee": ("Buat slip fee dan\njurnal fee event", None, ""),
    "tarif":   ("Atur tarif jabatan\nevent", "tarif-event.ubah", "O"),
}
# Relasi antar use case: (dari, ke, jenis, catatan). Panah dari use case yang menyertai/memperluas.
REL = [
    ("susut", "drafjp", "include", ""),
    ("drafjp", "sisa", "extend", "[biaya > 0]"),
    ("cepat", "draf", "extend", "[master belum ada]"),
    ("aset", "posting", "extend", "[pembelian\nperalatan]"),
    ("cetak", "lap", "extend", ""),
    ("kurang", "nilai", "extend", "[hasil Kurang]"),
    ("slipfee", "putfee", "extend", "[laporan\ndisetujui]"),
]
NAMA_AKTOR = {"A": "Admin", "H": "HRD", "O": "Owner", "K": "Kapten"}
WARNA_AKTOR = {"A": "#8B1A1A", "H": "#1F5F99", "O": "#2E6B3A", "K": "#5B3F8C", "P": "#555555"}
WARNA_UC = {  # per siklus
    "masuk": "#EEEEEE", "dash": "#EEEEEE", "lap": "#EEEEEE", "kartu": "#EEEEEE",
}
SIKLUS = {"k": "#FDE7E4", "s": "#E3EFFA", "e": "#ECE4F6", "l": "#FFF3C4", "p": "#EEEEEE"}
GRUP = {"masuk": "p", "dash": "p", "lap": "l", "kartu": "k", "cetak": "l", "cetakslip": "s",
        "draf": "k", "cepat": "k", "posting": "k", "aset": "k", "balik": "k", "sisa": "k", "susut": "k", "drafjp": "l", "ajujp": "l",
        "ajulepas": "k", "setlepas": "k", "setjp": "l", "mkonv": "k", "presensi": "s", "gaji": "s", "dist": "s", "setgaji": "s", "msdm": "s",
        "kunci": "l", "katakun": "l", "pengguna": "l",
        "event": "e", "nilai": "e", "kurang": "e", "lapor": "e", "putfee": "e", "slipfee": "e", "tarif": "e"}

# Tata letak hasil pencarian: kunci -> (kolom, baris); aktor -> (sisi, posisi 0..1 sepanjang sisi).
# Hasil --cari (SEED=29 AWAL=kisi T0=3 SIG0=25 LANGKAH=250000), lalu 'sisa' digeser 16 pt ke kiri supaya label extend-nya muat.
TATA_LETAK = {'kartu': (520.9, 88.2), 'susut': (251.8, 125.6), 'setlepas': (292.4, 303.8), 'ajulepas': (125.4, 123.6), 'setjp': (511.4, 337.4), 'dist': (181.1, 423.1), 'sisa': (208.7, 160.8), 'kunci': (655.9, 191.7), 'lap': (279.3, 90.0), 'putfee': (656.2, 94.0), 'katakun': (500.4, 384.5), 'balik': (448.3, 163.8), 'ajujp': (146.9, 221.8), 'cepat': (124.1, 260.7), 'lapor': (636.0, 420.1), 'cetak': (137.5, 88.0), 'setgaji': (533.0, 238.7), 'presensi': (627.9, 383.0), 'tarif': (301.3, 375.2), 'gaji': (302.4, 412.4), 'pengguna': (660.6, 348.3), 'cetakslip': (395.6, 93.8), 'draf': (258.1, 226.6), 'posting': (396.9, 214.3), 'mkonv': (538.6, 204.7), 'nilai': (178.2, 387.8), 'masuk': (523.2, 123.1), 'dash': (337.0, 172.9), 'event': (519.6, 419.7), 'msdm': (127.8, 306.2), 'aset': (290.8, 262.2), 'drafjp': (393.9, 129.1), 'slipfee': (582.7, 157.5), 'kurang': (276.6, 338.2)}
AKTOR_LETAK = {'P': ('T', 0.397), 'A': ('L', 0.328), 'H': ('B', 0.0), 'O': ('R', 0.489), 'K': ('B', 0.45)}


def cek_izin():
    """Aktor tiap use case harus sama dengan IZIN di src/lib/peran.ts."""
    teks = open(os.path.join(AKAR, "src", "lib", "peran.ts"), encoding="utf-8").read()
    izin = {}
    for m in re.finditer(r'"([\w.\-]+)":\s*\[([^\]]*)\]', teks):
        izin[m.group(1)] = "".join(sorted({"ADMIN": "A", "HRD": "H", "OWNER": "O", "KAPTEN": "K"}[x.strip().strip('"')] for x in m.group(2).split(",") if x.strip()))
    for k, (_, kunci, akt) in UC.items():
        if not kunci:
            continue
        ks = kunci.split("+")
        for kk in ks:
            if kk not in izin:
                raise SystemExit(f"kunci izin {kk} (use case {k}) tidak ada di peran.ts")
        gabung = "".join(sorted(set("".join(izin[x] for x in ks))))
        if gabung != "".join(sorted(akt)):
            raise SystemExit(f"aktor use case {k} = {akt}, tetapi IZIN[{kunci}] = {gabung}")


def pusat_slot(c, r=None):
    """Posisi pusat elips: tata[k] sudah berupa (x, y) dalam poin."""
    return (c, r) if r is not None else tuple(c)


def pos_aktor(sisi, t):
    if sisi == "L":
        return 40.0, Y0 + 24 + t * (Y1 - Y0 - 70)
    if sisi == "R":
        return W - 40.0, Y0 + 24 + t * (Y1 - Y0 - 70)
    if sisi == "T":
        return X0 + 50 + t * (X1 - X0 - 100), 22.0
    return X0 + 50 + t * (X1 - X0 - 100), H - 24.0


def titik_badan(p, menuju):
    """Titik di badan aktor tempat garis keluar, condong ke arah sistem."""
    x, y = p
    if x < X0:
        return (x + 10, y - 3)
    if x > X1:
        return (x - 10, y - 3)
    return (x, y + 9) if y < Y0 else (x, y - 12)


def tepi_elips(p, c):
    dx, dy = p[0] - c[0], p[1] - c[1]
    k = 1 / math.sqrt((dx / RX) ** 2 + (dy / RY) ** 2)
    return (c[0] + dx * k, c[1] + dy * k)


def garis_aktor(tata, ak):
    out = []
    for k, (c, r) in tata.items():
        pc = (c, r)
        for a in UC[k][2]:
            s = titik_badan(pos_aktor(*ak[a]), pc)
            out.append((a, k, s, tepi_elips(s, pc)))
    return out


def potong(p1, p2, q1, q2):
    def ccw(a, b, c):
        return (c[1] - a[1]) * (b[0] - a[0]) - (b[1] - a[1]) * (c[0] - a[0])
    d1, d2 = ccw(p1, p2, q1), ccw(p1, p2, q2)
    d3, d4 = ccw(q1, q2, p1), ccw(q1, q2, p2)
    return (d1 * d2 < 0) and (d3 * d4 < 0)


GEN = ("A", "H", "O")   # aktor yang mewarisi Pengguna ("P"). Kapten tidak: ia hanya membuka dashboard dan Penilaian Crew.
# Rentang posisi aktor di sisi bawah: HRD di kiri, Kapten di tengah, keterangan di kanan bawah.
BATAS_AKTOR = {("H", "B"): (0.0, 0.42), ("K", "B"): (0.45, 0.6)}


def garis_generalisasi(ak):
    out = []
    p = pos_aktor(*ak["P"])
    sp = titik_badan(p, None)
    for a in GEN:
        q = pos_aktor(*ak[a])
        out.append((a, titik_badan(q, p), (p[0] + (q[0] - p[0]) * 0.0, p[1])))
    return out


def biaya(tata, ak, rinci=False):
    pusat = {k: tuple(v) for k, v in tata.items()}
    ks = list(pusat)
    cx = np.array([pusat[k][0] for k in ks]); cy = np.array([pusat[k][1] for k in ks])
    ga = garis_aktor(tata, ak)
    rel = [(d, ke, tepi_elips(pusat[ke], pusat[d]), tepi_elips(pusat[d], pusat[ke])) for d, ke, _, _ in REL]
    # generalisasi: garis lurus dari aktor ke aktor Pengguna
    gen = []
    pp = pos_aktor(*ak["P"])
    for a in GEN:
        q = pos_aktor(*ak[a])
        gen.append((a, (q[0], q[1]), (pp[0], pp[1])))
    total = 0.0
    parts = {"tembus": 0.0, "panjang": 0.0, "silang": 0.0, "impit": 0.0, "pref": 0.0, "aktor": 0.0}
    t = np.linspace(0.02, 0.98, 30)[:, None]
    def tembus(s, e, abaikan, m=4):
        xs = s[0] + (e[0] - s[0]) * t; ys = s[1] + (e[1] - s[1]) * t
        q = ((xs - cx[None, :]) / (RX + m)) ** 2 + ((ys - cy[None, :]) / (RY + m - 1.5)) ** 2
        for i, k in enumerate(ks):
            if k in abaikan:
                q[:, i] = 9
        return float(np.clip(1.0 - q.min(axis=0), 0, None).sum())
    # tembus: semua garis sekaligus (aktor, include/extend, generalisasi)
    daftar = [(g[2], g[3], {g[1]}, 4) for g in ga] + [(r[2], r[3], {r[0], r[1]}, 4) for r in rel]
    S0 = np.array([d[0] for d in daftar], dtype=float); E0 = np.array([d[1] for d in daftar], dtype=float)
    mask = np.zeros((len(daftar), len(ks)), dtype=bool)
    idx = {k: i for i, k in enumerate(ks)}
    for n_, d in enumerate(daftar):
        for k_ in d[2]:
            mask[n_, idx[k_]] = True
    tt = np.linspace(0.02, 0.98, 30)[None, :, None]
    XS = S0[:, None, 0:1] + (E0[:, None, 0:1] - S0[:, None, 0:1]) * tt
    YS = S0[:, None, 1:2] + (E0[:, None, 1:2] - S0[:, None, 1:2]) * tt
    Q = ((XS - cx[None, None, :]) / (RX + 4)) ** 2 + ((YS - cy[None, None, :]) / (RY + 2.5)) ** 2
    Q = np.where(mask[:, None, :], 9.0, Q)
    parts["tembus"] += 60 * float(np.clip(1.0 - Q.min(axis=1), 0, None).sum())
    for a, k, s, e in ga:
        parts["panjang"] += 0.004 * math.dist(s, e)
    for (d, ke, s, e), (_, _, _, cat_) in zip(rel, REL):
        ln = math.dist(s, e)
        parts["panjang"] += 0.02 * ln
        # garis berlabel syarat harus cukup panjang untuk label satu baris di atasnya plus ruang ujung panah
        min_ln = 38 + (lebar_segmen([("\u00abextend\u00bb ", "i"), (cat_.replace("\n", " "), "r")], 7.5) - 10 if cat_ else 0)
        if ln < min_ln:
            parts["pref"] += (min_ln - ln) / 4
    # persilangan dan garis aktor yang hampir berimpit (vektor)
    S = np.array([g[2] for g in ga]); E = np.array([g[3] for g in ga])
    who = np.array([g[0] for g in ga]); kk = np.array([g[1] for g in ga])
    def silang_mat(S1, E1, S2, E2):
        def ccw(A, B, C):
            return (C[None, :, 1] - A[:, None, 1]) * (B[:, None, 0] - A[:, None, 0]) - (B[:, None, 1] - A[:, None, 1]) * (C[None, :, 0] - A[:, None, 0])
        d1 = ccw(S1, E1, S2); d2 = ccw(S1, E1, E2)
        d3 = ccw(S2, E2, S1).T; d4 = ccw(S2, E2, E1).T
        return (d1 * d2 < 0) & (d3 * d4 < 0)
    M = silang_mat(S, E, S, E)
    beda = who[:, None] != who[None, :]
    parts["silang"] += 0.35 * float(np.triu(M & beda, 1).sum())
    ang = np.arctan2(E[:, 1] - S[:, 1], E[:, 0] - S[:, 0])
    dang = np.abs(np.arctan2(np.sin(ang[:, None] - ang[None, :]), np.cos(ang[:, None] - ang[None, :])))
    sama = (who[:, None] == who[None, :]) & (kk[:, None] != kk[None, :])
    parts["impit"] += 3.0 * float(np.triu(sama & (dang < math.radians(7)), 1).sum())
    if rel:
        SR = np.array([r[2] for r in rel]); ER = np.array([r[3] for r in rel])
        parts["silang"] += 8.0 * float(silang_mat(S, E, SR, ER).sum())
        n_r = len(rel)
        if n_r > 1:
            M2 = silang_mat(SR, ER, SR, ER)
            parts["silang"] += 8.0 * float(np.triu(M2, 1).sum())
    # elips tidak boleh bertumpuk atau keluar dari kotak sistem (vektor)
    kel = np.maximum.reduce([X0 + 6 - (cx - RX), (cx + RX) - (X1 - 6), (Y0 + 22) - (cy - RY), (cy + RY) - (Y1 - 5)]) + 1.0
    # elips keluar kotak sistem atau bertumpuk tidak pernah boleh terjadi, jadi penaltinya jauh di atas biaya lain
    parts["pref"] += float(np.where(kel > 0, 40 + kel * 2, 0.0).sum())
    OX = 2 * RX + 7 - np.abs(cx[:, None] - cx[None, :]); OY = 2 * RY + 9 - np.abs(cy[:, None] - cy[None, :])
    tum = np.triu((OX > 0) & (OY > 0), 1)
    parts["pref"] += float(np.where(tum, 40 + np.minimum(OX, OY) * 2, 0.0).sum())
    # aktor tidak boleh berdekatan satu sama lain
    keys = list(ak)
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            d = math.dist(pos_aktor(*ak[keys[i]]), pos_aktor(*ak[keys[j]]))
            if d < 70:
                parts["aktor"] += (70 - d) / 10
    total = sum(parts.values())
    return (total, parts) if rinci else total


def diagnosa(tata, ak):
    """Cetak pelanggaran: garis yang menembus atau terlalu dekat elips, elips bertumpuk, dan garis yang berimpit."""
    pusat = {k: tuple(v) for k, v in tata.items()}
    t = np.linspace(0.0, 1.0, 60)
    def cek(nama, s, e, abaikan, m=4):
        for k, (cx, cy) in pusat.items():
            if k in abaikan:
                continue
            xs = s[0] + (e[0] - s[0]) * t; ys = s[1] + (e[1] - s[1]) * t
            q = (((xs - cx) / (RX + m)) ** 2 + ((ys - cy) / (RY + m - 1.5)) ** 2).min()
            if q < 1:
                print(f"  {nama} menembus/mepet {k} (q={q:.2f})")
    for a, k, s, e in garis_aktor(tata, ak):
        cek(f"aktor {a}->{k}", s, e, {k})
    for d, ke, jenis, _ in REL:
        cek(f"{jenis} {d}->{ke}", tepi_elips(pusat[ke], pusat[d]), tepi_elips(pusat[d], pusat[ke]), {d, ke})
    ks = list(pusat)
    for i in range(len(ks)):
        for j in range(i + 1, len(ks)):
            (x1, y1), (x2, y2) = pusat[ks[i]], pusat[ks[j]]
            if abs(x1 - x2) < 2 * RX + 6 and abs(y1 - y2) < 2 * RY + 8:
                print(f"  elips bertumpuk: {ks[i]} dan {ks[j]}")
        x, y = pusat[ks[i]]
        if x - RX < X0 + 6 or x + RX > X1 - 6 or y - RY < Y0 + 22 or y + RY > Y1 - 5:
            print(f"  di luar batas: {ks[i]}")
    print("  biaya:", biaya(tata, ak, True)[1])


def awal(rnd):
    """Susunan awal kasar: use case milik Admin di kiri, Owner di kanan, HRD di bawah, Pengguna di atas, bersama di tengah."""
    pos = {}
    pusat_x = {"A": X0 + 90, "O": X1 - 90, "H": (X0 + X1) / 2, "P": (X0 + X1) / 2, "PK": (X0 + X1) / 2, "AO": (X0 + X1) / 2, "HO": X1 - 150,
               "K": (X0 + X1) / 2 + 60, "KO": X1 - 120, "": (X0 + X1) / 2}
    pusat_y = {"A": 160, "O": 200, "H": Y1 - 40, "P": Y0 + 40, "PK": Y0 + 60, "AO": 220, "HO": Y1 - 60, "K": Y1 - 50, "KO": Y1 - 80, "": 250}
    for k, (_, _, akt) in UC.items():
        pos[k] = (pusat_x[akt] + rnd.uniform(-60, 60), pusat_y[akt] + rnd.uniform(-60, 60))
    return pos


def awal_kisi(rnd):
    """Susunan awal di kisi zig-zag (5 kolom x 10 baris, baris genap bergeser setengah kolom) supaya tidak ada elips
    bertumpuk sejak awal. Tiap use case mengambil slot kosong terdekat dari titik sasaran aktornya (lihat awal())."""
    sasaran = awal(rnd)
    nbar = 10
    x_kiri, x_kanan = X0 + 6 + RX + 2, X1 - 6 - RX - 2
    y_atas, y_bawah = Y0 + 22 + RY + 2, Y1 - 5 - RY - 2
    dx = (x_kanan - x_kiri) / 4.5
    slot = []
    for b in range(nbar):
        y = y_atas + b * (y_bawah - y_atas) / (nbar - 1)
        geser = 0 if b % 2 == 0 else dx / 2
        slot += [(x_kiri + geser + k * dx, y) for k in range(5)]
    tata = {}
    urut = sorted(UC, key=lambda k: (len(UC[k][2]) or 9, rnd.random()))   # use case dengan satu aktor lebih dulu
    for k in urut:
        sx, sy = sasaran[k]
        terdekat = min(slot, key=lambda q: (q[0] - sx) ** 2 + (1.8 * (q[1] - sy)) ** 2)
        slot.remove(terdekat)
        tata[k] = terdekat
    return tata


def cari(seed=7, langkah=60000, T0=8.0, sig0=45.0, mulai=None):
    rnd = random.Random(seed)
    kunci = list(UC)
    tata = awal_kisi(rnd) if os.environ.get("AWAL") == "kisi" else awal(rnd)
    ak = {"P": ("T", 0.5), "A": ("L", 0.45), "H": ("B", 0.3), "O": ("R", 0.45), "K": ("B", 0.55)}
    if mulai:
        tata, ak = dict(mulai[0]), dict(mulai[1])
        if ak["H"][0] == "B":
            ak["H"] = ("B", min(ak["H"][1], 0.42))
    cur = biaya(tata, ak)
    best = (cur, dict(tata), dict(ak))
    for it in range(langkah):
        frac = it / langkah
        T = max(0.03, T0 * (1 - frac) ** 2)
        sig = max(2.0, sig0 * (1 - frac))
        tata2, ak2 = dict(tata), dict(ak)
        r = rnd.random()
        if r < 0.85:
            a = rnd.choice(kunci)
            x, y = tata2[a]
            tata2[a] = (x + rnd.gauss(0, sig), y + rnd.gauss(0, sig))
        elif r < 0.93:
            a, b = rnd.sample(kunci, 2)
            tata2[a], tata2[b] = tata2[b], tata2[a]
        elif r < 0.985:
            a = rnd.choice(list(ak2)); sisi, tt = ak2[a]
            bts = BATAS_AKTOR.get((a, sisi), (0.0, 1.0))
            ak2[a] = (sisi, min(max(tt + rnd.uniform(-0.15, 0.15), bts[0]), bts[1]))
        else:
            a = rnd.choice(list(ak2))
            if a == "H":
                ak2[a] = (rnd.choice("LB"), rnd.random() * 0.4)
        n = biaya(tata2, ak2)
        if n < cur or rnd.random() < math.exp((cur - n) / T):
            tata, ak, cur = tata2, ak2, n
            if cur < best[0]:
                best = (cur, dict(tata), dict(ak))
        if it % 10000 == 0:
            print(it, round(cur, 2), round(best[0], 2), flush=True)
    print("terbaik", round(best[0], 3), biaya(best[1], best[2], True)[1])
    return best


def aktor_gambar(svg, a, x, y):
    w = WARNA_AKTOR[a]
    svg.circle(x, y - 14, 5.2, "#FFFFFF", w, 1.1)
    svg.garis([(x, y - 8.8), (x, y + 8)], w, 1.1)
    svg.garis([(x - 9, y - 3), (x + 9, y - 3)], w, 1.1)
    svg.garis([(x, y + 8), (x - 7, y + 20)], w, 1.1)
    svg.garis([(x, y + 8), (x + 7, y + 20)], w, 1.1)


def segitiga(svg, p, q, warna, tinggi=8.0, lebar=4.5, isi="#FFFFFF"):
    d = math.atan2(q[1] - p[1], q[0] - p[0])
    ux, uy = math.cos(d), math.sin(d); vx, vy = -uy, ux
    b = (q[0] - ux * tinggi, q[1] - uy * tinggi)
    svg.poligon([q, (b[0] + vx * lebar, b[1] + vy * lebar), (b[0] - vx * lebar, b[1] - vy * lebar)], isi, warna, 0.9)
    return b


def panah_terbuka(svg, p, q, warna="#222"):
    d = math.atan2(q[1] - p[1], q[0] - p[0])
    for s in (0.42, -0.42):
        svg.garis([q, (q[0] - 7.5 * math.cos(d - s), q[1] - 7.5 * math.sin(d - s))], warna, 0.9)


def _seg_rect(p, q, x, y, w, h):
    """True bila segmen p-q memotong persegi (x, y, w, h)."""
    n = max(2, int(math.dist(p, q) / 2))
    for i in range(n + 1):
        px = p[0] + (q[0] - p[0]) * i / n; py = p[1] + (q[1] - p[1]) * i / n
        if x <= px <= x + w and y <= py <= y + h:
            return True
    return False


def bebas(kotak, pusat, segmen, terpakai, m=1.0):
    """Persegi di dalam kotak sistem dan tidak menyentuh elips, garis, atau kotak lain."""
    x, y, w, h = kotak
    if x < X0 + 4 or y < Y0 + 20 or x + w > X1 - 4 or y + h > Y1 - 4:
        return False
    for (cx, cy) in pusat.values():
        nx_ = min(max(cx, x), x + w); ny_ = min(max(cy, y), y + h)
        for px, py in ((x, y), (x + w, y), (x, y + h), (x + w, y + h), (nx_, ny_)):
            if ((px - cx) / (RX + m)) ** 2 + ((py - cy) / (RY + m)) ** 2 < 1:
                return False
        if x < cx + RX + m and x + w > cx - RX - m and y < cy + RY + m and y + h > cy - RY - m:
            for k in range(0, 41):
                for px, py in ((x + w * k / 40, y), (x + w * k / 40, y + h), (x, y + h * k / 40), (x + w, y + h * k / 40)):
                    if ((px - cx) / (RX + m)) ** 2 + ((py - cy) / (RY + m)) ** 2 < 1:
                        return False
            if cx - RX < x and cx + RX > x + w and cy - RY < y and cy + RY > y + h:
                return False
    for p, q in segmen:
        if _seg_rect(p, q, x - m, y - m, w + 2 * m, h + 2 * m):
            return False
    for (lx, ly, lw, lh) in terpakai:
        if x < lx + lw + 2 and x + w > lx - 2 and y < ly + lh + 2 and y + h > ly - 2:
            return False
    return True


def _konektor_bebas(kotak, dekat, pusat):
    """Garis putus dari persegi ke titik `dekat` tidak boleh menembus elips."""
    x, y, w, h = kotak
    tx = min(max(dekat[0], x), x + w); ty = min(max(dekat[1], y), y + h)
    for i in range(0, 41):
        px = tx + (dekat[0] - tx) * i / 40; py = ty + (dekat[1] - ty) * i / 40
        for (cx, cy) in pusat.values():
            if ((px - cx) / (RX + 1.5)) ** 2 + ((py - cy) / (RY + 1.5)) ** 2 < 1:
                return False
    return True


def cari_tempat(w, h, dekat, pusat, segmen, terpakai, maks=170, konektor=False, syarat=None):
    """Persegi w x h terdekat dari titik `dekat` yang bebas."""
    kandidat = sorted(((dx, dy) for dx in range(-maks, maks + 1, 4) for dy in range(-maks // 2, maks // 2 + 1, 3)), key=lambda d: d[0] ** 2 + (1.6 * d[1]) ** 2)
    for dx, dy in kandidat:
        kotak = (dekat[0] + dx - w / 2, dekat[1] + dy - h / 2, w, h)
        if bebas(kotak, pusat, segmen, terpakai) and (not konektor or _konektor_bebas(kotak, dekat, pusat)) and (syarat is None or syarat(kotak)):
            return kotak
    return None


def jarak_titik_segmen(pt, a, b):
    ax, ay = a; bx, by = b
    dx, dy = bx - ax, by - ay
    t = 0.0 if dx == dy == 0 else max(0.0, min(1.0, ((pt[0] - ax) * dx + (pt[1] - ay) * dy) / (dx * dx + dy * dy)))
    return math.dist(pt, (ax + t * dx, ay + t * dy))


def jarak_kotak_segmen(kotak, a, b):
    x, y, w, h = kotak
    pts = [(x + w * i / 6, y + h * j / 2) for i in range(7) for j in range(3)]
    return min(jarak_titik_segmen(q, a, b) for q in pts)


def catatan(svg, kotak, baris):
    x, y, w, h = kotak
    l = 6.0
    svg.poligon([(x, y), (x + w - l, y), (x + w, y + l), (x + w, y + h), (x, y + h)], "#FFFBE0", "#8a8a8a", 0.7)
    svg.garis([(x + w - l, y), (x + w - l, y + l), (x + w, y + l)], "#8a8a8a", 0.7)
    for i, t_ in enumerate(baris):
        svg.teks(x + 3, y + 8.6 + i * 8.6, t_, 7.5, "#333")


def gambar(tata, ak, path_svg, path_png):
    svg = Svg(W, H)
    svg.rect(X0, Y0, X1 - X0, Y1 - Y0, "#FFFFFF", "#8B1A1A", 1.0, 5)
    svg.teks(X0 + 8, Y0 + 12, [("Sistem Informasi Akuntansi D\u2019Production", "bi")], 8.6, "#8B1A1A")
    pusat = {k: tuple(v) for k, v in tata.items()}
    for a, k, s, e in garis_aktor(tata, ak):
        svg.garis([s, e], WARNA_AKTOR[a], 0.9)
    # generalisasi aktor -> Pengguna: siku-siku di luar kotak sistem, segitiga kosong di lengan Pengguna
    xp, yp = pos_aktor(*ak["P"])
    yg = yp - 3.0
    XK = 14.0
    warna_g = "#555555"
    xa, ya = pos_aktor(*ak["A"]); xh, yh = pos_aktor(*ak["H"]); xo, yo = pos_aktor(*ak["O"])
    svg.garis([(XK, yg), (xp - 18, yg)], warna_g, 0.9)
    segitiga(svg, (xp - 18, yg), (xp - 9, yg), warna_g, 9, 4.8)
    svg.garis([(xa, ya - 20), (xa, yg)], WARNA_AKTOR["A"], 0.9)
    if yh > Y1:
        svg.garis([(xh - 11, yh - 3), (XK, yh - 3), (XK, yg)], WARNA_AKTOR["H"], 0.9)
    else:
        svg.garis([(xh - 11, yh - 3), (XK, yh - 3), (XK, yg)], WARNA_AKTOR["H"], 0.9)
    svg.garis([(xo, yo - 20), (xo, yg), (xp + 18, yg)], WARNA_AKTOR["O"], 0.9)
    segitiga(svg, (xp + 18, yg), (xp + 9, yg), WARNA_AKTOR["O"], 9, 4.8)
    # segmen yang sudah dipakai garis (penghalang untuk label dan catatan)
    segmen = [(s_, e_) for _, _, s_, e_ in garis_aktor(tata, ak)]
    segmen += [((XK, yg), (xp - 9, yg)), ((xa, ya - 20), (xa, yg)), ((xh - 11, yh - 3), (XK, yh - 3)), ((XK, yh - 3), (XK, yg)), ((xo, yo - 20), (xo, yg)), ((xo, yg), (xp + 9, yg))]
    rels = []
    for d, ke, jenis, cat in REL:
        s_ = tepi_elips(pusat[ke], pusat[d]); e_ = tepi_elips(pusat[d], pusat[ke])
        segmen.append((s_, e_))
        rels.append((s_, e_, jenis, cat))
    # kotak aktor dan judul sebagai penghalang
    terpakai = [(X0, Y0, 250, 18), (X1 - 150, Y1 + 4, 150, 45)]
    for a_ in ak:
        axx, ayy = pos_aktor(*ak[a_])
        terpakai.append((axx - 24, ayy - 22, 48, 56) if (X0 < axx < X1 or axx < X0 or axx > X1) else (axx - 24, ayy - 22, 48, 56))
    xp_, yp_ = xp, yp
    for s_, e_, jenis, cat in rels:
        svg.garis([s_, e_], "#222", 0.9, dash="3 2")
        panah_terbuka(svg, s_, e_)
    for n_rel, (s_, e_, jenis, cat) in enumerate(rels):
        mid = ((s_[0] + e_[0]) / 2, (s_[1] + e_[1]) / 2)
        st = f"\u00ab{jenis}\u00bb"
        baris = [(st, "i")] + [(b_, "r") for b_ in cat.split("\n")] if cat else [(st, "i")]
        wst = max(lebar_teks(t_, 7.5, g_) for t_, g_ in baris) + 3
        hst = len(baris) * 8.6 + 1.5
        lain = [(a_, b_) for m_, (a_, b_, _, _) in enumerate(rels) if m_ != n_rel]
        def milik_sendiri(kotak, s_=s_, e_=e_, lain=lain, maks=11, beda=5):
            # label harus jelas milik garisnya: dekat garis sendiri dan lebih jauh dari garis relasi lain
            d_sendiri = jarak_kotak_segmen(kotak, s_, e_)
            return d_sendiri <= maks and all(jarak_kotak_segmen(kotak, a_, b_) > d_sendiri + beda for a_, b_ in lain)
        kotak = cari_tempat(wst, hst, mid, pusat, segmen, terpakai, 120, syarat=milik_sendiri)
        if kotak is None:   # percobaan kedua: label boleh sedikit lebih jauh dari garisnya
            kotak = cari_tempat(wst, hst, mid, pusat, segmen, terpakai, 140, syarat=lambda k_, f=milik_sendiri: f(k_, maks=14, beda=7))
        satu_baris = False
        if kotak is None and cat:   # percobaan ketiga: stereotip dan syarat dalam satu baris
            seg1 = [(st + " ", "i"), (cat.replace("\n", " "), "r")]
            w1 = lebar_segmen(seg1, 7.5) + 3
            kotak = cari_tempat(w1, 10.1, mid, pusat, segmen, terpakai, 140, syarat=lambda k_, f=milik_sendiri: f(k_, maks=14, beda=7))
            satu_baris = kotak is not None
            if kotak is None:   # cadangan terakhir: di atas garis sendiri, latar putih memutus garis di bawah label
                tanpa_sendiri = [g_ for g_ in segmen if g_ != (s_, e_)]
                kotak = cari_tempat(w1, 10.1, mid, pusat, tanpa_sendiri, terpakai, 40,
                                    syarat=lambda k_: jarak_kotak_segmen(k_, s_, e_) < 1.0 and jarak_kotak_segmen(k_, e_, e_) > 6
                                    and all(jarak_kotak_segmen(k_, a_, b_) > 6 for a_, b_ in lain))
                if kotak is not None:
                    satu_baris = True
                    svg.rect(kotak[0], kotak[1], kotak[2], kotak[3], "#FFFFFF")
        if kotak is None:
            print("label relasi tidak muat:", st, cat.replace("\n", " "), "(garis", s_, e_, ")")
        elif satu_baris:
            terpakai.append(kotak)
            svg.teks(kotak[0] + kotak[2] / 2, kotak[1] + 8, seg1, 7.5, "#222", "middle")
        else:
            terpakai.append(kotak)
            for i_, (t_, g_) in enumerate(baris):
                svg.teks(kotak[0] + wst / 2, kotak[1] + 8 + i_ * 8.6, [(t_, g_)], 7.5, "#222", "middle")
    for k, (lab, kunci, akt) in UC.items():
        cx, cy = pusat[k]
        svg.ellipse(cx, cy, RX, RY, SIKLUS[GRUP[k]], "#444", 0.8)
        baris = lab.split("\n")
        y0 = cy - (len(baris) - 1) * UK * 1.12 / 2 + UK * 0.34
        for i, b in enumerate(baris):
            svg.teks(cx, y0 + i * UK * 1.12, b, UK, "#111", "middle")
    for a in ak:
        x, y = pos_aktor(*ak[a])
        aktor_gambar(svg, a, x, y)
        nama = NAMA_AKTOR.get(a, "Pengguna")
        if a == "P":
            svg.teks(x + 10, y - 8, [(nama, "b")], UK_AKTOR, WARNA_AKTOR[a])
            svg.teks(x + 10 + lebar_teks(nama, UK_AKTOR, "b") + 4, y - 8, "(Admin, HRD, Owner)", 7.5, WARNA_AKTOR[a])
        elif y > Y1:
            svg.teks(x + 14, y + 6, [(nama, "b")], UK_AKTOR, WARNA_AKTOR[a])
        else:
            svg.teks(x, y + 32, [(nama, "b")], UK_AKTOR, WARNA_AKTOR[a], "middle")
    # keterangan di kanan bawah (di luar kotak sistem): simbol garis di kolom kiri, arti warna elips di kolom kanan
    lx = W - 300; ly = Y1 + 10
    svg.teks(lx, ly, [("Keterangan", "b")], 7.5, "#333")
    svg.garis([(lx, ly + 9), (lx + 18, ly + 9)], "#222", 0.9, dash="3 2"); panah_terbuka(svg, (lx, ly + 9), (lx + 18, ly + 9))
    svg.teks(lx + 23, ly + 12, "include atau extend", 7.5, "#333")
    svg.garis([(lx, ly + 20), (lx + 10, ly + 20)], "#555", 0.9); segitiga(svg, (lx, ly + 20), (lx + 20, ly + 20), "#555", 8, 4.2)
    svg.teks(lx + 25, ly + 23, "Admin, HRD, Owner mewarisi Pengguna", 7.5, "#333")
    svg.garis([(lx, ly + 31), (lx + 18, ly + 31)], "#8B1A1A", 0.9)
    svg.teks(lx + 23, ly + 34, "garis aktor ke use case", 7.5, "#333")
    cx0 = W - 118
    svg.teks(cx0, ly, [("Warna elips", "b")], 7.5, "#333")
    for n_, (kode, ket) in enumerate((("k", "Siklus konversi"), ("s", "SDM: gaji inhouse"), ("e", "SDM: fee event"), ("l", "Pelaporan, pengaturan"), ("p", "Umum"))):
        yy = ly + 5.5 + n_ * 8.6
        svg.ellipse(cx0 + 6, yy + 1.5, 6, 3.6, SIKLUS[kode], "#444", 0.6)
        svg.teks(cx0 + 16, yy + 4, ket, 7.5, "#333")
    svg.simpan(path_svg, path_png)


if __name__ == "__main__":
    cek_izin()
    if "--cari" in sys.argv or not TATA_LETAK:
        seed = int(os.environ.get("SEED", 7)); n = int(os.environ.get("LANGKAH", 60000))
        mulai = (TATA_LETAK, AKTOR_LETAK) if TATA_LETAK and os.environ.get("DARI_TERSIMPAN") else None
        skor, tata, ak = cari(seed, n, float(os.environ.get("T0", 8.0)), float(os.environ.get("SIG0", 45.0)), mulai)
        print("TATA_LETAK =", {k: (round(v[0], 1), round(v[1], 1)) for k, v in tata.items()})
        print("AKTOR_LETAK =", {k: (v[0], round(v[1], 3)) for k, v in ak.items()})
    else:
        tata, ak = TATA_LETAK, AKTOR_LETAK
    d = os.environ.get("KELUAR_UC", os.path.join(AKAR, "docs"))   # folder keluaran lain dipakai saat mencari paralel
    gambar(tata, ak, os.path.join(d, "use-case.svg"), os.path.join(d, "use-case.png"))
    print(f"use-case: {len(UC)} use case, kanvas {W}x{H} pt")
