#!/usr/bin/env python3
"""Membangkitkan docs/sitemap.{svg,png} dari src/lib/menu.ts (grup sidebar dan halaman) dan DEF_MASTER di src/lib/skema/master.ts (tab master).

Pemakaian (dari akar repo):  python3 docs/alat/buat_sitemap.py
Kanvas = ukuran cetak (poin) di laporan: huruf di sini = huruf tercetak.
"""
import os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from svgkit import Svg, lebar_teks

AKAR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
W, H = 785.0, 440.0
WARNA = {"ringkasan": "#EEEEEE", "konversi": "#FDE7E4", "sdm": "#E3EFFA", "pelaporan": "#FFF3C4", "pengaturan": "#E6F2E4"}
GARIS = {"ringkasan": "#555555", "konversi": "#8B1A1A", "sdm": "#1F5F99", "pelaporan": "#8A6D00", "pengaturan": "#2E6B3A"}


def baca_menu():
    t = open(os.path.join(AKAR, "src", "lib", "menu.ts"), encoding="utf-8").read()
    t = t[t.index("export const MENU"):]
    awal = [(m.start(), m.group(1), m.group(2)) for m in re.finditer(r'kunci:\s*"(\w+)",\s*judul:\s*"([^"]+)"', t)]
    grup = []
    for i, (pos, kunci, judul) in enumerate(awal):
        potong = awal[i + 1][0] if i + 1 < len(awal) else len(t)
        bagian = t[pos:potong]
        tautan = [(h, l, "OWNER" in (p or "")) for h, l, p in re.findall(r'href:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*ikon:\s*"[^"]+"(?:,\s*peran:\s*\[([^\]]*)\])?\s*\}', bagian)]
        grup.append((kunci, judul, tautan))
    return grup


def baca_tab_master():
    t = open(os.path.join(AKAR, "src", "lib", "skema", "master.ts"), encoding="utf-8").read()
    tab = {"konversi": [], "sdm": []}
    for m in re.finditer(r'jenis:\s*"\w+",\s*label:\s*"([^"]+)",\s*kelompok:\s*"(\w+)"', t):
        tab[m.group(2)].append(m.group(1))
    return tab


def kotak(svg, x, y, w, h, teks, ukuran, fill, stroke, tebal=False, putus=False, sw=0.8, rx=3, warna="#111"):
    svg.rect(x, y, w, h, fill, stroke, sw, rx, dash="3 2" if putus else None)
    svg.teks(x + w / 2, y + h / 2 + ukuran * 0.34, [(teks, "b" if tebal else "r")], ukuran, warna, "middle")


def main():
    grup = baca_menu()
    tab = baca_tab_master()
    assert len(grup) == 5, grup
    svg = Svg(W, H)
    UK, UK_H, UK_T = 9.2, 10.4, 8.6
    # akar
    rw = 150
    rx0 = (W - rw) / 2
    kotak(svg, rx0, 6, rw, 24, "SIA D’Production", 10.5, "#8B1A1A", "#8B1A1A", True, warna="#FFFFFF")
    # halaman masuk (publik) di kiri atas
    mw = 128
    mx = 14
    kotak(svg, mx, 6, mw, 24, "Masuk (halaman publik)", UK, "#FFFFFF", "#444", False)
    svg.garis([(rx0, 18), (mx + mw, 18)], "#555", 0.9)
    svg.teks(mx + mw / 2, 41, "/masuk", 7.5, "#666", "middle")
    # pembatas "setelah masuk"
    ax = rx0 + rw + 24
    svg.teks(ax, 22, [("Setelah masuk, pengguna tiba di Dashboard. Keluar tersedia di bilah atas.", "i")], 8.0, "#444")
    svg.garis([(rx0 + rw / 2, 30), (rx0 + rw / 2, 54)], "#555", 0.9)
    # kolom grup
    n = len(grup)
    margin = 8.0
    jar = 10.0
    lebar_kol = (W - 2 * margin - (n - 1) * jar) / n
    yb = 54.0
    svg.garis([(margin + lebar_kol / 2, yb), (W - margin - lebar_kol / 2, yb)], "#555", 0.9)
    for i, (kunci, judul, tautan) in enumerate(grup):
        x0 = margin + i * (lebar_kol + jar)
        cx = x0 + lebar_kol / 2
        svg.garis([(cx, yb), (cx, yb + 10)], "#555", 0.9)
        hy = yb + 10
        kotak(svg, x0, hy, lebar_kol, 24, judul, UK_H, WARNA[kunci], GARIS[kunci], True, sw=1.1)
        batang = x0 + 8
        ix = x0 + 17
        iw = lebar_kol - 17
        y = hy + 24 + 8
        akhir = y
        for href, label, owner in tautan:
            nm = label + (" (Owner)" if owner else "")
            ih = 27
            svg.garis([(batang, y + ih / 2), (ix, y + ih / 2)], "#777", 0.8)
            svg.rect(ix, y, iw, ih, "#FFFFFF", GARIS[kunci], 0.9, 3)
            svg.teks(ix + iw / 2, y + 11.2, nm, UK, "#111", "middle")
            svg.teks(ix + iw / 2, y + 21.4, href, 7.5, "#666", "middle")
            akhir = y + ih / 2
            y += ih
            subs = []
            if label == "Master Konversi":
                subs = tab["konversi"] + ["Profil usaha (Owner)"]
            elif label == "Master SDM":
                subs = tab["sdm"]
            elif label == "Presensi":
                subs = ["Rekap", "Harian"]
            if subs:
                tb = ix + 9
                tx = ix + 17
                tw = iw - 17
                ty = y + 3
                for sname in subs:
                    th = 14
                    svg.garis([(tb, ty + th / 2), (tx, ty + th / 2)], "#999", 0.7)
                    kotak(svg, tx, ty, tw, th, sname, UK_T, "#F7F7F7", "#888", False, True, 0.7, 2.5)
                    ty += th + 2.5
                svg.garis([(tb, y), (tb, ty - 2.5 - 14 / 2)], "#999", 0.7)
                y = ty + 1
            y += 8
        svg.garis([(batang, hy + 24), (batang, akhir)], "#777", 0.8)
    # keterangan
    ly = H - 9
    svg.rect(10, ly - 9, 20, 11, "#FFFFFF", "#555", 0.9, 3); svg.teks(35, ly, "halaman (menu samping)", 8.0, "#333")
    x2 = 35 + lebar_teks("halaman (menu samping)", 8.0) + 16
    svg.rect(x2, ly - 9, 20, 11, "#F7F7F7", "#888", 0.7, 3, dash="3 2"); svg.teks(x2 + 25, ly, "tab atau bagian di dalam halaman", 8.0, "#333")
    x3 = x2 + 25 + lebar_teks("tab atau bagian di dalam halaman", 8.0) + 16
    svg.teks(x3, ly, "Semua peran membuka semua halaman kecuali Pengguna; tombol aksi dibatasi per peran.", 8.0, "#333")
    d = os.path.join(AKAR, "docs")
    svg.simpan(os.path.join(d, "sitemap.svg"), os.path.join(d, "sitemap.png"))
    print("sitemap:", sum(len(t[2]) for t in grup), "halaman di", n, "grup; kanvas", W, "x", H, "pt")


if __name__ == "__main__":
    main()
