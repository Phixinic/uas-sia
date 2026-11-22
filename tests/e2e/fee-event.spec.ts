/*
 * Uji E2E fee event (crew freelance): HRD mencatat event, kapten menilai dan melapor, Owner menolak lalu menyetujui
 * dengan satu fee diubah, jurnal dan slip fee tampil. Ditambah akses terlarang lewat URL dan lewat server action
 * langsung (permintaan aksi yang ditangkap lalu dikirim ulang dengan sesi atau isi lain), dan satu uji klik Hitung Gaji
 * inhouse. Butuh database yang baru di-seed. Potret tiap halaman baru (1440 dan 390 px) disimpan di POTRET.
 */
import fs from "node:fs";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_PORT ?? 3200}`;
const POTRET = process.env.E2E_POTRET ?? "/tmp/sia-e2e/fee-event";
const galatKonsol: string[] = [];

type Sesi = { ctx: BrowserContext; page: Page; aksi: { id: string; body: string; url: string; tree: string }[] };
const sesi: Record<string, Sesi> = {};

async function bukaSesi(browser: Browser, nama: string, sandi: string): Promise<Sesi> {
  const ctx = await browser.newContext({ baseURL: BASE, locale: "id-ID", timezoneId: "Asia/Jakarta", viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const s: Sesi = { ctx, page, aksi: [] };
  page.on("pageerror", (e) => galatKonsol.push(`[${nama}] pageerror ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) galatKonsol.push(`[${nama}] ${page.url()} ${m.text().slice(0, 200)}`);
  });
  // Tangkap permintaan server action (header Next-Action) supaya bisa dikirim ulang untuk uji akses terlarang.
  page.on("request", (r) => {
    const id = r.headers()["next-action"];
    if (r.method() === "POST" && id) s.aksi.push({ id, body: r.postData() ?? "", url: r.url(), tree: r.headers()["next-router-state-tree"] ?? "" });
  });
  await page.goto("/masuk");
  await page.getByLabel("Nama pengguna").fill(nama);
  await page.getByLabel("Kata sandi").fill(sandi);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/masuk"));
  return s;
}

/** Kirim ulang server action dengan isi lain memakai cookie sesi `s`. Mengembalikan teks respons RSC. */
async function kirimAksi(s: Sesi, contoh: { id: string; url: string; tree: string }, isi: unknown[]): Promise<string> {
  const r = await s.ctx.request.post(contoh.url, {
    headers: { "Next-Action": contoh.id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", "Next-Router-State-Tree": contoh.tree },
    data: JSON.stringify(isi),
  });
  return r.text();
}

const toast = (p: Page) => p.getByRole("status");
async function tungguToast(p: Page, pola: RegExp) {
  await expect(toast(p)).toContainText(pola);
}

/**
 * Potret 1440 dan 390. Halaman tidak boleh melebar melewati layar. Untuk halaman fee event (`tanpaGeser`), di 390 juga
 * tidak boleh ada tabel yang tampil dan menggulir ke samping di dalam pembungkusnya: daftar harus tampil sebagai kartu.
 */
async function potret(p: Page, nama: string, tanpaGeser = true) {
  fs.mkdirSync(POTRET, { recursive: true });
  for (const lebar of [1440, 390]) {
    await p.setViewportSize({ width: lebar, height: lebar === 390 ? 844 : 900 });
    await p.waitForLoadState("networkidle");
    // Tunggu transisi padding kerangka (lg:pl-64 -> 0) selesai sebelum mengukur dan memotret.
    await p.waitForTimeout(500);
    // Halaman tidak boleh melebar melewati layar (tabel lebar menggulir di dalam pembungkusnya).
    const lebih = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(lebih, `${nama} melebar ${lebih}px di ${lebar}`).toBeLessThanOrEqual(1);
    if (lebar === 390) expect(await p.evaluate(() => document.documentElement.scrollWidth), `${nama} scrollWidth di 390`).toBeLessThanOrEqual(390);
    if (lebar === 390 && tanpaGeser) {
      const meluap = await p.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("main .bungkus-tabel, main table")]
          .filter((el) => el.checkVisibility() && el.getBoundingClientRect().width > 0)
          .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
          .map((el) => el.getAttribute("aria-label") ?? el.className),
      );
      expect(meluap, `${nama}: tabel meluap atau bergeser di 390`).toEqual([]);
    }
    await p.screenshot({ path: `${POTRET}/${nama}-${lebar}.png`, fullPage: true });
  }
  await p.setViewportSize({ width: 1440, height: 900 });
}

async function konfirmasi(p: Page, alasan?: string) {
  const d = p.getByRole("dialog");
  await expect(d).toBeVisible();
  if (alasan) await d.getByLabel(/Alasan/).fill(alasan);
  await d.locator('button[type="submit"]').click();
  await expect(d).toBeHidden();
}

test.describe.configure({ mode: "serial" });

let kodeEvent = "";

test.beforeAll(async ({ browser }) => {
  sesi.hrd = await bukaSesi(browser, "hrd", "hrd12345");
  sesi.kapten = await bukaSesi(browser, "kapten", "kapten123");
  sesi.kapten2 = await bukaSesi(browser, "kapten2", "kapten123");
  sesi.owner = await bukaSesi(browser, "owner", "owner123");
});

test.afterAll(async () => {
  for (const s of Object.values(sesi)) await s.ctx.close();
  if (galatKonsol.length) console.log("Galat konsol:\n" + galatKonsol.join("\n"));
});

test("HRD mencatat event, sesi, penugasan, dan kehadiran", async () => {
  const p = sesi.hrd.page;
  await p.goto("/fee-event/event");
  await expect(p.getByRole("row", { name: /Gathering Tahunan PT Sinar Abadi/ })).toBeVisible();
  await potret(p, "hrd-daftar-event");
  await p.getByRole("link", { name: "Event baru" }).click();
  const f = p.getByRole("form", { name: "Event baru" });
  await f.getByLabel("Nama event").fill("Konser Amal Uji E2E");
  await f.getByLabel("Klien").fill("Yayasan Peduli Malang");
  await f.getByLabel("Tanggal mulai").fill("2026-11-27");
  await f.getByLabel("Tanggal selesai").fill("2026-11-28");
  await f.getByRole("button", { name: "Simpan" }).click();
  await p.waitForURL(/lihat=EVT-/);
  kodeEvent = new URL(p.url()).searchParams.get("lihat")!;
  await expect(p.getByText("Event ini belum punya kapten")).toBeVisible();

  const tambahSesi = async (nama: string, tanggal: string, mulai: string, selesai: string) => {
    await p.getByRole("link", { name: "Tambah sesi" }).click();
    const s = p.getByRole("form", { name: "Sesi baru" });
    await s.getByLabel("Nama sesi").fill(nama);
    await s.getByLabel("Tanggal").fill(tanggal);
    await s.getByLabel("Jam mulai").fill(mulai);
    await s.getByLabel("Jam selesai").fill(selesai);
    await s.getByRole("button", { name: "Simpan" }).click();
    await tungguToast(p, new RegExp(`Sesi ${nama} tersimpan`));
    await expect(p.getByRole("form", { name: "Sesi baru" })).toHaveCount(0);
  };
  // Sesi di luar tanggal event ditolak dengan pesan di isian.
  await p.getByRole("link", { name: "Tambah sesi" }).click();
  const salah = p.getByRole("form", { name: "Sesi baru" });
  await salah.getByLabel("Nama sesi").fill("Meeting");
  await salah.getByLabel("Tanggal").fill("2026-11-30");
  await salah.getByLabel("Jam mulai").fill("19:00");
  await salah.getByLabel("Jam selesai").fill("21:00");
  await salah.getByRole("button", { name: "Simpan" }).click();
  await expect(salah.getByText("Di luar tanggal event.")).toBeVisible();
  await salah.getByRole("link", { name: "Batal" }).click();
  await tambahSesi("Loading in", "2026-11-27", "13:00", "21:00");
  await tambahSesi("Hari H", "2026-11-28", "08:00", "17:00");

  const tugaskan = async (crew: string, jabatan: RegExp) => {
    await p.getByRole("link", { name: "Tugaskan crew" }).click();
    const t = p.getByRole("form", { name: "Tugaskan crew" });
    const opsi = await t.getByLabel("Crew").locator("option").filter({ hasText: crew }).getAttribute("value");
    await t.getByLabel("Crew").selectOption(opsi!);
    const j = await t.getByLabel("Jabatan event").locator("option").filter({ hasText: jabatan }).getAttribute("value");
    await t.getByLabel("Jabatan event").selectOption(j!);
    await t.getByRole("button", { name: "Simpan" }).click();
    await tungguToast(p, /ditugaskan sebagai/);
    await expect(p.getByRole("form", { name: "Tugaskan crew" })).toHaveCount(0);
  };
  // Mulai dengan Bima sebagai Crew, lalu ganti jabatannya menjadi Kapten (ganti kapten lewat ubah penugasan).
  await tugaskan("Bima Satria", /^Crew Event/);
  await tugaskan("Rizky Pratama", /^Crew Event/);
  await tugaskan("Arif Hidayat", /^Crew Event/);
  await p.getByRole("row", { name: /Bima Satria/ }).getByRole("link", { name: "Ganti jabatan" }).click();
  const g = p.getByRole("form", { name: "Ubah penugasan" });
  await g.getByLabel("Jabatan event").selectOption((await g.getByLabel("Jabatan event").locator("option").filter({ hasText: /^Kapten Event/ }).getAttribute("value"))!);
  await g.getByRole("button", { name: "Simpan" }).click();
  await tungguToast(p, /diubah menjadi Kapten Event/);
  await expect(p.getByText("Event ini belum punya kapten")).toHaveCount(0);

  const catat = async (namaSesi: string, crew: string, masuk: string, pulang: string, progres: string) => {
    await p.getByRole("link", { name: "Catat kehadiran" }).nth(namaSesi === "Loading in" ? 0 : 1).click();
    const k = p.getByRole("form", { name: `Catat kehadiran: ${namaSesi}` });
    const v = await k.getByLabel("Crew").locator("option").filter({ hasText: crew }).getAttribute("value");
    await k.getByLabel("Crew").selectOption(v!);
    await k.getByLabel("Jam masuk").fill(masuk);
    await k.getByLabel("Jam pulang").fill(pulang);
    await k.getByLabel("Catatan progres").fill(progres);
    await k.getByRole("button", { name: "Simpan" }).click();
    await tungguToast(p, /Kehadiran tersimpan/);
    await expect(k).toHaveCount(0);
  };
  await catat("Loading in", "Bima Satria", "12:45", "21:00", "Briefing dan atur bongkar muat");
  await catat("Loading in", "Rizky Pratama", "13:00", "21:00", "Pasang panggung");
  await catat("Loading in", "Arif Hidayat", "13:00", "20:00", "Pasang lighting");
  await catat("Hari H", "Rizky Pratama", "08:00", "17:00", "Stage crew");
  await p.getByRole("link", { name: "Catat kehadiran" }).nth(1).click();
  await potret(p, "hrd-form-kehadiran");
  const k = p.getByRole("form", { name: "Catat kehadiran: Hari H" });
  await k.getByLabel("Crew").selectOption((await k.getByLabel("Crew").locator("option").filter({ hasText: "Arif Hidayat" }).getAttribute("value"))!);
  await k.getByLabel("Jam masuk").fill("08:00");
  await k.getByLabel("Jam pulang").fill("17:00");
  await k.getByLabel("Catatan progres").fill("Operator lighting");
  await k.getByRole("button", { name: "Simpan" }).click();
  await tungguToast(p, /Kehadiran tersimpan/);
  await expect(p.getByText("4 crew belum dinilai")).toBeVisible();
  await potret(p, "hrd-detail-event");
  // Layar HP: kehadiran tampil sebagai kartu, tombol Ubah dan Hapus bisa dipakai dari kartu.
  await p.setViewportSize({ width: 390, height: 844 });
  const kartuHadir = p.getByRole("list", { name: "Kehadiran Hari H (ringkas)" });
  await expect(p.getByRole("table", { name: "Kehadiran Hari H" })).toBeHidden();
  const arifHp = kartuHadir.getByRole("listitem").filter({ hasText: "Arif Hidayat" });
  await expect(arifHp).toContainText("tercatat 9 jam");
  await arifHp.getByRole("link", { name: "Ubah" }).click();
  await expect(p.getByRole("form", { name: "Ubah kehadiran: Hari H" })).toBeVisible();
  await potret(p, "hrd-form-ubah-kehadiran");
  await p.getByRole("form", { name: "Ubah kehadiran: Hari H" }).getByRole("link", { name: "Batal" }).click();
  await p.setViewportSize({ width: 390, height: 844 });
  await expect(kartuHadir).toBeVisible();
  await kartuHadir.getByRole("listitem").filter({ hasText: "Rizky Pratama" }).getByRole("button", { name: "Hapus" }).click();
  await expect(p.getByRole("dialog")).toContainText("Hapus kehadiran Rizky Pratama?");
  await p.getByRole("dialog").getByRole("button", { name: "Batal" }).click();
  await p.setViewportSize({ width: 1440, height: 900 });
});

test("akses terlarang lewat URL: kapten tidak membuka halaman staf dan event kapten lain", async () => {
  const p = sesi.kapten.page;
  for (const alamat of ["/sdm/distribusi", "/fee-event/keputusan", "/fee-event/event", "/pelaporan/neraca-saldo", "/master/sdm"]) {
    await p.goto(alamat);
    await expect(p).toHaveURL(/\/tanpa-akses$/);
  }
  await expect(p.getByText("Akun kapten hanya bisa membuka dashboard")).toBeVisible();
  await potret(p, "kapten-tanpa-akses");
  await p.goto("/kapten?lihat=EVT-2026-0002");
  await expect(p.getByText("bukan event yang kamu pegang")).toBeVisible();
  await expect(p.getByText("Wedding Expo")).toHaveCount(0);
  // Menu kapten hanya Dashboard dan Penilaian Crew.
  await p.goto("/");
  const menu = p.getByRole("navigation", { name: "Menu utama" }).first().getByRole("link");
  await expect(menu).toHaveText([/Dashboard/, /Penilaian Crew/]);
  await expect(p.getByText("Saldo kas")).toHaveCount(0);
});

test("kapten menilai crew (satu KURANG) lalu mengirim laporan; tidak bisa menilai dirinya sendiri", async () => {
  const p = sesi.kapten.page;
  await p.goto("/");
  await expect(p.getByText("Nilai progres crew Konser Amal Uji E2E")).toBeVisible();
  await potret(p, "kapten-dashboard");
  await p.goto("/kapten");
  await potret(p, "kapten-daftar-event");
  await p.goto(`/kapten?lihat=${kodeEvent}`);
  await expect(p.getByRole("button", { name: "Kirim laporan ke Owner" })).toBeDisabled();
  // Baris kapten sendiri tanpa tombol penilaian.
  await expect(p.getByRole("group", { name: "Penilaian Bima Satria" })).toHaveCount(0);
  const grup = p.getByRole("group", { name: "Penilaian Rizky Pratama" });
  await expect(grup).toHaveCount(2);
  await grup.nth(0).getByRole("button", { name: "Sesuai" }).click();
  await tungguToast(p, /Penilaian Rizky Pratama tersimpan/);
  await grup.nth(1).getByRole("button", { name: "Sesuai" }).click();
  await expect(p.getByText("Masih ada 2 kehadiran crew")).toBeVisible();
  const arif = p.getByRole("group", { name: "Penilaian Arif Hidayat" });
  await arif.nth(0).getByRole("button", { name: "Sesuai" }).click();
  await expect(p.getByText("Masih ada 1 kehadiran crew")).toBeVisible();
  // Arif di Hari H: Kurang. Jam melebihi tercatat dan catatan kosong ditolak dengan pesan per isian.
  await arif.nth(1).getByRole("button", { name: "Kurang" }).click();
  await arif.nth(1).getByLabel("Jam diakui").fill("9:30");
  await arif.nth(1).getByRole("button", { name: "Simpan penilaian kurang" }).click();
  await expect(arif.nth(1).getByText("Tulis catatan")).toBeVisible();
  await arif.nth(1).getByLabel("Catatan untuk Owner").fill("Hilang 2 jam saat sesi siang, lighting dipegang crew lain.");
  await arif.nth(1).getByRole("button", { name: "Simpan penilaian kurang" }).click();
  await expect(arif.nth(1).getByText(/Maksimal 9 jam/)).toBeVisible();
  await arif.nth(1).getByLabel("Jam diakui").fill("7:00");
  await potret(p, "kapten-penilaian-kurang");
  await arif.nth(1).getByRole("button", { name: "Simpan penilaian kurang" }).click();
  await tungguToast(p, /Penilaian Arif Hidayat tersimpan/);

  // Akses terlarang lewat server action: kirim ulang aksi penilaian untuk kehadiran kapten sendiri dan kehadiran di event kapten lain.
  const contoh = sesi.kapten.aksi.findLast((a) => a.body.includes('"penilaian"'))!;
  expect(contoh, "permintaan aksi penilaian tertangkap").toBeTruthy();
  const isi = JSON.parse(contoh.body)[0];
  const idDiri = Number(await p.locator("li", { hasText: "Bima Satria" }).first().getAttribute("data-kehadiran"));
  expect(idDiri).toBeGreaterThan(0);
  expect(await kirimAksi(sesi.kapten, contoh, [{ ...isi, id: idDiri, penilaian: "SESUAI" }])).toContain("tidak boleh menilai kehadirannya sendiri");
  const idLain = Number(process.env.E2E_ID_KEHADIRAN_LAIN ?? 0) || (await idKehadiranEventLain());
  expect(await kirimAksi(sesi.kapten, contoh, [{ ...isi, id: idLain, penilaian: "SESUAI" }])).toContain("bukan event yang kamu pegang");

  await expect(p.getByRole("button", { name: "Kirim laporan ke Owner" })).toBeEnabled();
  await p.getByRole("button", { name: "Kirim laporan ke Owner" }).click();
  const d = p.getByRole("dialog");
  await d.getByLabel("Catatan umum (opsional)").fill("Arif sempat hilang di Hari H.");
  await d.getByRole("button", { name: "Kirim laporan" }).click();
  await tungguToast(p, /Laporan FEE-2026-\d+ dikirim ke Owner/);
  await expect(p.getByText("Laporanmu sudah dikirim")).toBeVisible();
});

/** Id kehadiran crew di EVT-2026-0002 (milik kapten2), diambil dari halaman kapten2. */
async function idKehadiranEventLain(): Promise<number> {
  const p = sesi.kapten2.page;
  await p.goto("/kapten?lihat=EVT-2026-0002");
  return Number(await p.locator("li[data-kehadiran]", { hasText: "Yoga Firmansyah" }).first().getAttribute("data-kehadiran"));
}

test("kapten2 melihat event miliknya (penilaian belum dimulai)", async () => {
  const p = sesi.kapten2.page;
  await p.goto("/kapten?lihat=EVT-2026-0002");
  await expect(p.getByRole("heading", { name: "Wedding Expo Malang 2026" })).toBeVisible();
  await expect(p.getByText("Konser Amal")).toHaveCount(0);
  await potret(p, "kapten2-penilaian");
});

test("Owner menolak laporan, kapten menilai ulang dan mengirim lagi", async () => {
  const p = sesi.owner.page;
  await p.goto("/");
  await expect(p.getByText(/laporan kapten menunggu keputusan fee/)).toBeVisible();
  await p.goto("/fee-event/keputusan");
  await potret(p, "owner-daftar-laporan");
  await p.getByRole("row", { name: /Konser Amal Uji E2E/ }).getByRole("link", { name: "Putuskan" }).click();
  await expect(p.getByText("1 kehadiran dinilai kurang oleh kapten")).toBeVisible();
  await expect(p.getByText("Hilang 2 jam saat sesi siang")).toBeVisible();
  await p.getByRole("button", { name: "Tolak" }).click();
  await konfirmasi(p, "Jam Arif di Hari H tolong dicek ulang dengan HRD.");
  await tungguToast(p, /ditolak/);

  const k = sesi.kapten.page;
  await k.goto(`/kapten?lihat=${kodeEvent}`);
  await expect(k.getByText("Owner menolak laporan sebelumnya")).toBeVisible();
  const arif = k.getByRole("group", { name: "Penilaian Arif Hidayat" }).nth(1);
  await arif.getByLabel("Jam diakui").fill("8:00");
  await arif.getByRole("button", { name: "Simpan penilaian kurang" }).click();
  await tungguToast(k, /Penilaian Arif Hidayat tersimpan/);
  await k.getByRole("button", { name: "Kirim laporan ke Owner" }).click();
  await k.getByRole("dialog").getByRole("button", { name: "Kirim laporan" }).click();
  await tungguToast(k, /dikirim ke Owner/);
});

test("Owner menilai kapten, mengubah satu fee (alasan wajib), menyetujui; HRD tidak bisa menyetujui lewat aksi langsung", async () => {
  const p = sesi.owner.page;
  await p.goto("/fee-event/keputusan");
  await p.getByRole("row", { name: /Konser Amal Uji E2E/ }).filter({ hasText: "Diajukan" }).getByRole("link", { name: "Putuskan" }).click();
  await p.waitForURL(/lihat=FEE-/);
  const no = new URL(p.url()).searchParams.get("lihat")!;
  // Kehadiran kapten dinilai Owner.
  await p.getByRole("group", { name: /Penilaian Bima Satria/ }).getByRole("button", { name: "Sesuai" }).click();
  await tungguToast(p, /Penilaian Bima Satria tersimpan/);
  await potret(p, "owner-keputusan");

  const fee = p.getByLabel("Fee akhir Rizky Pratama");
  const usulan = Number((await fee.inputValue()).replace(/\D/g, ""));
  expect(usulan).toBe(17 * 20_000); // 8 jam loading in + 9 jam hari H
  await fee.fill(String(usulan + 50_000));
  await p.getByRole("button", { name: "Setujui dan bayar" }).click();
  await p.getByRole("dialog").getByRole("button", { name: "Setujui dan bayar" }).click();
  await expect(p.getByText("Tulis alasan karena fee berbeda dari usulan.")).toBeVisible();

  // Aksi setujui yang tertangkap dikirim ulang dengan sesi HRD dan Kapten: ditolak.
  const contoh = sesi.owner.aksi.findLast((a) => a.body.includes('"fee"'))!;
  expect(await kirimAksi(sesi.hrd, contoh, JSON.parse(contoh.body))).toContain("hanya untuk Owner");
  expect(await kirimAksi(sesi.kapten, contoh, JSON.parse(contoh.body))).toContain("hanya untuk Owner");

  await p.getByLabel("Alasan perubahan").fill("Bonus lembur setting ulang panggung");
  await p.getByRole("button", { name: "Setujui dan bayar" }).click();
  await p.getByRole("dialog").getByRole("button", { name: "Setujui dan bayar" }).click();
  await tungguToast(p, new RegExp(`${no} disetujui. Jurnal JU-2026-\\d+ dibuat`));
  await expect(p.getByRole("heading", { name: `Laporan ${no}` })).toBeVisible();
  await expect(p.getByRole("table", { name: "Slip fee" }).getByText("Diubah: Bonus lembur")).toBeVisible();
  await potret(p, "owner-disetujui");
  const jurnal = (await p.locator(".kartu", { hasText: "Jurnal" }).locator(".angka").first().textContent())!.trim();
  expect(jurnal).toMatch(/^JU-2026-\d{4}$/);

  await p.getByRole("link", { name: "Cetak semua slip" }).click();
  await expect(p.getByRole("article", { name: /Slip fee/ })).toHaveCount(3);
  await expect(p.getByRole("article", { name: "Slip fee Rizky Pratama" }).getByText("Dibayar").first()).toBeVisible();
  await potret(p, "owner-slip-fee");

  await p.goto("/pelaporan/jurnal-umum?periode=2026-11");
  await expect(p.getByText(/Fee event Konser Amal Uji E2E/).first()).toBeVisible();
  await p.goto(`/fee-event/event?lihat=${kodeEvent}`);
  await expect(p.getByText("Fee event ini sudah dibayar")).toBeVisible();
});

test("halaman master dan pengguna untuk fee event", async () => {
  const p = sesi.owner.page;
  await p.goto("/master/sdm?tab=jabatanEvent");
  await expect(p.getByRole("row", { name: /Kapten Event/ })).toContainText("200.000");
  await potret(p, "owner-master-jabatan-event", false); // tabel master bersama (modul lama), di luar lingkup kartu
  await p.goto("/master/sdm?tab=karyawan");
  await expect(p.getByRole("row", { name: /Bima Satria/ })).toContainText("Event (fee)");
  await potret(p, "owner-master-karyawan", false);
  await p.goto("/pengguna?form=baru");
  await p.getByLabel("Peran").selectOption("KAPTEN");
  await expect(p.getByLabel("Crew yang dipegang")).toBeVisible();
  await potret(p, "owner-pengguna-kapten", false);
  const h = sesi.hrd.page;
  await h.goto("/master/sdm?tab=jabatanEvent");
  await expect(h.getByText("hanya bisa melihat jabatan event")).toBeVisible();
  await expect(h.getByRole("link", { name: "Jabatan event baru" })).toHaveCount(0);
});

test("gaji inhouse tetap jalan: presensi lalu Hitung Gaji, crew event tidak ikut", async () => {
  const p = sesi.hrd.page;
  await p.goto("/sdm/presensi?periode=2026-11&form=baru");
  const f = p.locator("form").filter({ has: p.locator("#pr-karyawan") });
  await expect(f.getByLabel("Karyawan").locator("option", { hasText: "Bima Satria" })).toHaveCount(0);
  await f.getByLabel("Karyawan").selectOption("KRY-02");
  await f.getByLabel("Tanggal").fill("2026-11-03");
  await f.getByLabel("Absensi").selectOption("HADIR");
  await f.getByLabel("Jam masuk").fill("08:00");
  await f.getByLabel("Jam keluar").fill("17:00");
  await f.getByRole("button", { name: "Simpan" }).click();
  await tungguToast(p, /Presensi tersimpan/);
  await p.goto("/sdm/hitung-gaji?periode=2026-11");
  await expect(p.getByText("Bima Satria")).toHaveCount(0);
  await p.getByRole("button", { name: /Hitung dan simpan semua/ }).click();
  await konfirmasi(p);
  await tungguToast(p, /slip gaji November 2026 disimpan sebagai draf/);
  expect(galatKonsol, galatKonsol.join("\n")).toEqual([]);
});
