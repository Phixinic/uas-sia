/*
 * Tes pesan validasi (tanpa database): semua pesan yang bisa terlihat pengguna berbahasa Indonesia,
 * termasuk saat form dikirim kosong (isian tidak terkirim sama sekali) atau tipe datanya salah.
 */
import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";
import { JENIS_MASTER, skemaIsiMaster, skemaProfil, skemaSimpanMaster, skemaStatusMaster } from "@/lib/skema/master";
import * as konversi from "@/lib/skema/konversi";
import * as pembelian from "@/lib/skema/pembelian";
import * as pelaporan from "@/lib/skema/pelaporan";
import * as pengguna from "@/lib/skema/pengguna";
import * as sdm from "@/lib/skema/sdm";

const INGGRIS = /invalid|expected|received|too small|too big|required|must|string|number|object|array/i;

const pesan = (skema: ZodType, nilai: unknown) => {
  const h = skema.safeParse(nilai);
  return h.success ? [] : h.error.issues.map((i) => i.message);
};

const SKEMA: Record<string, ZodType> = {
  skemaSimpanMaster, skemaStatusMaster, skemaProfil,
  ...Object.fromEntries(Object.entries({ ...konversi, ...pembelian, ...pelaporan, ...pengguna, ...sdm }).filter(([k]) => k.startsWith("skema")) as [string, ZodType][]),
};

describe("pesan validasi berbahasa Indonesia", () => {
  it("form master yang dikirim kosong: pesan per isian, bukan pesan bawaan berbahasa Inggris", () => {
    for (const jenis of JENIS_MASTER) {
      const isi = pesan(skemaIsiMaster(jenis), {});
      expect(isi.length, jenis).toBeGreaterThan(0);
      for (const m of isi) expect(m, `${jenis}: ${m}`).not.toMatch(INGGRIS);
    }
    const supplier = skemaIsiMaster("supplier").safeParse({});
    expect(supplier.success).toBe(false);
    if (!supplier.success) expect(supplier.error.issues.find((i) => i.path[0] === "nama")?.message).toBe("Nama supplier wajib diisi.");
    const jadwal = skemaIsiMaster("jadwal").safeParse({});
    if (!jadwal.success) expect(jadwal.error.issues.find((i) => i.path[0] === "jabatanKode")?.message).toBe("Pilih jabatan.");
  });

  it("semua skema: kosong, null, dan tipe salah tetap menghasilkan pesan Indonesia", () => {
    const masukan: unknown[] = [{}, null, undefined, "teks", 12, [], { no: 5, periode: 7, alasan: false, nilai: "x", baris: "x", id: "abc", aktif: "ya" }];
    for (const [nama, skema] of Object.entries(SKEMA)) {
      for (const x of masukan) {
        for (const m of pesan(skema, x)) expect(m, `${nama} ${JSON.stringify(x)}: ${m}`).not.toMatch(INGGRIS);
      }
    }
    expect(Object.keys(SKEMA).length).toBeGreaterThan(15);
  });
});
