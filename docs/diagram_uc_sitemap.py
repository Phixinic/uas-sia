"""Pembuat use-case.png dan sitemap.png (matplotlib). Jalankan: python3 diagram_uc_sitemap.py"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Ellipse, FancyBboxPatch, Circle

RED = "#8B1A1A"; GRAY = "#5a5a5a"
plt.rcParams["font.family"] = "Helvetica"

def uc_diagram():
    W, H = 17.6, 12.6
    fig = plt.figure(figsize=(W, H), dpi=230)
    ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, W); ax.set_ylim(0, H); ax.axis("off")
    ax.text(W/2, H-0.4, "Use case SIA D'Production: siklus konversi, siklus SDM, dan pelaporan",
            ha="center", va="center", fontsize=17, fontweight="bold", color=RED)
    X = {"L": 5.2, "M": 9.0, "R": 12.8}
    EW, EH, P = 3.5, 0.68, 0.86
    bands = [
      ("Siklus konversi (aset produksi)", [
        {"L": "Kelola draf pembelian\nperalatan dan perlengkapan", "M": "Posting pembelian", "R": "Balik pembelian\n(jurnal pembalik)"},
        {"L": "Input nilai sisa\nperlengkapan", "M": "Buat jadwal penyusutan\nper unit aset", "R": "Lihat kartu aset"},
        {"L": "Proses penyusutan\nbulanan", "R": "Setujui atau tolak\npelepasan peralatan"},
        {"L": "Ajukan pelepasan\nperalatan"},
      ]),
      ("Siklus SDM (gaji crew dan staf)", [
        {"L": "Input presensi harian", "M": "Kelola master SDM"},
        {"L": "Hitung gaji dan PPh 21\n(slip draf)", "R": "Setujui atau tolak\npenggajian"},
        {"L": "Ajukan distribusi\nbeban gaji"},
      ]),
      ("Pelaporan dan pengaturan", [
        {"L": "Ajukan jurnal\npenyesuaian", "M": "Lihat Jurnal Umum,\nBuku Besar, Neraca Saldo", "R": "Setujui atau tolak\njurnal penyesuaian"},
        {"M": "Kelola master konversi\n(supplier, peralatan, perlengkapan)", "R": "Kunci atau buka periode"},
        {"R": "Kelola kategori aset\ndan bagan akun"},
        {"R": "Ubah profil usaha,\nnonaktifkan data master"},
      ]),
    ]
    y = H - 0.95
    pos = {}; col = {}
    for title, rows in bands:
        h = len(rows)*P + 0.55
        ax.add_patch(FancyBboxPatch((3.0, y-h), 12.4, h, boxstyle="round,pad=0.02,rounding_size=0.12",
                                    fc="#FFF8F6", ec=RED, lw=1.4, zorder=0))
        ax.text(3.2, y-0.27, title, fontsize=13.5, fontweight="bold", color=RED, va="center")
        yy = y - 0.6 - P/2
        for r in rows:
            for k, t in r.items():
                pos[t] = (X[k], yy); col[t] = k
            yy -= P
        y -= h + 0.15
    def find(prefix):
        for t in pos:
            if t.replace("\n", " ").startswith(prefix): return t
        raise KeyError(prefix)
    actors = {"Admin": (1.0, 8.6, 2.1), "HRD": (1.0, 4.6, 2.5), "Owner": (16.8, 6.6, 16.3)}
    links = {
      "Admin": ["Kelola draf", "Input nilai sisa", "Proses penyusutan", "Ajukan pelepasan", "Ajukan jurnal", "Posting pembelian",
                "Kelola master konversi", "Lihat Jurnal Umum"],
      "HRD": ["Input presensi", "Hitung gaji", "Ajukan distribusi", "Kelola master SDM", "Lihat Jurnal Umum"],
      "Owner": ["Balik pembelian", "Lihat kartu aset", "Setujui atau tolak pelepasan", "Setujui atau tolak penggajian",
                "Setujui atau tolak jurnal", "Kunci atau buka", "Kelola kategori", "Ubah profil",
                "Posting pembelian", "Kelola master SDM", "Kelola master konversi", "Lihat Jurnal Umum"],
    }
    kw = dict(color=GRAY, lw=1.0, zorder=2, solid_joinstyle="round")
    for a, (ax_, ay_, tx_) in actors.items():
        left = a != "Owner"
        sx = ax_ + (0.4 if left else -0.4)
        for p in links[a]:
            t = find(p); x, yv = pos[t]; k = col[t]
            if (left and k == "L") or (not left and k == "R"):
                ex = x - EW/2 if left else x + EW/2
                ax.plot([sx, tx_, tx_, ex], [ay_, ay_, yv, yv], **kw)
            else:  # item tengah: lewat celah di atas (aktor kiri) atau di bawah (Owner)
                up = left or t.startswith("Posting")
                gy = yv + EH/2 + (P-EH)/2 if up else yv - EH/2 - (P-EH)/2
                dx = -0.7 if left else 0.7
                ax.plot([sx, tx_, tx_, x+dx, x+dx], [ay_, ay_, gy, gy, yv + (EH/2 if up else -EH/2)], **kw)
    for t, (x, yv) in pos.items():
        ax.add_patch(Ellipse((x, yv), EW, EH, fc="white", ec="#444444", lw=1.1, zorder=3))
        ax.text(x, yv, t, ha="center", va="center", fontsize=11.5, zorder=4, linespacing=1.12)
    a = pos[find("Posting pembelian")]; b = pos[find("Buat jadwal")]
    ax.annotate("", xy=(b[0], b[1]+EH/2), xytext=(a[0], a[1]-EH/2),
                arrowprops=dict(arrowstyle="->", ls="--", color="#222", lw=1.1), zorder=5)
    ax.text(a[0]-0.12, (a[1]+b[1])/2, "«include»", fontsize=9.5, ha="right", va="center", zorder=6)
    for a, (x, yv, _) in actors.items():
        ax.add_patch(Circle((x, yv+0.55), 0.17, fc="white", ec="#333", lw=1.3, zorder=6))
        ax.plot([x, x], [yv+0.38, yv-0.1], color="#333", lw=1.3, zorder=6)
        ax.plot([x-0.3, x+0.3], [yv+0.25, yv+0.25], color="#333", lw=1.3, zorder=6)
        ax.plot([x, x-0.25], [yv-0.1, yv-0.5], color="#333", lw=1.3, zorder=6)
        ax.plot([x, x+0.25], [yv-0.1, yv-0.5], color="#333", lw=1.3, zorder=6)
        ax.text(x, yv-0.82, a, ha="center", fontsize=14, fontweight="bold", zorder=6)
    fig.savefig("use-case.png"); plt.close(fig)

def sitemap():
    from supa import NAV
    W, H = 13.5, 7.6
    fig = plt.figure(figsize=(W, H), dpi=280)
    ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, W); ax.set_ylim(0, H); ax.axis("off")
    ax.text(W/2, H-0.35, "Sitemap SIA D'Production", ha="center", va="center", fontsize=15, fontweight="bold", color=RED)
    root = (W/2, H-1.1)
    ax.add_patch(FancyBboxPatch((root[0]-1.8, root[1]-0.28), 3.6, 0.56, boxstyle="round,pad=0.02,rounding_size=0.1", fc=RED, ec=RED))
    ax.text(*root, "SIA D'Production", color="white", ha="center", va="center", fontsize=12.5, fontweight="bold")
    n = len(NAV); cw = 2.45; gap = (W - 0.5 - n*cw)/(n-1)
    gy = H-2.3
    for i, (g, items) in enumerate(NAV):
        x0 = 0.25 + i*(cw+gap); cx = x0 + cw/2
        ax.plot([root[0], root[0], cx, cx], [root[1]-0.28, root[1]-0.7, root[1]-0.7, gy+0.28], color=GRAY, lw=1.1)
        ax.add_patch(FancyBboxPatch((x0, gy-0.28), cw, 0.56, boxstyle="round,pad=0.02,rounding_size=0.1", fc="#FBE3E0", ec=RED, lw=1.3))
        ax.text(cx, gy, g, ha="center", va="center", fontsize=11.5, fontweight="bold", color=RED)
        for j, lab in enumerate(items):
            yy = gy - 0.95 - j*0.78
            top = gy-0.28 if j == 0 else yy+0.78-0.28
            ax.plot([cx, cx], [top, yy+0.28], color=GRAY, lw=1.0)
            ax.add_patch(FancyBboxPatch((x0+0.08, yy-0.28), cw-0.16, 0.56, boxstyle="round,pad=0.02,rounding_size=0.08", fc="white", ec="#444", lw=1.0))
            ax.text(cx, yy, lab, ha="center", va="center", fontsize=10.5)
    fig.savefig("sitemap.png"); plt.close(fig)

if __name__ == "__main__":
    uc_diagram(); sitemap()
