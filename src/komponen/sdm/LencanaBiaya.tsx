import Lencana from "@/komponen/ui/Lencana";

/**
 * Lencana perilaku biaya SDM di judul halaman dan slip: gaji inhouse = biaya tetap (komponen dari Setting Gaji),
 * fee crew event = biaya variabel (tarif x jam atau hari per event).
 */
export default function LencanaBiaya({ jenis }: { jenis: "tetap" | "variabel" }) {
  return jenis === "tetap" ? <Lencana warna="teal">Biaya tetap</Lencana> : <Lencana warna="kuning">Biaya variabel</Lencana>;
}
