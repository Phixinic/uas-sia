/*
 * Tes fungsi murni fee event (tanpa database): potong ke jadwal sesi, penilaian KURANG, tarif per jam dan per hari,
 * PPh 21 bukan pegawai, baris jurnal, dan skema penilaian.
 */
import { describe, expect, it } from "vitest";
import {
  durasiKeMenit, feeDariMenit, hitungFeeOrang, labelDurasi, menitDiakuiKehadiran, menitKeDurasi, menitTercatat, pph21BukanPegawai, TARIF_BAWAAN,
  type KehadiranHitung,
} from "@/lib/inti/fee-event";
import { barisFeeEvent, validasiBaris } from "@/lib/inti/jurnal";
import { skemaPenilaian, skemaSesi, skemaSetujuiFee } from "@/lib/skema/fee-event";

const sesi = (id: number, tanggal: string, jamMulai: string, jamSelesai: string) => ({ id, tanggal, jamMulai, jamSelesai });
const hadir = (s: ReturnType<typeof sesi>, jamMasuk: string, jamPulang: string, penilaian: "SESUAI" | "KURANG" | null = null, menitDiakui: number | null = null): KehadiranHitung => ({ sesi: s, jamMasuk, jamPulang, penilaian, menitDiakui });

describe("menit tercatat dipotong ke jadwal sesi", () => {
  const s = { jamMulai: "07:00", jamSelesai: "16:00" };
  it("datang lebih awal dan pulang terlambat tidak dihitung", () => expect(menitTercatat(s, { jamMasuk: "06:30", jamPulang: "17:30" })).toBe(540));
  it("terlambat datang dan pulang lebih awal mengurangi menit", () => expect(menitTercatat(s, { jamMasuk: "07:15", jamPulang: "15:00" })).toBe(465));
  it("di luar jadwal sama sekali = 0, tidak pernah negatif", () => expect(menitTercatat(s, { jamMasuk: "17:00", jamPulang: "18:00" })).toBe(0));
});

describe("penilaian", () => {
  const s = sesi(1, "2026-11-14", "16:00", "22:00");
  it("SESUAI dan belum dinilai = menit tercatat penuh", () => {
    expect(menitDiakuiKehadiran(hadir(s, "16:00", "22:00", "SESUAI"))).toBe(360);
    expect(menitDiakuiKehadiran(hadir(s, "16:00", "22:00", null))).toBe(360);
  });
  it("KURANG = jam diakui penilai, tetapi tidak pernah melebihi menit tercatat", () => {
    expect(menitDiakuiKehadiran(hadir(s, "16:00", "22:00", "KURANG", 240))).toBe(240);
    expect(menitDiakuiKehadiran(hadir(s, "16:00", "22:00", "KURANG", 999))).toBe(360);
    expect(menitDiakuiKehadiran(hadir(s, "16:00", "22:00", "KURANG", 0))).toBe(0);
  });
});

describe("fee per orang", () => {
  const meeting = sesi(1, "2026-11-10", "19:00", "21:00");
  const hariH = sesi(2, "2026-11-14", "07:00", "16:00");
  const loadingOut = sesi(3, "2026-11-14", "16:00", "22:00");

  it("crew per jam: jam diakui x Rp20.000, lembur di atas 8 jam per sesi ditandai dengan tarif sama", () => {
    const h = hitungFeeOrang({ satuanTarif: "JAM", tarif: TARIF_BAWAAN.CREW_PER_JAM, kehadiran: [hadir(meeting, "19:00", "21:00", "SESUAI"), hadir(hariH, "07:00", "16:00", "SESUAI"), hadir(loadingOut, "16:00", "22:00", "KURANG", 240)] });
    expect(h.menitDiakui).toBe(120 + 540 + 240);
    expect(h.menitTercatat).toBe(120 + 540 + 360);
    expect(h.menitLembur).toBe(60);
    expect(h.jumlahKurang).toBe(1);
    expect(h.fee).toBe(300_000); // 15 jam x 20.000
  });

  it("menit tidak bulat dibulatkan ke rupiah terdekat", () => {
    expect(feeDariMenit(1, 20_000)).toBe(333);
    expect(hitungFeeOrang({ satuanTarif: "JAM", tarif: 20_000, kehadiran: [hadir(hariH, "07:15", "16:00")] }).fee).toBe(175_000); // 8 jam 45 menit
  });

  it("kapten per hari: jumlah tanggal berbeda yang dihadiri x Rp200.000 (dua sesi di tanggal sama = satu hari)", () => {
    const h = hitungFeeOrang({ satuanTarif: "HARI", tarif: TARIF_BAWAAN.KAPTEN_PER_HARI, kehadiran: [hadir(meeting, "19:00", "21:00"), hadir(hariH, "06:45", "16:00"), hadir(loadingOut, "16:00", "22:15")] });
    expect(h.jumlahHari).toBe(2);
    expect(h.jumlahSesi).toBe(3);
    expect(h.fee).toBe(400_000);
  });

  it("hari dengan jam diakui 0 (KURANG 0:00 atau di luar jadwal) tidak dihitung", () => {
    const h = hitungFeeOrang({ satuanTarif: "HARI", tarif: 200_000, kehadiran: [hadir(meeting, "19:00", "21:00", "KURANG", 0), hadir(hariH, "17:00", "18:00")] });
    expect(h.jumlahHari).toBe(0);
    expect(h.fee).toBe(0);
  });

  it("data contoh EVT-2026-0001: total usulan Rp2.255.000", () => {
    const li = sesi(2, "2026-11-13", "13:00", "21:00");
    const hh = sesi(3, "2026-11-14", "07:00", "16:00");
    const lo = sesi(4, "2026-11-14", "16:00", "22:00");
    const kapten = hitungFeeOrang({ satuanTarif: "HARI", tarif: 200_000, kehadiran: [hadir(meeting, "19:00", "21:00"), hadir(li, "12:45", "21:00"), hadir(hh, "06:45", "16:00"), hadir(lo, "16:00", "22:15")] });
    const crew = (k: KehadiranHitung[]) => hitungFeeOrang({ satuanTarif: "JAM", tarif: 20_000, kehadiran: k }).fee;
    const total =
      kapten.fee +
      crew([hadir(meeting, "19:00", "21:00", "SESUAI"), hadir(li, "13:00", "21:00", "SESUAI"), hadir(hh, "07:00", "16:00", "SESUAI"), hadir(lo, "16:00", "22:00", "SESUAI")]) +
      crew([hadir(li, "13:30", "21:00", "SESUAI"), hadir(hh, "07:00", "16:00", "SESUAI"), hadir(lo, "16:00", "22:00", "KURANG", 240)]) +
      crew([hadir(hh, "07:00", "16:00", "SESUAI"), hadir(lo, "16:00", "22:00", "SESUAI")]) +
      crew([hadir(li, "13:00", "21:00", "SESUAI"), hadir(hh, "07:15", "16:00", "SESUAI"), hadir(lo, "16:00", "21:30", "SESUAI")]);
    expect(kapten.fee).toBe(600_000);
    expect(total).toBe(2_255_000);
  });
});

describe("PPh 21 bukan pegawai dan jurnal fee", () => {
  it("50% x bruto x 5%", () => {
    expect(pph21BukanPegawai(600_000)).toEqual({ bruto: 600_000, dpp: 300_000, pph21: 15_000, dibayar: 585_000 });
    expect(pph21BukanPegawai(410_000).pph21).toBe(10_250);
    expect(pph21BukanPegawai(0)).toEqual({ bruto: 0, dpp: 0, pph21: 0, dibayar: 0 });
  });

  it("jurnal: Dr beban fee per akun, Kr Utang PPh 21 dan Kas; seimbang", () => {
    const slip = [600_000, 500_000].map((b) => ({ akunBeban: "6-230", ...pph21BukanPegawai(b) }));
    const baris = validasiBaris(barisFeeEvent(slip));
    expect(baris).toEqual([
      { akun: "6-230", debit: 1_100_000, kredit: 0 },
      { akun: "2-120", debit: 0, kredit: 27_500 },
      { akun: "1-110", debit: 0, kredit: 1_072_500 },
    ]);
  });
});

describe("durasi dan skema", () => {
  it("durasi jam:menit", () => {
    expect(durasiKeMenit("4:30")).toBe(270);
    expect(durasiKeMenit("04:05")).toBe(245);
    expect(durasiKeMenit("4.5")).toBeNull();
    expect(menitKeDurasi(270)).toBe("4:30");
    expect(labelDurasi(450)).toBe("7 jam 30 menit");
    expect(labelDurasi(480)).toBe("8 jam");
  });

  it("KURANG wajib catatan dan jam diakui; SESUAI tidak", () => {
    expect(skemaPenilaian.safeParse({ id: 1, penilaian: "SESUAI" }).success).toBe(true);
    const h = skemaPenilaian.safeParse({ id: 1, penilaian: "KURANG", jamDiakui: "", catatan: "" });
    expect(h.success).toBe(false);
    if (!h.success) expect(h.error.issues.map((i) => i.path[0]).sort()).toEqual(["catatan", "jamDiakui"]);
    expect(skemaPenilaian.safeParse({ id: 1, penilaian: "KURANG", jamDiakui: "4:00", catatan: "Pulang lebih awal" }).success).toBe(true);
  });

  it("jam selesai sesi harus sesudah jam mulai; fee akhir tidak boleh negatif", () => {
    expect(skemaSesi.safeParse({ eventKode: "EVT-2026-0001", nama: "Hari H", tanggal: "2026-11-14", jamMulai: "22:00", jamSelesai: "02:00" }).success).toBe(false);
    expect(skemaSetujuiFee.safeParse({ no: "FEE-2026-0001", fee: [{ karyawanKode: "KRY-06", feeAkhir: -1 }] }).success).toBe(false);
  });
});
