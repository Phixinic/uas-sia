/*
 * Uji klik di database hasil seed setahun (prisma/seed-setahun.ts), tiap peran lewat browser sungguhan:
 *  1. Admin memproses penyusutan Desember.
 *  2. Admin menginput nilai sisa Desember, Owner mengembalikan untuk revisi, Admin mengajukan ulang, Owner menyetujui.
 *  3. Kapten menyelesaikan penilaian event yang berisi karyawan inhouse lalu mengirim laporan, Owner memutuskan fee.
 *  4. HRD mengisi potongan dan bonus Desember lalu mengajukan, Owner menyetujui, slip memuat upah event, potongan, bonus.
 *  5. Neraca saldo Desember seimbang.
 * Potret 1440 dan 390 px disimpan di artefak-uji/perombakan-dosen/.
 * Jalankan terhadap server yang sudah menyala (next start dengan DATABASE_URL database seed setahun):
 *   BASE=http://127.0.0.1:3232 node tests/klik/setahun.mjs
 * Database berubah karena uji ini; pulihkan dari salinan sebelum menjalankan ulang.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { expect } from "@playwright/test";

const BASE = process.env.BASE ?? "http://127.0.0.1:3232";
const POTRET = path.resolve("artefak-uji/perombakan-dosen");
fs.mkdirSync(POTRET, { recursive: true });
const galat = [];
const catatan = [];

const browser = await chromium.launch();
async function sesi(nama, sandi) {
  const ctx = await browser.newContext({ baseURL: BASE, locale: "id-ID", timezoneId: "Asia/Jakarta", viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => galat.push(`[${nama}] pageerror ${e.message}`));
  p.on("console", (m) => {
    if (m.type() === "error" && !/favicon|Failed to load resource.*(401|404)/.test(m.text())) galat.push(`[${nama}] ${p.url()} ${m.text().slice(0, 200)}`);
  });
  await p.goto("/masuk");
  await p.getByLabel("Nama pengguna").fill(nama);
  await p.getByLabel("Kata sandi").fill(sandi);
  await p.getByRole("button", { name: "Masuk" }).click();
  await p.waitForURL((u) => !u.pathname.startsWith("/masuk"));
  return { ctx, p };
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
async function potret(p, nama) {
  for (const lebar of [1440, 390]) {
    await p.setViewportSize({ width: lebar, height: lebar === 390 ? 844 : 900 });
    await p.waitForTimeout(250);
    await p.screenshot({ path: path.join(POTRET, `${nama}-${lebar}.png`), fullPage: true });
  }
  await p.setViewportSize({ width: 1440, height: 900 });
}
/** SAJA=5 menjalankan langkah yang judulnya diawali "5." saja (langkah lain mengubah data). */
const SAJA = process.env.SAJA;
const langkah = async (judul, fn) => {
  if (SAJA && !judul.startsWith(`${SAJA}.`)) return;
  const t0 = Date.now();
  try {
    await fn();
    catatan.push(`LOLOS ${judul} (${Math.round((Date.now() - t0) / 1000)} dtk)`);
  } catch (e) {
    catatan.push(`GAGAL ${judul}: ${String(e.message).split("\n")[0]}`);
    throw e;
  }
};
const angka = (t) => Number(t.replace(/[^\d]/g, "") || 0);

const admin = await sesi("admin", "adminsia");
const owner = await sesi("owner", "ownersia");
const hrd = await sesi("hrd", "hrdsia");
const kapten2 = await sesi("kapten2", "kaptensia");

try {
  await langkah("1. Admin memproses penyusutan Desember (langsung masuk buku besar, tanpa tombol tolak)", async () => {
    const p = admin.p;
    await p.goto("/konversi/penyusutan?bulan=12&tahun=2026");
    await expect(p.getByText("42 belum diproses").first()).toBeVisible();
    await p.getByRole("button", { name: "Proses penyusutan" }).click();
    await konfirmasi(p);
    const panel = p.getByRole("region", { name: "Jurnal penyusutan Desember 2026" });
    await expect(panel).toContainText("Disetujui");
    await expect(panel).toContainText("Sudah masuk buku besar");
    for (const nama of ["Ajukan ke Owner", "Setujui", "Tolak"]) await expect(p.getByRole("button", { name: nama })).toHaveCount(0);
    await potret(p, "penyusutan-desember-admin");
    await owner.p.goto("/konversi/penyusutan?bulan=12&tahun=2026");
    await expect(owner.p.getByRole("button", { name: "Tolak" })).toHaveCount(0);
  });

  await langkah("2. Nilai sisa Desember: Admin input, Owner kembalikan untuk revisi, Admin ajukan ulang, Owner setujui", async () => {
    const p = admin.p;
    await p.goto("/konversi/nilai-sisa?bulan=12&tahun=2026");
    const rows = p.locator("table[aria-label='Hitung fisik perlengkapan'] tbody tr");
    const n = await rows.count();
    for (let i = 0; i < n; i++) {
      const saldo = angka(await rows.nth(i).locator("td").nth(2).innerText());
      await rows.nth(i).locator("input").fill(String(Math.floor(saldo * 0.3)));
    }
    await p.getByRole("button", { name: "Simpan nilai sisa" }).click();
    const panel = p.getByRole("region", { name: "Jurnal biaya perlengkapan Desember 2026" });
    await expect(panel).toContainText("Draf");
    await panel.getByRole("button", { name: "Ajukan ke Owner" }).click();
    await konfirmasi(p);
    await expect(panel).toContainText("Menunggu Owner");

    const o = owner.p;
    await o.goto("/konversi/nilai-sisa?bulan=12&tahun=2026");
    const panelO = o.getByRole("region", { name: "Jurnal biaya perlengkapan Desember 2026" });
    await panelO.getByRole("button", { name: "Kembalikan untuk revisi" }).click();
    await konfirmasi(o, "Gaffer tape di gudang belakang belum dihitung");
    await expect(panelO).toContainText("Dikembalikan");

    await p.goto("/konversi/nilai-sisa?bulan=12&tahun=2026");
    await expect(p.getByText("Alasan dikembalikan:").first()).toBeVisible();
    await potret(p, "nilai-sisa-dikembalikan-admin");
    const pertama = p.locator("table[aria-label='Hitung fisik perlengkapan'] tbody tr").first();
    const saldo1 = angka(await pertama.locator("td").nth(2).innerText());
    await pertama.locator("input").fill(String(Math.floor(saldo1 * 0.5)));
    await p.getByRole("button", { name: "Simpan nilai sisa" }).click();
    await expect(panel).toContainText("Draf");
    await panel.getByRole("button", { name: "Ajukan ke Owner" }).click();
    await konfirmasi(p);

    await o.goto("/konversi/nilai-sisa?bulan=12&tahun=2026");
    await panelO.getByRole("button", { name: "Setujui" }).click();
    await konfirmasi(o);
    await expect(panelO).toContainText("Disetujui");
    await expect(o.getByRole("region", { name: "Riwayat jurnal dan persetujuan" }).getByRole("row", { name: /Dikembalikan/ }).filter({ hasText: "Desember 2026" })).toContainText("Gaffer tape di gudang belakang");
    await potret(o, "nilai-sisa-desember-owner");
    await o.goto("/konversi/nilai-sisa?bulan=11&tahun=2026");
    await expect(o.getByRole("region", { name: "Riwayat versi nilai sisa" })).toContainText("OPN-2026-11-R1");
    await potret(o, "nilai-sisa-november-riwayat-versi");
  });

  await langkah("3. Kapten menyelesaikan penilaian event berisi karyawan inhouse, Owner memutuskan fee", async () => {
    const k = kapten2.p;
    await k.goto("/kapten");
    await k.getByRole("row", { name: /Malam Tahun Baru/ }).getByRole("link", { name: "Nilai crew" }).first().click().catch(async () => {
      await k.getByRole("link", { name: "Nilai crew" }).last().click();
    });
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

    const o = owner.p;
    await o.goto("/fee-event/keputusan");
    await o.getByRole("row", { name: /Malam Tahun Baru/ }).filter({ hasText: "Diajukan" }).getByRole("link", { name: "Putuskan" }).first().click();
    await o.waitForURL(/lihat=FEE-/);
    await expect(o.getByText("Inhouse").first()).toBeVisible();
    await expect(o.getByText(/Dibayar lewat Gaji Bulanan/).first()).toBeVisible();
    await potret(o, "keputusan-fee-inhouse-owner");
    await o.getByRole("button", { name: "Setujui dan bayar" }).click();
    await o.getByRole("dialog").getByRole("button", { name: "Setujui dan bayar" }).click();
    await toast(o, /dibayar lewat gaji Desember 2026/);
    await expect(o.getByText(/Inhouse: lewat Gaji Bulanan Desember 2026/).first()).toBeVisible();
    await potret(o, "slip-fee-lewat-gaji-owner");
  });

  await langkah("4. HRD mengisi potongan dan bonus Desember lalu mengajukan, Owner menyetujui, slip memuat upah event", async () => {
    const h = hrd.p;
    await h.goto("/sdm/gaji-bulanan?bulan=12&tahun=2026");
    await expect(h.getByRole("heading", { name: "Gaji Bulanan", level: 1 })).toBeVisible();
    await expect(h.getByText("estimasi").first()).toBeVisible();
    const yoga = h.getByRole("table", { name: "Gaji per karyawan" }).getByRole("row", { name: /Yoga Saputra/ });
    await expect(yoga).toContainText("EVT-");
    await yoga.getByRole("link", { name: "Potongan/bonus" }).click();
    await h.waitForURL(/ubah=/);
    const editor = h.getByRole("region", { name: /Potongan dan bonus Yoga Saputra/ });
    await editor.getByLabel("Jenis").selectOption("POTONGAN");
    await editor.getByLabel("Nominal (Rp)").fill("125000");
    await editor.getByLabel("Keterangan").fill("Denda merusak HT saat event");
    await expect(editor.getByRole("region", { name: "Pratinjau gaji" })).toContainText("125.000");
    await editor.getByRole("button", { name: "Simpan potongan" }).click();
    await toast(h, /Potongan Rp125\.000 untuk Yoga Saputra tersimpan/);
    await editor.getByLabel("Jenis").selectOption("BONUS");
    await editor.getByLabel("Nominal (Rp)").fill("400000");
    await editor.getByLabel("Keterangan").fill("Bonus event akhir tahun");
    await editor.getByRole("button", { name: "Simpan bonus" }).click();
    await toast(h, /Bonus Rp400\.000 untuk Yoga Saputra tersimpan/);
    await potret(h, "gaji-bulanan-desember-hrd");
    await h.getByRole("button", { name: "Ajukan gaji Desember 2026 ke Owner" }).click();
    await konfirmasi(h);
    await toast(h, /diajukan ke Owner/);

    const o = owner.p;
    await o.goto("/sdm/gaji-bulanan?bulan=12&tahun=2026");
    await expect(o.getByText("Menunggu keputusan Owner").first()).toBeVisible();
    await potret(o, "gaji-bulanan-desember-owner-menunggu");
    await o.getByRole("button", { name: "Setujui dan bayar" }).click();
    await konfirmasi(o);
    await toast(o, /disetujui\. Jurnal JU-2026-\d+ dibuat/);
    await expect(o.getByText("Sudah dibayar").first()).toBeVisible();

    await o.goto("/sdm/gaji-bulanan?bulan=12&tahun=2026&slip=KRY-08");
    const slip = o.getByRole("article", { name: "Slip gaji Yoga Saputra" });
    await expect(slip.getByRole("region", { name: "Upah event" })).toContainText("Malam Tahun Baru");
    await expect(slip.getByRole("region", { name: "Upah event" })).toContainText("Pameran Akhir Tahun");
    await expect(slip.getByRole("region", { name: "Potongan dan bonus" })).toContainText("Denda merusak HT");
    await expect(slip.getByRole("region", { name: "Potongan dan bonus" })).toContainText("Bonus event akhir tahun");
    await expect(slip.getByRole("region", { name: "Gaji tetap" })).toBeVisible();
    await potret(o, "slip-gaji-upah-event-potongan-bonus");
  });

  await langkah("5. Neraca saldo Desember seimbang (setelah penyesuaian) dan Master SDM satu tabel Jabatan", async () => {
    const o = owner.p;
    await o.goto("/pelaporan/neraca-saldo?bulan=12&tahun=2026&tahap=setelah");
    await expect(o.getByText(/tidak seimbang/i)).toHaveCount(0);
    await expect(o.locator(".lencana", { hasText: /^seimbang$/ }).first()).toBeVisible();
    await expect(o.locator(".lencana", { hasText: /tidak seimbang|selisih/ })).toHaveCount(0);
    await potret(o, "neraca-saldo-desember");
    await o.goto("/master/sdm?tab=struktur");
    const jab = o.getByRole("region", { name: "Jabatan", exact: true });
    await expect(jab.getByRole("row", { name: /Kapten Event/ })).toContainText("Event");
    await expect(jab.getByRole("row", { name: /Marketing & Promosi/ })).toContainText("Inhouse");
    await potret(o, "master-sdm-jabatan");
    await o.goto("/");
    await potret(o, "dashboard-owner-desember");
  });
} finally {
  for (const s of [admin, owner, hrd, kapten2]) await s.ctx.close();
  await browser.close();
  console.log(catatan.join("\n"));
  if (galat.length) console.log(`Galat konsol (${galat.length}):\n${galat.join("\n")}`);
}
