/*
 * Uji klik di database hasil seed data contoh (prisma/seed-setahun.ts, Januari 2025 sampai Desember 2026), lewat browser
 * sungguhan.
 *
 * LANGKAH=telusur (bawaan): Admin, HRD, Owner membuka semua halaman utama. Halaman berperiode dibuka untuk beberapa bulan
 *   di 2025 dan 2026, halaman lain sekali, masing-masing di lebar 1440 dan 390 px. Dicatat: status HTTP, galat konsol dan
 *   galat halaman, waktu muat, jumlah baris tabel, dan apakah pilihan Tahun memuat 2025 dan 2026.
 * LANGKAH=coba: menyelesaikan lewat UI hal yang sengaja dibiarkan terbuka (database berubah, pakai salinan):
 *   1. Owner menyetujui setoran modal Desember 2026.
 *   2. Admin memposting pembelian perlengkapan draf Desember 2026.
 *   3. Owner menyetujui fee event Natal Bersama.
 *   4. Kapten menyelesaikan penilaian Malam Tahun Baru, Owner menyetujui, upah inhouse masuk gaji Januari 2027.
 *   5. Owner menyetujui Gaji Bulanan Desember 2026 yang sudah diajukan HRD.
 *   6. Owner menyetujui setting gaji dan nominal dari HRD yang berlaku Januari 2027.
 *   7. Admin merevisi nilai sisa November 2026, Owner menyetujui.
 *   8. Admin mengajukan pelepasan HT bekas yang masa manfaatnya habis, Owner menyetujui.
 *   9. Owner memakai Setujui semua untuk penyusutan Desember 2026.
 *  10. Admin mengisi nilai sisa Desember 2026 dan mengajukan, Owner menyetujui, lalu satu revisi Desember disetujui.
 *      Sesudahnya November tidak bisa direvisi lagi (aturan biasa).
 *  11. Neraca saldo Desember 2026 tetap seimbang.
 * Potret disimpan di POTRET (bawaan /tmp/sia-multi-tahun-potret).
 *   BASE=http://127.0.0.1:3311 node tests/klik/multi-tahun.mjs
 *   BASE=http://127.0.0.1:3311 LANGKAH=coba node tests/klik/multi-tahun.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, expect } from "@playwright/test";

const BASE = process.env.BASE ?? "http://127.0.0.1:3311";
const LANGKAH = process.env.LANGKAH ?? "telusur";
const POTRET = path.join(process.env.POTRET ?? "/tmp/sia-multi-tahun-potret", LANGKAH);
fs.mkdirSync(POTRET, { recursive: true });
const galat = [];
const catatan = [];

const browser = await chromium.launch();
async function sesi(nama, sandi) {
  const ctx = await browser.newContext({ baseURL: BASE, locale: "id-ID", timezoneId: "Asia/Jakarta", viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => galat.push(`[${nama}] pageerror ${p.url()} ${e.message}`));
  p.on("console", (m) => {
    if (m.type() === "error" && !/favicon/.test(m.text())) galat.push(`[${nama}] konsol ${p.url()} ${m.text().slice(0, 300)}`);
  });
  p.on("response", (r) => {
    if (r.status() >= 500) galat.push(`[${nama}] HTTP ${r.status()} ${r.url()}`);
  });
  await p.goto("/masuk");
  await p.getByLabel("Nama pengguna").fill(nama);
  await p.getByLabel("Kata sandi").fill(sandi);
  await p.getByRole("button", { name: "Masuk" }).click();
  await p.waitForURL((u) => !u.pathname.startsWith("/masuk"));
  return { ctx, p, nama };
}
async function potret(p, nama, lebar = [1440, 390]) {
  // Tunggu kerangka muat berganti isi halaman.
  await p.waitForLoadState("networkidle");
  await expect(p.locator("main h1").first()).toBeVisible();
  for (const l of lebar) {
    await p.setViewportSize({ width: l, height: l === 390 ? 844 : 900 });
    await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(POTRET, `${nama}-${l}.png`), fullPage: true });
  }
  await p.setViewportSize({ width: 1440, height: 900 });
}
const langkah = async (judul, fn) => {
  const t0 = Date.now();
  try {
    await fn();
    catatan.push(`LOLOS ${judul} (${Math.round((Date.now() - t0) / 1000)} dtk)`);
  } catch (e) {
    catatan.push(`GAGAL ${judul}: ${String(e.message).split("\n")[0]}`);
  }
};

// ---------------------------------------------------------------- Telusur

const BERPERIODE = ["/", "/pelaporan/jurnal-umum", "/pelaporan/buku-besar", "/pelaporan/neraca-saldo", "/konversi/nilai-sisa", "/konversi/penyusutan", "/modal/investasi-kas", "/sdm/presensi", "/sdm/gaji-bulanan"];
const LAIN = ["/konversi/pembelian-peralatan", "/konversi/pembelian-perlengkapan", "/konversi/kartu-aset", "/konversi/pelepasan", "/sdm/setting-gaji", "/fee-event/event", "/fee-event/keputusan", "/pelaporan/jurnal-penyesuaian", "/pelaporan/tutup-periode", "/master/konversi", "/master/sdm", "/master/sdm?tab=struktur", "/pengguna"];
/** Dua bulan per tahun (Desember 2026 = bulan yang sengaja terbuka). */
const BULAN_TAHUN = [[1, 2025], [8, 2025], [5, 2026], [12, 2026]];
const SEMUA_TAHUN = ["2025", "2026"];

async function buka(s, url, lebar) {
  const { p } = s;
  await p.setViewportSize({ width: lebar, height: lebar === 390 ? 844 : 900 });
  const t0 = Date.now();
  const r = await p.goto(url, { waitUntil: "networkidle" });
  const ms = Date.now() - t0;
  const akhir = new URL(p.url());
  const info = await p.evaluate(() => {
    const tahun = document.querySelector('select[id$="-tahun"]');
    return {
      baris: document.querySelectorAll("main tbody tr").length,
      kosong: document.querySelectorAll("main [data-keadaan-kosong], main .keadaan-kosong").length,
      tahun: tahun ? [...tahun.options].map((o) => o.value) : null,
      judul: document.querySelector("main h1")?.textContent?.trim() ?? "",
    };
  });
  return { status: r?.status() ?? 0, ms, akhir: akhir.pathname, ...info };
}

async function telusur() {
  const hasil = [];
  for (const [nama, sandi] of [["admin", "adminsia"], ["hrd", "hrdsia"], ["owner", "ownersia"]]) {
    const s = await sesi(nama, sandi);
    const daftar = [
      ...BERPERIODE.flatMap((h) => BULAN_TAHUN.map(([b, t]) => ({ h, url: `${h}${h.includes("?") ? "&" : "?"}bulan=${b}&tahun=${t}`, tahun: t, bulan: b }))),
      ...LAIN.map((h) => ({ h, url: h, tahun: null })),
    ];
    for (const d of daftar) {
      for (const lebar of [1440, 390]) {
        const x = await buka(s, d.url, lebar);
        if (x.akhir === "/tanpa-akses") {
          if (lebar === 1440) hasil.push({ peran: nama, url: d.url, lebar, tanpaAkses: true });
          break;
        }
        const nama2 = `${nama}${d.h.replace(/[/?=&]+/g, "-")}${d.tahun ? `-${d.tahun}-${d.bulan}` : ""}`.replace(/-+$/, "");
        await s.p.screenshot({ path: path.join(POTRET, `${nama2}-${lebar}.png`), fullPage: true });
        const tahunKurang = d.tahun && x.tahun ? SEMUA_TAHUN.filter((t) => !x.tahun.includes(t)) : [];
        hasil.push({ peran: nama, url: d.url, lebar, status: x.status, ms: x.ms, baris: x.baris, judul: x.judul, pilihanTahun: x.tahun, tahunKurang });
      }
    }
    await s.ctx.close();
  }
  fs.writeFileSync(path.join(POTRET, "hasil.json"), JSON.stringify(hasil, null, 1));
  const dibuka = hasil.filter((x) => !x.tanpaAkses);
  const lambat = [...dibuka].sort((a, b) => b.ms - a.ms).slice(0, 8);
  catatan.push(`Dibuka ${dibuka.length} kali (${new Set(dibuka.map((x) => x.peran + x.url)).size} halaman x peran), ${hasil.filter((x) => x.tanpaAkses).length} tanpa akses.`);
  catatan.push(`Status bukan 200: ${dibuka.filter((x) => x.status !== 200).map((x) => `${x.peran} ${x.url} ${x.status}`).join("; ") || "tidak ada"}.`);
  catatan.push(`Pilihan Tahun kurang: ${dibuka.filter((x) => x.tahunKurang?.length).map((x) => `${x.peran} ${x.url} (${x.tahunKurang.join(",")})`).join("; ") || "tidak ada"}.`);
  catatan.push(`Halaman berperiode tanpa baris tabel: ${dibuka.filter((x) => x.pilihanTahun && x.baris === 0 && x.lebar === 1440).map((x) => `${x.peran} ${x.url}`).join("; ") || "tidak ada"}.`);
  catatan.push(`Terlambat: ${lambat.map((x) => `${x.peran} ${x.url} ${x.lebar}px ${x.ms} ms`).join("; ")}.`);
}

// ---------------------------------------------------------------- Coba

/** Mengisi hasil hitung fisik semua perlengkapan dengan `pecahan` dari saldo buku. */
async function isiNilai(p, pecahan) {
  const rows = p.locator("table[aria-label='Hitung fisik perlengkapan'] tbody tr");
  await expect(rows.first()).toBeVisible();
  for (let i = 0; i < (await rows.count()); i++) {
    const saldo = Number((await rows.nth(i).locator("td").nth(2).innerText()).replace(/[^0-9]/g, ""));
    await rows.nth(i).locator("input").fill(String(Math.floor(saldo * pecahan)));
  }
}

/** Admin mengajukan revisi nilai sisa (baris pertama dinaikkan), Owner menyetujui. */
async function revisiNilaiSisa(a, o, bulan, alasan) {
  const url = `/konversi/nilai-sisa?bulan=${bulan}&tahun=2026`;
  await a.goto(url);
  await a.getByRole("link", { name: "Ajukan revisi" }).click();
  const baris = a.locator("table[aria-label='Hitung fisik perlengkapan'] tbody tr").first();
  const saldo = Number((await baris.locator("td").nth(2).innerText()).replace(/[^0-9]/g, ""));
  const lama = Number((await baris.locator("input").inputValue()).replace(/[^0-9]/g, ""));
  await baris.locator("input").fill(String(lama < saldo ? lama + 1 : lama - 1));
  await a.locator("#alasan").fill(alasan);
  await a.getByRole("button", { name: "Ajukan revisi ke Owner" }).click();
  await expect(a.getByRole("region", { name: new RegExp(`^Revisi OPN-2026-${String(bulan).padStart(2, "0")}-R`) })).toContainText("Menunggu Owner", { timeout: 30_000 });
  await o.goto(url);
  await o.getByRole("button", { name: "Setujui revisi" }).click();
  await konfirmasi(o);
  await expect(o.getByRole("button", { name: "Setujui revisi" })).toHaveCount(0);
}

async function konfirmasi(p, alasan) {
  const d = p.getByRole("dialog");
  await expect(d).toBeVisible();
  if (alasan) await d.getByLabel(/Alasan/).fill(alasan);
  await d.locator('button[type="submit"]').click();
  await expect(d).toBeHidden({ timeout: 30_000 });
}
async function toast(p, pola) {
  await expect(p.getByRole("status").filter({ hasText: pola }).first()).toBeVisible({ timeout: 30_000 });
}

async function coba() {
  const admin = await sesi("admin", "adminsia");
  const owner = await sesi("owner", "ownersia");
  const hrd = await sesi("hrd", "hrdsia");
  const kapten2 = await sesi("kapten2", "kaptensia");
  const o = owner.p;
  try {
    await langkah("1. Owner menyetujui setoran modal Desember 2026", async () => {
      await o.goto("/modal/investasi-kas?bulan=12&tahun=2026");
      const tombol = o.getByRole("button", { name: /^Setujui INV-2026-/ }).first();
      const no = (await tombol.getAttribute("aria-label")).replace("Setujui ", "");
      await tombol.click();
      await konfirmasi(o);
      await expect(o.getByRole("button", { name: `Setujui ${no}` })).toHaveCount(0);
      catatan.push(`   ${no} disetujui.`);
      await potret(o, "1-setoran-desember-2026-owner");
    });

    await langkah("2. Admin memposting pembelian perlengkapan draf Desember 2026", async () => {
      const p = admin.p;
      await p.goto("/konversi/pembelian-perlengkapan");
      const baris = p.getByRole("row", { name: /Draf/ }).first();
      await baris.getByRole("button", { name: "Posting" }).click();
      await konfirmasi(p);
      await expect(p.getByRole("row", { name: /Draf/ })).toHaveCount(0);
      await potret(p, "2-pembelian-perlengkapan-posting-admin");
    });

    await langkah("3. Owner menyetujui fee event Natal Bersama Desember 2026", async () => {
      await o.goto("/fee-event/keputusan");
      await o.getByRole("row", { name: /Natal Bersama/ }).filter({ hasText: "Diajukan" }).getByRole("link", { name: "Putuskan" }).first().click();
      await o.waitForURL(/lihat=FEE-/);
      await o.getByRole("button", { name: "Setujui dan bayar" }).click();
      await o.getByRole("dialog").getByRole("button", { name: "Setujui dan bayar" }).click();
      await toast(o, /disetujui|dibayar/i);
      await potret(o, "3-fee-natal-owner");
    });

    await langkah("4. Kapten menilai Malam Tahun Baru dan mengirim, Owner menyetujui fee-nya", async () => {
      const k = kapten2.p;
      await k.goto("/kapten");
      // Hanya satu event milik kapten2 yang belum selesai (daftar kapten berupa kartu, bukan tabel).
      await expect(k.getByRole("main")).toContainText("Malam Tahun Baru");
      await k.getByRole("link", { name: "Nilai crew" }).click();
      await k.waitForURL(/lihat=EVT-/);
      for (let putaran = 0; putaran < 12; putaran++) {
        const belum = k.getByRole("group", { name: /^Penilaian / }).filter({ has: k.getByRole("button", { name: "Sesuai", pressed: false }) });
        if (!(await belum.count())) break;
        await belum.first().getByRole("button", { name: "Sesuai" }).click();
        await k.waitForTimeout(500);
      }
      await expect(k.getByRole("button", { name: "Kirim laporan ke Owner" })).toBeEnabled({ timeout: 20_000 });
      await k.getByRole("button", { name: "Kirim laporan ke Owner" }).click();
      await k.getByRole("dialog").getByRole("button", { name: "Kirim laporan" }).click();
      await toast(k, /terkirim|dikirim/i);
      await potret(k, "4-kapten-kirim-laporan");

      await o.goto("/fee-event/keputusan");
      await o.getByRole("row", { name: /Malam Tahun Baru/ }).filter({ hasText: "Diajukan" }).getByRole("link", { name: "Putuskan" }).first().click();
      await o.waitForURL(/lihat=FEE-/);
      await o.getByRole("button", { name: "Setujui dan bayar" }).click();
      await o.getByRole("dialog").getByRole("button", { name: "Setujui dan bayar" }).click();
      await toast(o, /dibayar lewat gaji Januari 2027/);
      await potret(o, "4-fee-malam-tahun-baru-owner");
    });

    await langkah("5. Owner menyetujui Gaji Bulanan Desember 2026 yang sudah diajukan HRD", async () => {
      const h = hrd.p;
      await h.goto("/sdm/gaji-bulanan?bulan=12&tahun=2026");
      const yoga = h.getByRole("table", { name: "Gaji per karyawan" }).getByRole("row", { name: /Yoga Saputra/ });
      await expect(yoga).toContainText("EVT-");
      await expect(h.getByRole("button", { name: "Ajukan gaji Desember 2026 ke Owner" })).toHaveCount(0);
      await potret(h, "5-gaji-desember-2026-hrd");
      await o.goto("/sdm/gaji-bulanan?bulan=12&tahun=2026");
      await potret(o, "5-gaji-desember-2026-owner-menunggu");
      await o.getByRole("button", { name: "Setujui dan bayar" }).click();
      await konfirmasi(o);
      await toast(o, /disetujui\. Jurnal JU-2026-\d+ dibuat/);
      await potret(o, "5-gaji-desember-2026-owner");
    });

    await langkah("6. Owner menyetujui setting gaji dan nominal dari HRD berlaku Januari 2027", async () => {
      await o.goto("/sdm/setting-gaji");
      const set = o.getByRole("button", { name: /^Setujui SET-/ }).first();
      const kodeSet = (await set.getAttribute("aria-label")).replace("Setujui ", "");
      await set.click();
      await konfirmasi(o);
      await expect(o.getByRole("button", { name: `Setujui ${kodeSet}` })).toHaveCount(0);
      await potret(o, "6-setting-gaji-owner");
      await o.goto("/master/sdm?tab=struktur");
      const nom = o.getByRole("button", { name: /^Setujui NOM-/ }).first();
      const kodeNom = (await nom.getAttribute("aria-label")).replace("Setujui ", "");
      await nom.click();
      await konfirmasi(o);
      await expect(o.getByRole("button", { name: `Setujui ${kodeNom}` })).toHaveCount(0);
      catatan.push(`   ${kodeSet} dan ${kodeNom} disetujui.`);
      await potret(o, "6-nominal-owner");
    });

    const a = admin.p;
    await langkah("7. Admin merevisi nilai sisa November 2026, Owner menyetujui", async () => {
      await revisiNilaiSisa(a, o, 11, "Satu pak baterai ditemukan di tas kamera.");
      await potret(o, "7-revisi-november-owner");
    });

    await langkah("8. Admin mengajukan pelepasan HT bekas yang masa manfaatnya habis, Owner menyetujui", async () => {
      await a.goto("/konversi/pelepasan?form=baru");
      await a.locator("#asetKode").selectOption("AST-0002");
      await a.locator("#tanggal").fill("2026-11-27");
      await a.locator("#alasan").selectOption("DIBUANG");
      await potret(a, "8-form-pelepasan-admin");
      await a.getByRole("button", { name: "Ajukan ke Owner" }).click();
      await a.waitForURL(/lihat=PLP-/);
      const no = new URL(a.url()).searchParams.get("lihat");
      await o.goto("/konversi/pelepasan");
      const baris = o.locator("tr", { hasText: "AST-0002" }).filter({ has: o.getByRole("button", { name: "Setujui" }) });
      await baris.getByRole("button", { name: "Setujui" }).click();
      await konfirmasi(o);
      await expect(o.locator("tr", { hasText: "AST-0002" }).first()).toContainText("Disetujui");
      catatan.push(`   Pelepasan AST-0002 (${no}) disetujui.`);
      await potret(o, "8-pelepasan-owner");
    });

    await langkah("9. Owner memakai Setujui semua untuk penyusutan Desember 2026", async () => {
      await o.goto("/konversi/penyusutan?bulan=12&tahun=2026");
      await potret(o, "9-penyusutan-desember-sebelum-owner");
      await o.getByRole("button", { name: "Setujui semua" }).click();
      await konfirmasi(o);
      await expect(o.getByText("Sudah diproses").first()).toBeVisible({ timeout: 30_000 });
      await expect(o.getByRole("button", { name: "Setujui semua" })).toHaveCount(0);
      await potret(o, "9-penyusutan-desember-sesudah-owner");
    });

    await langkah("10. Nilai sisa Desember 2026 diisi, disetujui, direvisi; November tidak bisa direvisi lagi", async () => {
      await a.goto("/konversi/nilai-sisa?bulan=12&tahun=2026");
      await isiNilai(a, 0.4);
      await a.getByRole("button", { name: "Simpan nilai sisa" }).click();
      await expect(a.getByText("Ubah nilai sisa (draf)")).toBeVisible({ timeout: 30_000 });
      await a.goto("/pelaporan/jurnal-penyesuaian?status=DRAFT");
      await a.getByRole("button", { name: "Ajukan ke Owner" }).first().click();
      await konfirmasi(a);
      await o.goto("/pelaporan/jurnal-penyesuaian?status=DIAJUKAN");
      await o.locator(".kartu", { hasText: "Biaya perlengkapan Desember 2026" }).getByRole("button", { name: "Setujui" }).click();
      await konfirmasi(o);
      await revisiNilaiSisa(a, o, 12, "Gudang dihitung ulang sesudah acara tahun baru.");
      await potret(o, "10-nilai-sisa-desember-owner");
      await a.goto("/konversi/nilai-sisa?bulan=11&tahun=2026");
      await expect(a.getByRole("link", { name: "Ajukan revisi" })).toHaveCount(0);
      await potret(a, "10-nilai-sisa-november-admin");
    });

    await langkah("11. Neraca saldo Desember 2026 seimbang sesudah semua dicoba", async () => {
      await o.goto("/pelaporan/neraca-saldo?bulan=12&tahun=2026&tahap=setelah");
      await expect(o.getByText(/tidak seimbang/i)).toHaveCount(0);
      await potret(o, "11-neraca-saldo-desember-2026");
    });
  } finally {
    for (const s of [admin, owner, hrd, kapten2]) await s.ctx.close();
  }
}

try {
  if (LANGKAH === "coba") await coba();
  else await telusur();
} finally {
  await browser.close();
  console.log(catatan.join("\n"));
  console.log(galat.length ? `Galat konsol atau server (${galat.length}):\n${galat.join("\n")}` : "Tanpa galat konsol, galat halaman, atau HTTP 5xx.");
}
