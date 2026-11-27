/*
 * Kueri halaman Investasi Kas: daftar setoran dan ringkasan "Dari mana kas dan modal".
 * Ringkasan dihitung oleh ringkasModal (src/lib/inti/modal.ts) dari jurnal DISETUJUI, lalu dicocokkan dengan saldo
 * buku besar lewat agregasi SQL terpisah (saldoAkun), supaya selisih sekecil apa pun langsung terlihat di halaman.
 */
import { db, type DbAtauTx } from "@/lib/server/db";
import { saldoAkun } from "@/lib/server/jurnal";
import { AKUN, AKUN_MODAL_SEMUA } from "@/lib/inti/akun";
import { ringkasModal, type JurnalSumber, type RingkasanModal } from "@/lib/inti/modal";
import { dariDate } from "@/lib/inti/tanggal";
import type { StatusPersetujuan } from "@/generated/prisma/enums";

export type DataSetoran = {
  no: string;
  tanggal: string;
  jumlah: number;
  keterangan: string;
  status: StatusPersetujuan;
  alasanTolak: string | null;
  jurnalNo: string | null;
  dibuatOleh: string;
  dibuatPada: string;
  diputuskanOleh: string | null;
  diputuskanPada: string | null;
};

export async function daftarSetoran(klien: DbAtauTx = db): Promise<DataSetoran[]> {
  const daftar = await klien.investasiKas.findMany({
    orderBy: [{ tanggal: "asc" }, { no: "asc" }],
    include: { dibuatOleh: { select: { nama: true } }, diputuskanOleh: { select: { nama: true } } },
  });
  return daftar.map((s) => ({
    no: s.no,
    tanggal: dariDate(s.tanggal),
    jumlah: s.jumlah,
    keterangan: s.keterangan,
    status: s.status,
    alasanTolak: s.alasanTolak,
    jurnalNo: s.jurnalNo,
    dibuatOleh: s.dibuatOleh.nama,
    dibuatPada: s.dibuatPada.toISOString(),
    diputuskanOleh: s.diputuskanOleh?.nama ?? null,
    diputuskanPada: s.diputuskanPada?.toISOString() ?? null,
  }));
}

/** Jurnal DISETUJUI yang menyentuh Kas atau salah satu akun modal, beserta sumbernya (bahan ringkasModal). */
export async function muatJurnalSumber(klien: DbAtauTx = db): Promise<JurnalSumber[]> {
  const daftar = await klien.jurnal.findMany({
    where: { status: "DISETUJUI", detail: { some: { akunKode: { in: [AKUN.KAS, ...AKUN_MODAL_SEMUA] } } } },
    orderBy: [{ tanggal: "asc" }, { no: "asc" }],
    select: {
      no: true, tanggal: true, periodeId: true, status: true, jenis: true, sumberTipe: true, sumberId: true, keterangan: true,
      detail: { orderBy: { noUrut: "asc" }, select: { akunKode: true, debit: true, kredit: true } },
    },
  });
  return daftar.map((j) => ({
    no: j.no,
    tanggal: dariDate(j.tanggal),
    periode: j.periodeId,
    status: j.status,
    jenis: j.jenis,
    sumberTipe: j.sumberTipe,
    sumberId: j.sumberId,
    keterangan: j.keterangan,
    baris: j.detail.map((d) => ({ akun: d.akunKode, debit: d.debit, kredit: d.kredit })),
  }));
}

export type CocokBukuBesar = {
  kas: number;
  /** Modal Pemilik 3-110. */
  modal: number;
  modalInvestor: number;
  modalHibah: number;
  kasCocok: boolean;
  modalCocok: boolean;
  modalInvestorCocok: boolean;
  modalHibahCocok: boolean;
};

/** Ringkasan satu periode atau kumulatif (null), plus saldo Kas dan tiap akun modal di buku besar untuk pembanding. */
export async function ringkasanKasModal(periode: string | null, klien: DbAtauTx = db): Promise<{ ringkasan: RingkasanModal; bukuBesar: CocokBukuBesar }> {
  const [jurnal, kas, modal, modalInvestor, modalHibah] = await Promise.all([
    muatJurnalSumber(klien),
    saldoAkun(klien, AKUN.KAS, periode),
    saldoAkun(klien, AKUN.MODAL, periode),
    saldoAkun(klien, AKUN.MODAL_INVESTOR, periode),
    saldoAkun(klien, AKUN.MODAL_HIBAH, periode),
  ]);
  const r = ringkasModal(jurnal, periode);
  return {
    ringkasan: r,
    bukuBesar: {
      kas, modal, modalInvestor, modalHibah,
      kasCocok: kas === r.kas.akhir,
      modalCocok: modal === r.modal.akhir,
      modalInvestorCocok: modalInvestor === r.modalInvestor.akhir,
      modalHibahCocok: modalHibah === r.modalHibah.akhir,
    },
  };
}
