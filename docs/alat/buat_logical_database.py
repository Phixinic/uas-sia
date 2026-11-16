#!/usr/bin/env python3
"""Membangkitkan docs/logical-database.{svg,png,mmd} dari prisma/schema.prisma (tata letak manual, garis dirutekan otomatis).

Pemakaian (dari akar repo, butuh Python 3 + Pillow dan rsvg-convert):
    python3 docs/alat/buat_logical_database.py             # tulis svg, png, dan mmd
    python3 docs/alat/buat_logical_database.py --cek-db    # sekaligus cocokkan jumlah tabel dan FK dengan Postgres (docker sia-dpro-pg)

Aturan penurunan:
- Tabel dan kolom memakai nama database (@@map / @map), bukan nama field Prisma.
- Satu @relation(fields, references) menjadi satu relasi FK. Sisi induk "1" bila semua kolom FK wajib,
  "0..1" bila ada yang opsional. Sisi anak "0..N", atau "0..1" bila kolom FK itu unik.
- Di PNG, rujukan ke pengguna (dibuat_oleh, disetujui_oleh, dst.) dan ke akun (kecuali detail_jurnal) hanya ditulis
  di kolom, tanpa garis. File .mmd memuat semua relasi tanpa pengecualian.
- Kolom stempel waktu audit (KOLOM_WAKTU) tidak digambar di PNG; .mmd memuat semuanya.
- Ukuran kanvas = ukuran cetak (poin) di halaman laporan, jadi ukuran huruf di sini = ukuran huruf tercetak.
"""
import os, re, subprocess, sys

AKAR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SKEMA = os.path.join(AKAR, "prisma", "schema.prisma")
KELUAR = os.path.join(AKAR, "docs")
SKALAR = {"String", "Int", "Boolean", "DateTime", "Float", "Decimal", "BigInt", "Json", "Bytes"}

# Pengelompokan per siklus (nama tabel database).
KELOMPOK = [
    ("konv", "Siklus konversi", "#FDE7E4", ["supplier", "kategori_aset", "peralatan", "perlengkapan", "pembelian", "detail_pembelian",
                                           "aset", "jadwal_penyusutan", "opname", "detail_opname", "pelepasan"]),
    ("sdm", "Siklus SDM", "#E3EFFA", ["karyawan", "jabatan", "golongan", "tunjangan", "jadwal_kerja", "setting_gaji", "setting_tunjangan",
                                      "presensi", "slip_gaji", "slip_tunjangan", "penggajian"]),
    ("lap", "Pelaporan", "#FFF3C4", ["akun", "periode", "riwayat_periode", "jurnal", "detail_jurnal"]),
    ("sis", "Pengguna dan sistem", "#E6F2E4", ["pengguna", "sesi", "log_aktivitas", "profil_usaha", "penghitung"]),
]
# Tabel yang rujukannya hanya ditulis di kolom (tanpa garis). "akun" tetap digambar dari detail_jurnal.
TANPA_GARIS = {"pengguna": set(), "akun": {"detail_jurnal"}}

# Stempel waktu audit yang tidak digambar (disebut di keterangan gambar).
KOLOM_WAKTU = {"dibuat_pada", "diubah_pada", "diajukan_pada", "dihitung_pada", "dibalik_pada"}

# Penanda atribut: tebal = status persetujuan / aktif, miring = atribut perhitungan.
KOLOM_STATUS = re.compile(r"^(status|status_periode|aktif|alasan_tolak|alasan_balik|disetujui_oleh|disetujui_pada|diajukan_pada|dibalik_oleh|dibalik_pada|dikunci_oleh|dikunci_pada|pengaman|status_ptkp)$")
KOLOM_HITUNG = re.compile(r"^(nilai_perolehan|residu|garansi_bulan|garansi_sampai|masa_manfaat_bulan|dasar_n|n|d|terakhir|persen_residu|beban|akumulasi|nilai_buku|"
                          r"harga_jual|laba_rugi|total_beban|saldo_buku|nilai_sisa|jumlah|gaji_pokok|tunj_.*|potongan_absen|bruto|bruto_setahun|biaya_jabatan|neto_setahun|ptkp|pkp|pph_setahun|pph21|thp|"
                          r"total_bruto|total_pph|total_thp|jumlah_slip|hari_kerja|jumlah_presensi|hadir|izin|sakit|cuti|alpa|jam_kerja|terlambat_menit|terlambat|nominal|debit|kredit)$")


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
    cmd = ["docker", "exec", "sia-dpro-pg", "psql", "-U", "sia", "-d", "sia_dpro", "-Atc",
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
        if induk in TANPA_GARIS and info["tabel"] not in TANPA_GARIS[induk]:
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
# Tata letak manual (koordinat poin cetak). Kolom: (x, [(tabel, jarak_sebelum)], y_awal)
# ----------------------------------------------------------------------------------------------
LEBAR_KANVAS, TINGGI_KANVAS = 785.0, 452.0
LEBAR_ISI = float(os.environ.get("LEBAR_ISI", 70))
LEBAR_KOLOM = {k: w - 2 * PAD for k, w in enumerate([80, 96, 90, 91, 90, 84, 89])}   # kolom ke-n boleh lebih lebar supaya kotak yang tinggi tidak terlalu panjang
Y0 = 22.0
TATA = {
    # kolom dari kiri ke kanan; tiap kolom ditumpuk ke bawah. gutter[i] = jarak kolom i ke kolom i+1.
    "kolom": [
        ["supplier", "kategori_aset", "peralatan", "perlengkapan", "detail_opname"],
        ["pembelian", "detail_pembelian", "aset"],
        ["jadwal_penyusutan", "pelepasan", "opname"],
        ["periode", "riwayat_periode", "jurnal", "detail_jurnal", "akun"],
        ["penggajian", "slip_gaji", "slip_tunjangan"],
        ["karyawan", "jabatan", "jadwal_kerja", "golongan", "tunjangan"],
        ["presensi", "setting_gaji", "setting_tunjangan"],
    ],
    "gutter": [22, 24, 38, 26, 24, 22],
    "gap": 9,
    "gap_hubung": 17,
    "bawah": ["pengguna", "sesi", "log_aktivitas", "profil_usaha", "penghitung"],
}


def terhubung(model, a, b):
    for info in model.values():
        for r in info["relasi"]:
            if {info["tabel"], model[r["induk"]]["tabel"]} == {a, b}:
                return True
    return False


def hitung_posisi(model, t2i):
    isi = {}
    for k, tabs in enumerate(TATA["kolom"]):
        for t in tabs:
            isi[t] = isi_kotak(t2i[t], model, LEBAR_KOLOM.get(k, LEBAR_ISI))
    for t in TATA["bawah"]:
        isi[t] = isi_kotak(t2i[t], model, 85)
    uk = {t: ukuran_kotak(t, isi[t]) for t in t2i}
    pos = {}
    x = 7.0
    bawah_maks = 0
    for k, tabs in enumerate(TATA["kolom"]):
        lebar = max(uk[t][0] for t in tabs)
        y = Y0
        for n, t in enumerate(tabs):
            pos[t] = [x, y, lebar, uk[t][1]]   # semua kotak sekolom selebar kolom
            sel = TATA["gap_hubung"] if n + 1 < len(tabs) and terhubung(model, t, tabs[n + 1]) else TATA["gap"]
            y += uk[t][1] + sel
            gapterakhir = sel
        bawah_maks = max(bawah_maks, y - gapterakhir)
        x += lebar + (TATA["gutter"][k] if k < len(TATA["gutter"]) else 0)
    print(f"lebar terpakai {x:.0f} dari {LEBAR_KANVAS:.0f}; kolom terbawah {bawah_maks:.0f}")
    xx = 7.0; yb = bawah_maks + 20
    for t in TATA["bawah"]:
        pos[t] = [xx, yb, uk[t][0], uk[t][1]]
        xx += uk[t][0] + 10
    TATA["x_legenda"] = xx + 6
    TATA["y_legenda"] = yb - 2
    return isi, uk, pos


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
    elif jenis == "nol_banyak":
        for sgn in (-3.2, 0, 3.2):
            svg.garis([P(0, sgn), P(5.0, 0)], warna, 0.7)
        svg.circle(*P(7.2), 1.8, "#FFFFFF", warna, 0.7)


def arah_sisi(sisi):
    return {"L": (-1, 0), "R": (1, 0), "T": (0, -1), "B": (0, 1)}[sisi]


def gambar(model, t2i, path_svg, path_png):
    isi, uk, pos = hitung_posisi(model, t2i)
    W, H = LEBAR_KANVAS, TINGGI_KANVAS
    svg = Svg(W, H)
    # kelompok
    grp = {}
    for kode, judul, warna, tabs in KELOMPOK:
        x0 = min(pos[t][0] for t in tabs) - 5; y0 = min(pos[t][1] for t in tabs) - 13
        x1 = max(pos[t][0] + pos[t][2] for t in tabs) + 5; y1 = max(pos[t][1] + pos[t][3] for t in tabs) + 5
        grp[kode] = (x0, y0, x1 - x0, y1 - y0)
        svg.rect(x0, y0, x1 - x0, y1 - y0, warna, "#9a9a9a", 0.6, 4)
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
    garis = []
    for info in model.values():
        for r in info["relasi"]:
            induk = model[r["induk"]]["tabel"]
            if induk in TANPA_GARIS and info["tabel"] not in TANPA_GARIS[induk]:
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
            hasil.append((a, b, r, pts, "R", "R"))
            continue
        try:
            d = langsung(a, b)
            pts, sisi_a, sisi_b = d if d else rt.rute(tuple(pos[a]), tuple(pos[b]), tangkai=10.0)
        except RuntimeError as e:
            print("GAGAL rute", a, b, e); continue
        hasil.append((a, b, r, pts, sisi_a, sisi_b))
    warna_grup = {"konv": "#9C2F25", "sdm": "#1B5E94", "lap": "#6B5B00", "sis": "#2F6B2A"}
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
        simbol(svg, pts[0], arah_sisi(sa), "nol_satu" if r["unik"] else "nol_banyak", wr(a))
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
                    if any(_potong(kotak, s0, s1) for _, _, _, pp, _, _ in hasil for s0, s1 in zip(pp, pp[1:])):
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
    legenda(svg, W, H)
    svg.simpan(path_svg, path_png)
    return pos, grp, hasil


def legenda(svg, W, H):
    x, y = TATA["x_legenda"], TATA["y_legenda"]
    lebar_box = W - x - 6
    svg.rect(x, y, lebar_box, 4 * LH + 19.5 + 16, "#FFFFFF", "#9a9a9a", 0.6, 3)
    svg.teks(x + 5, y + 9.5, [("Keterangan", "b")], 7.4)
    baris = [
        [("PK", "b"), (" kunci utama, ", "r"), ("FK", "b"), (" kunci tamu. Garis menghubungkan FK ke tabel induknya; FK ke ", "r"), ("pengguna", "b"), (" dan ", "r"), ("akun", "b")],
        [("hanya ditulis di kolom (", "r"), ("\u2192", "r"), (" nama tabel), tanpa garis, supaya gambar tetap terbaca.", "r")],
        [("status", "b"), (" tebal: status persetujuan dan aktif. ", "r"), ("miring", "i"), (": atribut perhitungan (penyusutan, gaji, PPh 21).", "r")],
        [("Kolom stempel waktu audit (dibuat_pada, diubah_pada, diajukan_pada, dst.) tidak digambar.", "r")],
    ]
    yy = y + 19.5
    for b in baris:
        svg.teks(x + 5, yy, b, UK); yy += LH
    # contoh simbol kardinalitas
    xs = x + 14; ys = yy + 5
    contoh = [("satu", "tepat satu (1)"), ("nol_satu", "nol atau satu (0..1)"), ("nol_banyak", "nol atau banyak (0..N)")]
    for jenis, ket in contoh:
        svg.garis([(xs, ys), (xs + 16, ys)], "#444", 0.7)
        simbol(svg, (xs + 16, ys), (-1, 0), jenis, "#444")
        svg.teks(xs + 21, ys + 2.3, ket, UK)
        xs += 21 + lebar_teks(ket, UK) + 14


def tulis_mermaid(model, path):
    """Versi teks portabel (Mermaid erDiagram): semua tabel, semua kolom, dan semua 68 relasi FK tanpa pengecualian."""
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
            kanan = "o|" if r["unik"] else "o{"
            o.append(f"  {model[r['induk']]['tabel']} {kiri}--{kanan} {info['tabel']} : \"{', '.join(info['nm2db'][k] for k in r['kol'])}\"")
    open(path, "w", encoding="utf-8").write("\n".join(o) + "\n")


if __name__ == "__main__":
    model = baca_skema(SKEMA)
    t2i = {m["tabel"]: m for m in model.values()}
    ada = {t for _, _, _, ts in KELOMPOK for t in ts}
    assert ada == set(t2i), f"tabel di luar kelompok: {ada ^ set(t2i)}"
    ok = cek_db(t2i) if "--cek-db" in sys.argv else True
    pos, grp, hasil = gambar(model, t2i, os.path.join(KELUAR, "logical-database.svg"), os.path.join(KELUAR, "logical-database.png"))
    tulis_mermaid(model, os.path.join(KELUAR, "logical-database.mmd"))
    print(f"{len(t2i)} tabel; {len(hasil)} garis; kanvas {LEBAR_KANVAS}x{TINGGI_KANVAS} pt")
    print("OK" if ok else "TIDAK COCOK dengan database")
