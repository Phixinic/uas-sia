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
from svgkit import Svg, lebar_teks

AKAR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
W, H = 785.0, 440.0
UK = 7.6            # huruf use case (pt cetak)
UK_AKTOR = 8.6
RX, RY = 52.0, 12.5  # elips seragam
KOLOM, BARIS = 5, 7
X0, Y0, X1, Y1 = 64.0, 52.0, 721.0, 388.0   # kotak batas sistem

# kunci: (label, kunci IZIN atau None, aktor). Aktor: A Admin, H HRD, O Owner, P semua peran.
UC = {
    "masuk":   ("Masuk ke aplikasi\ndengan akun per peran", None, "P"),
    "dash":    ("Lihat dashboard", None, "P"),
    "umum":    ("Lihat jurnal umum", None, "P"),
    "bb":      ("Lihat buku besar", None, "P"),
    "ns":      ("Lihat neraca saldo", None, "P"),
    "kartu":   ("Lihat kartu aset", None, "P"),
    "cetak":   ("Cetak laporan", None, "P"),
    "cetakslip": ("Cetak slip gaji", None, "P"),
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
}
# Relasi antar use case: (dari, ke, jenis, catatan). Panah dari use case yang menyertai/memperluas.
REL = [
    ("susut", "drafjp", "include", ""),
    ("drafjp", "sisa", "extend", "[total biaya\nlebih dari nol]"),
    ("cepat", "draf", "extend", "[supplier atau\nbarang belum ada]"),
    ("aset", "posting", "extend", "[pembelian\nperalatan]"),
    ("cetak", "umum", "extend", ""),
    ("cetak", "bb", "extend", ""),
    ("cetak", "ns", "extend", ""),
]
NAMA_AKTOR = {"A": "Admin", "H": "HRD", "O": "Owner"}
WARNA_AKTOR = {"A": "#8B1A1A", "H": "#1F5F99", "O": "#2E6B3A", "P": "#555555"}
WARNA_UC = {  # per siklus
    "masuk": "#EEEEEE", "dash": "#EEEEEE", "lap": "#EEEEEE", "kartu": "#EEEEEE",
}
SIKLUS = {"k": "#FDE7E4", "s": "#E3EFFA", "l": "#FFF3C4", "p": "#EEEEEE"}
GRUP = {"masuk": "p", "dash": "p", "umum": "l", "bb": "l", "ns": "l", "kartu": "k", "cetak": "l", "cetakslip": "s",
        "draf": "k", "cepat": "k", "posting": "k", "aset": "k", "balik": "k", "sisa": "k", "susut": "k", "drafjp": "l", "ajujp": "l",
        "ajulepas": "k", "setlepas": "k", "setjp": "l", "mkonv": "k", "presensi": "s", "gaji": "s", "dist": "s", "setgaji": "s", "msdm": "s",
        "kunci": "l", "katakun": "l", "pengguna": "l"}

# Tata letak hasil pencarian: kunci -> (kolom, baris); aktor -> (sisi, posisi 0..1 sepanjang sisi).
TATA_LETAK = {'masuk': (454.9, 122.5), 'dash': (158.5, 90.9), 'umum': (338.1, 119.7), 'bb': (147.1, 134.8), 'ns': (423.8, 156.9), 'kartu': (572.2, 133.0), 'cetak': (260.1, 160.2), 'cetakslip': (535.6, 88.3), 'draf': (373.7, 325.8), 'cepat': (188.8, 294.2), 'posting': (425.8, 232.8), 'aset': (337.9, 270.0), 'balik': (620.4, 206.5), 'sisa': (171.9, 332.4), 'susut': (123.5, 368.9), 'drafjp': (265.4, 367.0), 'ajujp': (127.0, 200.0), 'ajulepas': (201.1, 249.8), 'setlepas': (636.9, 171.0), 'setjp': (661.7, 97.4), 'mkonv': (283.6, 199.6), 'presensi': (382.0, 362.4), 'gaji': (494.1, 345.2), 'dist': (644.4, 368.2), 'setgaji': (484.3, 306.1), 'msdm': (628.0, 333.9), 'kunci': (493.8, 267.9), 'katakun': (463.0, 195.5), 'pengguna': (607.3, 299.4)}
AKTOR_LETAK = {'P': ('T', 0.385), 'A': ('L', 0.59), 'H': ('B', 0.42), 'O': ('R', 0.666)}


def cek_izin():
    """Aktor tiap use case harus sama dengan IZIN di src/lib/peran.ts."""
    teks = open(os.path.join(AKAR, "src", "lib", "peran.ts"), encoding="utf-8").read()
    izin = {}
    for m in re.finditer(r'"([\w.\-]+)":\s*\[([^\]]*)\]', teks):
        izin[m.group(1)] = "".join(sorted({"ADMIN": "A", "HRD": "H", "OWNER": "O"}[x.strip().strip('"')] for x in m.group(2).split(",") if x.strip()))
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


GEN = ("A", "H", "O")   # aktor yang mewarisi Pengguna ("P")


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
        min_ln = 38 + (22 if cat_ else 0)
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
    parts["pref"] += float(np.where(kel > 0, 5 + kel / 5, 0.0).sum())
    OX = 2 * RX + 7 - np.abs(cx[:, None] - cx[None, :]); OY = 2 * RY + 9 - np.abs(cy[:, None] - cy[None, :])
    tum = np.triu((OX > 0) & (OY > 0), 1)
    parts["pref"] += float(np.where(tum, 5 + np.minimum(OX, OY) / 4, 0.0).sum())
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
    pusat_x = {"A": X0 + 90, "O": X1 - 90, "H": (X0 + X1) / 2, "P": (X0 + X1) / 2, "AO": (X0 + X1) / 2, "HO": X1 - 150, "": (X0 + X1) / 2}
    pusat_y = {"A": 160, "O": 200, "H": Y1 - 40, "P": Y0 + 40, "AO": 220, "HO": Y1 - 60, "": 250}
    for k, (_, _, akt) in UC.items():
        pos[k] = (pusat_x[akt] + rnd.uniform(-60, 60), pusat_y[akt] + rnd.uniform(-60, 60))
    return pos


def cari(seed=7, langkah=60000, T0=8.0, sig0=45.0, mulai=None):
    rnd = random.Random(seed)
    kunci = list(UC)
    tata = awal(rnd)
    ak = {"P": ("T", 0.5), "A": ("L", 0.45), "H": ("B", 0.45), "O": ("R", 0.45)}
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
            bts = (0.0, 0.42) if (a == "H" and sisi == "B") else (0.0, 1.0)
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
        def milik_sendiri(kotak, s_=s_, e_=e_, lain=lain):
            # label harus jelas milik garisnya: dekat garis sendiri dan lebih jauh dari garis relasi lain
            d_sendiri = jarak_kotak_segmen(kotak, s_, e_)
            return d_sendiri <= 11 and all(jarak_kotak_segmen(kotak, a_, b_) > d_sendiri + 5 for a_, b_ in lain)
        kotak = cari_tempat(wst, hst, mid, pusat, segmen, terpakai, 120, syarat=milik_sendiri)
        if kotak is None:
            print("label relasi tidak muat:", st, cat.replace("\n", " "), "(garis", s_, e_, ")")
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
            svg.teks(x + 10 + lebar_teks(nama, UK_AKTOR, "b") + 4, y - 8, "(semua peran)", 7.5, WARNA_AKTOR[a])
        elif y > Y1:
            svg.teks(x + 14, y + 6, [(nama, "b")], UK_AKTOR, WARNA_AKTOR[a])
        else:
            svg.teks(x, y + 32, [(nama, "b")], UK_AKTOR, WARNA_AKTOR[a], "middle")
    # keterangan di kanan bawah (di luar kotak sistem): simbol garis di kolom kiri, arti warna elips di kolom kanan
    lx = W - 300; ly = Y1 + 12
    svg.teks(lx, ly, [("Keterangan", "b")], 7.5, "#333")
    svg.garis([(lx, ly + 9), (lx + 18, ly + 9)], "#222", 0.9, dash="3 2"); panah_terbuka(svg, (lx, ly + 9), (lx + 18, ly + 9))
    svg.teks(lx + 23, ly + 12, "include atau extend", 7.5, "#333")
    svg.garis([(lx, ly + 20), (lx + 10, ly + 20)], "#555", 0.9); segitiga(svg, (lx, ly + 20), (lx + 20, ly + 20), "#555", 8, 4.2)
    svg.teks(lx + 25, ly + 23, "Admin, HRD, Owner mewarisi Pengguna", 7.5, "#333")
    svg.garis([(lx, ly + 31), (lx + 18, ly + 31)], "#8B1A1A", 0.9)
    svg.teks(lx + 23, ly + 34, "garis aktor ke use case", 7.5, "#333")
    cx0 = W - 118
    svg.teks(cx0, ly, [("Warna elips", "b")], 7.5, "#333")
    for n_, (kode, ket) in enumerate((("k", "Siklus konversi"), ("s", "Siklus SDM"), ("l", "Pelaporan, pengaturan"), ("p", "Umum (semua peran)"))):
        yy = ly + 5.5 + n_ * 9.2
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
    d = os.path.join(AKAR, "docs")
    gambar(tata, ak, os.path.join(d, "use-case.svg"), os.path.join(d, "use-case.png"))
    print(f"use-case: {len(UC)} use case, kanvas {W}x{H} pt")
