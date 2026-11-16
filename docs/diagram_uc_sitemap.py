"""Pembuat use-case.png dan sitemap.png (matplotlib). Jalankan: python3 diagram_uc_sitemap.py"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Ellipse, FancyBboxPatch, Circle

RED = "#8B1A1A"; GRAY = "#5a5a5a"
plt.rcParams["font.family"] = "Helvetica"

# Tata letak use case (koordinat dalam satuan gambar). Dicari dengan pencarian tata letak
# supaya garis aktor tidak bersilangan dan tidak menembus elips lain.
UC_SIKLUS = {"k": "#FFE9E6", "s": "#E3EFFA", "l": "#FFF4CC"}
UC_ITEMS = {  # kunci: (label, siklus, aktor, x, y)
 "draf": ("Kelola draf pembelian\nperalatan, perlengkapan", "k", "A", 4.8, 10.7),
 "posting": ("Posting pembelian", "k", "AO", 11.2, 5.6),
 "jadwal": ("Buat jadwal penyusutan\nper unit aset", "k", "", 4.8, 5.6),
 "balik": ("Balik pembelian\n(jurnal pembalik)", "k", "O", 11.2, 4.75),
 "sisa": ("Input nilai sisa\nperlengkapan", "k", "A", 8.0, 9.85),
 "susut": ("Proses penyusutan\nbulanan", "k", "A", 14.4, 12.2),
 "drafjp": ("Buat draf jurnal\npenyesuaian", "l", "", 11.2, 10.7),
 "ajulepas": ("Ajukan pelepasan\nperalatan", "k", "A", 4.8, 6.45),
 "setlepas": ("Setujui atau tolak\npelepasan peralatan", "k", "O", 11.2, 3.9),
 "kartu": ("Lihat kartu aset", "k", "AO", 11.2, 7.3),
 "presensi": ("Input presensi harian", "s", "H", 4.8, 3.9),
 "gaji": ("Hitung gaji dan PPh 21\n(slip draf)", "s", "H", 4.8, 1.35),
 "dist": ("Ajukan distribusi\nbeban gaji", "s", "H", 4.8, 3.05),
 "setgaji": ("Setujui atau tolak\npenggajian", "s", "O", 11.2, 1.35),
 "msdm": ("Kelola master SDM", "s", "HO", 4.8, 4.75),
 "ajujp": ("Ajukan jurnal\npenyesuaian", "l", "A", 8.0, 9.0),
 "setjp": ("Setujui atau tolak\njurnal penyesuaian", "l", "O", 11.2, 3.05),
 "ju": ("Lihat Jurnal Umum,\nBuku Besar, Neraca Saldo", "l", "P", 4.8, 11.6),
 "dash": ("Lihat dashboard", "l", "P", 4.8, 12.7),
 "mkonv": ("Kelola master konversi", "k", "AO", 11.2, 8.15),
 "kunci": ("Kunci atau buka periode", "l", "O", 11.2, 6.45),
 "kat": ("Kelola kategori aset\ndan bagan akun", "l", "O", 14.4, 9.0),
 "profil": ("Ubah profil usaha,\nnonaktifkan data master", "l", "O", 14.4, 2.2),
}
UC_ACTORS = {"A": ("Admin", 1.7, 9.04, "#8B1A1A"), "H": ("HRD", 1.0, 3.92, "#1F5F99"),
             "O": ("Owner", 17.6, 5.55, "#2E6B3A"), "P": ("Semua peran (Admin, HRD, Owner)", 1.1, 13.6, "#555555")}

def uc_diagram():
    import math
    from matplotlib.patches import Polygon
    W, H = 18.8, 16.9
    EW, EH = 3.2, 0.64
    fig = plt.figure(figsize=(W*0.5, H*0.5), dpi=330)
    ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, W); ax.set_ylim(-0.8, H-0.5); ax.axis("off")
    ax.text(W/2, H-1.0, "Use case SIA D'Production: siklus konversi, siklus SDM, dan pelaporan",
            ha="center", va="center", fontsize=12.5, fontweight="bold", color=RED)
    ax.add_patch(FancyBboxPatch((3.0, 0.45), 13.0, 13.55, boxstyle="round,pad=0.02,rounding_size=0.15",
                                fc="#FFFDFC", ec=RED, lw=1.2, zorder=0))
    ax.text(15.8, 13.75, "Sistem Informasi Akuntansi D'Production", ha="right", va="center", fontsize=9.5, color=RED, style="italic")
    def clip(p, c):
        dx, dy = p[0]-c[0], p[1]-c[1]
        k = 1/math.sqrt((dx/(EW/2))**2 + (dy/(EH/2))**2)
        return (c[0]+dx*k, c[1]+dy*k)
    pos = {k: (v[3], v[4]) for k, v in UC_ITEMS.items()}
    def arrow_head(p, q, filled=False, size=0.28):
        # segitiga berongga di ujung q, arah dari p
        d = math.atan2(q[1]-p[1], q[0]-p[0]); a = 0.45
        pts = [q, (q[0]-size*math.cos(d-a), q[1]-size*math.sin(d-a)), (q[0]-size*math.cos(d+a), q[1]-size*math.sin(d+a))]
        ax.add_patch(Polygon(pts, closed=True, fc="#222" if filled else "white", ec="#222", lw=1.0, zorder=6))
    # garis aktor ke use case
    for k, (lab, sk, akt, x, y) in UC_ITEMS.items():
        for a in akt:
            nm, ax_, ay_, col = UC_ACTORS[a]
            s = (ax_ + (0.35 if a in "A" else (-0.35 if a == "O" else (0.35 if a == "P" else 0.0))), ay_ - 0.2 if a == "P" else ay_)
            if a == "H": s = (ax_+0.35, ay_)
            e = clip(s, (x, y))
            ax.plot([s[0], e[0]], [s[1], e[1]], color=col, lw=1.15, zorder=2)
    # generalisasi Admin dan HRD ke "Semua peran" (garis lurus), Owner lewat tepi atas
    px, py = UC_ACTORS["P"][1], UC_ACTORS["P"][2]
    for a, tip in (("A", (px+0.12, py-0.95)), ("H", (px-0.12, py-0.95))):
        nm, ax_, ay_, col = UC_ACTORS[a]
        s = (ax_, ay_+0.75)
        ax.plot([s[0], tip[0]], [s[1], tip[1]], color=col, lw=1.15, zorder=2)
        arrow_head(s, tip)
    nm, ox, oy, ocol = UC_ACTORS["O"]
    topy = py + 1.45
    ax.plot([ox, ox, px, px], [oy+0.8, topy, topy, py+0.95], color=ocol, lw=1.15, zorder=2)
    arrow_head((px, topy), (px, py+0.95))
    # include dan extend
    def dashed(a, b, label, sub=None, side=0.0):
        s = clip(pos[b], pos[a]); e = clip(pos[a], pos[b])
        ax.annotate("", xy=e, xytext=s, arrowprops=dict(arrowstyle="->", ls="--", color="#222", lw=1.1), zorder=5)
        mx, my = (s[0]+e[0])/2 + side, (s[1]+e[1])/2
        ax.text(mx, my, label if not sub else label+"\n"+sub, fontsize=7.8, ha="center", va="center", zorder=7,
                bbox=dict(fc="white", ec="none", pad=0.6), linespacing=1.1)
    dashed("jadwal", "posting", "«extend»", "[jenis = peralatan]")
    dashed("susut", "drafjp", "«include»", side=0.0)
    dashed("sisa", "drafjp", "«include»", side=0.0)
    # elips
    for k, (lab, sk, akt, x, y) in UC_ITEMS.items():
        ax.add_patch(Ellipse((x, y), EW, EH, fc=UC_SIKLUS[sk], ec="#444444", lw=1.0, zorder=3))
        ax.text(x, y, lab, ha="center", va="center", fontsize=8.3, zorder=4, linespacing=1.1)
    # aktor
    for a, (nm, x, y, col) in UC_ACTORS.items():
        c = col
        ax.add_patch(Circle((x, y+0.55), 0.17, fc="white", ec=c, lw=1.3, zorder=6))
        ax.plot([x, x], [y+0.38, y-0.1], color=c, lw=1.3, zorder=6)
        ax.plot([x-0.3, x+0.3], [y+0.25, y+0.25], color=c, lw=1.3, zorder=6)
        ax.plot([x, x-0.25], [y-0.1, y-0.5], color=c, lw=1.3, zorder=6)
        ax.plot([x, x+0.25], [y-0.1, y-0.5], color=c, lw=1.3, zorder=6)
        if a == "P":
            ax.text(x+0.55, y+1.02, nm, ha="left", va="center", fontsize=8.5, fontweight="bold", zorder=6, color=c)
        else:
            ax.text(x, y-0.85, nm, ha="center", va="center", fontsize=10, fontweight="bold", zorder=6, color=c)
    # legenda warna
    lx = 3.2
    for sk, t in (("k", "Siklus konversi"), ("s", "Siklus SDM"), ("l", "Pelaporan dan pengaturan")):
        ax.add_patch(Ellipse((lx, -0.15), 0.5, 0.28, fc=UC_SIKLUS[sk], ec="#444", lw=0.9))
        ax.text(lx+0.4, -0.15, t, fontsize=8.5, va="center"); lx += 3.4
    ax.text(3.2, -0.5, "Garis tiap aktor punya warna sendiri. Segitiga kosong: Admin, HRD, dan Owner sama-sama membuka dashboard dan laporan jurnal.", fontsize=7.8, va="center", color="#444")
    fig.savefig("use-case.png"); plt.close(fig)

TABS = {
  "Master Konversi": ["Supplier", "Peralatan", "Perlengkapan", "Kategori aset", "Bagan akun"],
  "Master SDM": ["Karyawan", "Jabatan", "Gaji pokok", "Tunjangan", "Jadwal kerja", "Setting gaji"],
}

def sitemap():
    from supa import NAV
    n = len(NAV); cw = 2.6; W = 14.2
    gap = (W - 0.5 - n*cw)/(n-1)
    IH, IP, TH, TP = 0.54, 0.74, 0.3, 0.38      # tinggi dan jarak item, tinggi dan jarak tab
    # hitung tinggi kolom terpanjang
    def colh(items):
        h = 0
        for lab in items:
            h += IP + (len(TABS.get(lab, []))*TP + 0.1 if lab in TABS else 0)
        return h
    H = 3.3 + max(colh(it) for _, it in NAV)
    fig = plt.figure(figsize=(W, H), dpi=260)
    ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, W); ax.set_ylim(0, H); ax.axis("off")
    ax.text(W/2, H-0.35, "Sitemap SIA D'Production", ha="center", va="center", fontsize=15, fontweight="bold", color=RED)
    root = (W/2, H-1.1)
    ax.add_patch(FancyBboxPatch((root[0]-1.8, root[1]-0.28), 3.6, 0.56, boxstyle="round,pad=0.02,rounding_size=0.1", fc=RED, ec=RED, zorder=3))
    ax.text(*root, "SIA D'Production", color="white", ha="center", va="center", fontsize=12.5, fontweight="bold", zorder=4)
    gy = H-2.3
    for i, (g, items) in enumerate(NAV):
        x0 = 0.25 + i*(cw+gap); cx = x0 + cw/2
        ax.plot([root[0], root[0], cx, cx], [root[1]-0.28, root[1]-0.7, root[1]-0.7, gy+0.28], color=GRAY, lw=1.1, zorder=1)
        ax.add_patch(FancyBboxPatch((x0, gy-0.28), cw, 0.56, boxstyle="round,pad=0.02,rounding_size=0.1", fc="#FBE3E0", ec=RED, lw=1.3, zorder=3))
        ax.text(cx, gy, g, ha="center", va="center", fontsize=11.5, fontweight="bold", color=RED, zorder=4)
        trunk = x0 + 0.16; ix = x0 + 0.42; iw = cw - 0.42
        yy = gy - 0.28 - 0.42
        ys = []
        for lab in items:
            ys.append(yy)
            ax.plot([trunk, ix], [yy, yy], color=GRAY, lw=1.0, zorder=1)
            ax.add_patch(FancyBboxPatch((ix, yy-IH/2), iw, IH, boxstyle="round,pad=0.02,rounding_size=0.08", fc="white", ec="#444", lw=1.0, zorder=3))
            ax.text(ix+iw/2, yy, lab, ha="center", va="center", fontsize=10.5, zorder=4)
            nxt = yy - IP
            if lab in TABS:
                tabs = TABS[lab]; tt = ix + 0.3; tx = ix + 0.55; tw = iw - 0.55
                ty = yy - IH/2 - 0.3
                tys = []
                for t in tabs:
                    tys.append(ty)
                    ax.plot([tt, tx], [ty, ty], color=GRAY, lw=0.9, zorder=1)
                    ax.add_patch(FancyBboxPatch((tx, ty-TH/2), tw, TH, boxstyle="round,pad=0.015,rounding_size=0.06", fc="#F4F4F4", ec="#777", lw=0.8, ls=(0, (3, 2)), zorder=3))
                    ax.text(tx+tw/2, ty, t, ha="center", va="center", fontsize=9, zorder=4)
                    ty -= TP
                ax.plot([tt, tt], [yy-IH/2, tys[-1]], color=GRAY, lw=0.9, zorder=1)
                nxt = ty + TP - TH/2 - 0.1 - IP/2 - 0.05
                nxt = tys[-1] - TH/2 - 0.14 - IH/2
            yy = nxt
        ax.plot([trunk, trunk], [gy-0.28, ys[-1]], color=GRAY, lw=1.0, zorder=1)
    ax.text(0.25, 0.25, "Kotak putus-putus adalah tab di dalam halaman Master Konversi dan Master SDM.", fontsize=9.5, color="#555")
    fig.savefig("sitemap.png"); plt.close(fig)

if __name__ == "__main__":
    uc_diagram(); sitemap()
