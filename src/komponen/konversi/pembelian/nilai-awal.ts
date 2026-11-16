/*
 * Nilai awal form pembelian. Dipisah dari komponen klien supaya komponen server boleh memanggil formKosong().
 */
import type { DasarN } from "@/lib/inti/penyusutan";
import type { CaraBayar } from "@/generated/prisma/enums";

export type Baris = { barangKode: string; qty: string; harga: string; residu: string; garansiBulan: string; masaManfaatBulan: string; dasarN: DasarN };
export type NilaiAwalForm = {
  no: string | null;
  tanggal: string;
  caraBayar: CaraBayar;
  jatuhTempo: string;
  supplierKode: string;
  keterangan: string;
  baris: Baris[];
};

export const barisKosong = (): Baris => ({ barangKode: "", qty: "1", harga: "", residu: "0", garansiBulan: "", masaManfaatBulan: "", dasarN: "GARANSI" });
export const formKosong = (tanggal: string): NilaiAwalForm => ({ no: null, tanggal, caraBayar: "TUNAI", jatuhTempo: "", supplierKode: "", keterangan: "", baris: [barisKosong()] });
