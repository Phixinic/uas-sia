/*
 * zod dengan pesan galat bawaan berbahasa Indonesia. Semua skema di folder ini (dan skema masuk di aksi auth)
 * mengimpor `z` dari sini, bukan langsung dari "zod", supaya konfigurasi ini ikut termuat di server action
 * maupun di form klien.
 *
 * Pesan per isian tetap ditulis di skemanya masing-masing. Peta pesan di bawah hanya cadangan untuk kasus yang
 * tidak ditulis manual, misalnya isian yang tidak terkirim sama sekali (undefined) atau tipe data yang salah,
 * yang sebelumnya tampil sebagai pesan bawaan zod berbahasa Inggris.
 */
import { z } from "zod";

const pesanBawaan: z.core.$ZodErrorMap = (isu) => {
  switch (isu.code) {
    case "invalid_type":
      return isu.input === undefined || isu.input === null || isu.input === "" ? "Isian ini wajib diisi." : "Isian ini tidak valid.";
    case "too_small": {
      const min = Number(isu.minimum);
      if (isu.origin === "string") return min <= 1 ? "Isian ini wajib diisi." : `Isian ini minimal ${min} karakter.`;
      if (isu.origin === "array" || isu.origin === "set") return `Isi minimal ${min} baris.`;
      return isu.inclusive === false ? `Nilai harus lebih dari ${min}.` : `Nilai tidak boleh kurang dari ${min}.`;
    }
    case "too_big": {
      const maks = Number(isu.maximum);
      if (isu.origin === "string") return `Isian ini maksimal ${maks} karakter.`;
      if (isu.origin === "array" || isu.origin === "set") return `Maksimal ${maks} baris.`;
      return isu.inclusive === false ? `Nilai harus kurang dari ${maks}.` : `Nilai tidak boleh lebih dari ${maks}.`;
    }
    case "invalid_value":
      return "Pilihan tidak valid.";
    case "invalid_format":
      return "Format isian tidak valid.";
    case "not_multiple_of":
      return `Nilai harus kelipatan ${isu.divisor}.`;
    case "unrecognized_keys":
      return "Ada isian yang tidak dikenal.";
    default:
      return "Isian tidak valid.";
  }
};

z.config({ customError: pesanBawaan });

export { z };
