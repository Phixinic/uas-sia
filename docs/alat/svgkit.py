"""Alat gambar bersama untuk diagram dokumentasi: ukuran teks (Helvetica), pembangun SVG, dan perute garis ortogonal.

Satuan koordinat SVG = poin cetak. Kanvas dibuat seukuran area cetak di laporan, jadi ukuran font di sini
sama dengan ukuran huruf tercetak (tanpa pengecilan) selama gambar dipasang 100%.
"""
import heapq, subprocess, html
from PIL import ImageFont

_FONT = "/System/Library/Fonts/Helvetica.ttc"
_IDX = {"r": 0, "b": 1, "i": 2, "bi": 3}
_cache = {}


def _font(style):
    if style not in _cache:
        _cache[style] = ImageFont.truetype(_FONT, 200, index=_IDX[style])
    return _cache[style]


def lebar_teks(teks, ukuran, gaya="r"):
    return _font(gaya).getlength(teks) * ukuran / 200.0


def lebar_segmen(segmen, ukuran):
    return sum(lebar_teks(t, ukuran, g) for t, g in segmen)


def esc(s):
    return html.escape(s, quote=True)


class Svg:
    def __init__(self, w, h, latar="#FFFFFF"):
        self.w, self.h = w, h
        self.o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}pt" height="{h}pt" viewBox="0 0 {w} {h}" font-family="Helvetica, Arial, sans-serif">',
                  f'<rect x="0" y="0" width="{w}" height="{h}" fill="{latar}"/>']

    def rect(self, x, y, w, h, fill="none", stroke="none", sw=0.6, rx=0, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.o.append(f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}/>')

    def ellipse(self, cx, cy, rx, ry, fill="none", stroke="none", sw=0.6, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.o.append(f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="{rx:.2f}" ry="{ry:.2f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}/>')

    def circle(self, cx, cy, r, fill="none", stroke="none", sw=0.6):
        self.ellipse(cx, cy, r, r, fill, stroke, sw)

    def garis(self, pts, stroke="#444", sw=0.6, dash=None, fill="none"):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        p = " ".join(f"{x:.2f},{y:.2f}" for x, y in pts)
        self.o.append(f'<polyline points="{p}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"{d}/>')

    def poligon(self, pts, fill="none", stroke="#444", sw=0.6):
        p = " ".join(f"{x:.2f},{y:.2f}" for x, y in pts)
        self.o.append(f'<polygon points="{p}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"/>')

    def teks(self, x, y, segmen, ukuran, warna="#111", anchor="start", putar=None):
        """segmen: str, atau daftar (teks, gaya) dengan gaya r/b/i/bi. y = garis dasar."""
        if isinstance(segmen, str):
            segmen = [(segmen, "r")]
        ts = []
        for t, g in segmen:
            w = "bold" if "b" in g else "normal"
            s = "italic" if "i" in g else "normal"
            ts.append(f'<tspan font-weight="{w}" font-style="{s}">{esc(t)}</tspan>')
        tr = f' transform="rotate({putar} {x:.2f} {y:.2f})"' if putar else ""
        self.o.append(f'<text x="{x:.2f}" y="{y:.2f}" font-size="{ukuran}" fill="{warna}" text-anchor="{anchor}" xml:space="preserve"{tr}>{"".join(ts)}</text>')

    def simpan(self, path_svg, path_png=None, dpi=300):
        isi = "\n".join(self.o + ["</svg>"])
        open(path_svg, "w", encoding="utf-8").write(isi)
        if path_png:
            subprocess.run(["rsvg-convert", "-d", str(dpi), "-p", str(dpi), "-o", path_png, path_svg], check=True)


class Perute:
    """Perute ortogonal di atas grid g poin. Kotak = penghalang. Garis boleh bersilangan, tetapi bersilangan
    dan berimpit dikenai biaya, jadi hasilnya cenderung rapi."""

    def __init__(self, w, h, g=2.5):
        self.g = g
        self.nx, self.ny = int(w / g) + 1, int(h / g) + 1
        self.blok = [[False] * self.nx for _ in range(self.ny)]
        self.dekat = [[0] * self.nx for _ in range(self.ny)]
        self.hor = [[0] * self.nx for _ in range(self.ny)]
        self.ver = [[0] * self.nx for _ in range(self.ny)]
        self.ujung = []  # titik ujung terpakai (cx, cy)
        for j in range(self.ny):
            for i in range(self.nx):
                if i < 2 or j < 2 or i >= self.nx - 2 or j >= self.ny - 2:
                    self.blok[j][i] = True
        self.simbol = set()  # sel yang tertutup simbol kardinalitas garis yang sudah dirutekan

    def sel_simbol(self, titik, arah, dalam=11.5, lebar=4.5):
        """Sel di depan sebuah ujung garis yang ditempati simbol kardinalitas (dan celah di sekitarnya)."""
        (ex, ey), (ux, uy) = titik, arah
        vx, vy = -uy, ux
        hasil = set()
        d = 0.0
        while d <= dalam:
            s = -lebar
            while s <= lebar:
                hasil.add(self.c(ex + ux * d + vx * s, ey + uy * d + vy * s))
                s += self.g / 2
            d += self.g / 2
        return hasil

    def daftarkan_simbol(self, titik, arah):
        self.simbol |= self.sel_simbol(titik, arah)

    def _port_bebas(self, p):
        """Port ditolak bila simbolnya akan menimpa garis lain atau simbol lain."""
        _, (dx, dy), (ex, ey), _, _ = p
        for (i, j) in self.sel_simbol((ex, ey), (dx, dy), 9.5, 3.5):
            if not (0 <= i < self.nx and 0 <= j < self.ny):
                return False
            if self.hor[j][i] or self.ver[j][i] or (i, j) in self.simbol:
                return False
        return True

    def c(self, x, y):
        return int(round(x / self.g)), int(round(y / self.g))

    def p(self, cx, cy):
        return cx * self.g, cy * self.g

    def blok_rect(self, x, y, w, h, margin=0.0, biaya=0):
        x0, y0 = self.c(x - margin, y - margin)
        x1, y1 = self.c(x + w + margin, y + h + margin)
        for j in range(max(y0, 0), min(y1, self.ny - 1) + 1):
            for i in range(max(x0, 0), min(x1, self.nx - 1) + 1):
                self.blok[j][i] = True

    def tandai_dekat(self, x, y, w, h, jarak=2):
        x0, y0 = self.c(x, y); x1, y1 = self.c(x + w, y + h)
        for j in range(max(y0 - jarak, 0), min(y1 + jarak, self.ny - 1) + 1):
            for i in range(max(x0 - jarak, 0), min(x1 + jarak, self.nx - 1) + 1):
                if not self.blok[j][i]:
                    self.dekat[j][i] = 3

    def _port(self, kotak, tangkai):
        """Daftar titik awal: (cell_awal, arah_keluar, titik_tepi). Titik awal berjarak `tangkai` poin dari tepi kotak."""
        x, y, w, h = kotak
        n = max(1, int(round(tangkai / self.g)))
        out = []
        g = self.g
        # sisi kiri/kanan/atas/bawah, tiap g poin, sisakan 4 poin dari sudut
        yy = y + 4
        while yy <= y + h - 4:
            cy = int(round(yy / g))
            for sisi, (ex, dx) in (("L", (x, -1)), ("R", (x + w, 1))):
                cx0 = int(round(ex / g))
                out.append(((cx0 + dx * n, cy), (dx, 0), (ex, cy * g), sisi, cy))
            yy += g
        xx = x + 4
        while xx <= x + w - 4:
            cx = int(round(xx / g))
            for sisi, (ey, dy) in (("T", (y, -1)), ("B", (y + h, 1))):
                cy0 = int(round(ey / g))
                out.append(((cx, cy0 + dy * n), (0, dy), (cx * g, ey), sisi, cx))
            xx += g
        return out

    def _lorong_bebas(self, p, kotak_cell, tangkai):
        (cx, cy), (dx, dy), (ex, ey), sisi, _ = p
        n = max(1, int(round(tangkai / self.g)))
        for k in range(n):
            i, j = cx - dx * k, cy - dy * k
            if not (0 <= i < self.nx and 0 <= j < self.ny) or self.blok[j][i]:
                return False
        return True

    def rute(self, ka, kb, tangkai=10.0, tekuk=7, tumpang=28, silang=6, penalti_simbol=400):
        awal = [p for p in self._port(ka, tangkai) if self._lorong_bebas(p, None, tangkai) and not self._ujung_dekat(p[2])]
        akhir = [p for p in self._port(kb, tangkai) if self._lorong_bebas(p, None, tangkai) and not self._ujung_dekat(p[2])]
        awal = [p for p in awal if self._port_bebas(p)] or awal
        akhir = [p for p in akhir if self._port_bebas(p)] or akhir
        if not awal or not akhir:
            raise RuntimeError("tidak ada port bebas")
        tujuan = {}
        for p in akhir:
            tujuan[(p[0], p[1])] = p  # sel akhir dan arah masuk (berlawanan dengan arah keluar)
        # A*
        tx = [p[0] for p in akhir]
        gx = (min(t[0] for t in tx), max(t[0] for t in tx)); gy = (min(t[1] for t in tx), max(t[1] for t in tx))

        def h(c):
            dx = 0 if gx[0] <= c[0] <= gx[1] else min(abs(c[0] - gx[0]), abs(c[0] - gx[1]))
            dy = 0 if gy[0] <= c[1] <= gy[1] else min(abs(c[1] - gy[0]), abs(c[1] - gy[1]))
            return dx + dy

        antri = []
        jejak = {}
        biaya = {}
        for p in awal:
            s = (p[0], p[1])  # arah di sel awal = arah keluar
            biaya[s] = 0
            heapq.heappush(antri, (h(p[0]), 0, s, p))
        selesai = None
        while antri:
            f, gc, s, _p = heapq.heappop(antri)
            if gc > biaya.get(s, 1e18):
                continue
            c, d = s
            # sampai: sel akhir, arah masuk = -arah keluar port tujuan
            for (tc, td), pt in tujuan.items():
                if c == tc and d == (-td[0], -td[1]):
                    selesai = (s, pt); break
            if selesai:
                break
            for nd in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if nd == (-d[0], -d[1]):
                    continue
                ni, nj = c[0] + nd[0], c[1] + nd[1]
                if not (0 <= ni < self.nx and 0 <= nj < self.ny) or self.blok[nj][ni]:
                    continue
                b = 1
                if (ni, nj) in self.simbol:
                    b += penalti_simbol
                if nd != d:
                    b += tekuk
                horiz = nd[1] == 0
                b += self.dekat[nj][ni]
                if horiz:
                    if self.hor[nj][ni]: b += tumpang
                    if self.ver[nj][ni]: b += silang
                    if nj > 0 and self.hor[nj - 1][ni]: b += 4
                    if nj < self.ny - 1 and self.hor[nj + 1][ni]: b += 4
                else:
                    if self.ver[nj][ni]: b += tumpang
                    if self.hor[nj][ni]: b += silang
                    if ni > 0 and self.ver[nj][ni - 1]: b += 4
                    if ni < self.nx - 1 and self.ver[nj][ni + 1]: b += 4
                ns = ((ni, nj), nd)
                nc = gc + b
                if nc < biaya.get(ns, 1e18):
                    biaya[ns] = nc; jejak[ns] = s
                    heapq.heappush(antri, (nc + h((ni, nj)), nc, ns, None))
        if not selesai:
            raise RuntimeError("rute tidak ditemukan")
        s, pt_akhir = selesai
        sel = []
        cur = s
        while cur in jejak:
            sel.append(cur[0]); cur = jejak[cur]
        sel.append(cur[0])
        sel.reverse()
        pt_awal = next(p for p in awal if (p[0], p[1]) == cur)
        # tandai pemakaian
        for a, b_ in zip(sel, sel[1:]):
            if a[1] == b_[1]:
                self.hor[a[1]][a[0]] = self.hor[b_[1]][b_[0]] = 1
            else:
                self.ver[a[1]][a[0]] = self.ver[b_[1]][b_[0]] = 1
        for p in (pt_awal, pt_akhir):
            self.ujung.append(p[2])
        # polyline titik sudut
        pts = [pt_awal[2]] + [self.p(*c) for c in sel] + [pt_akhir[2]]
        return simpan_sudut(pts), pt_awal[3], pt_akhir[3]

    def tandai_polyline(self, pts):
        for p, q in zip(pts, pts[1:]):
            (i0, j0), (i1, j1) = self.c(*p), self.c(*q)
            if j0 == j1:
                for i in range(min(i0, i1), max(i0, i1) + 1):
                    self.hor[j0][i] = 1
            else:
                for j in range(min(j0, j1), max(j0, j1) + 1):
                    self.ver[j][i0] = 1

    def _ujung_dekat(self, titik, jarak=4.6):
        return any(abs(titik[0] - u[0]) < jarak and abs(titik[1] - u[1]) < jarak for u in self.ujung)


def simpan_sudut(pts):
    """Buang titik yang segaris."""
    out = [pts[0]]
    for i in range(1, len(pts) - 1):
        a, b, c = out[-1], pts[i], pts[i + 1]
        if (abs(a[0] - b[0]) < 1e-6 and abs(b[0] - c[0]) < 1e-6) or (abs(a[1] - b[1]) < 1e-6 and abs(b[1] - c[1]) < 1e-6):
            continue
        out.append(b)
    out.append(pts[-1])
    return out
