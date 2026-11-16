import Tabel from "@/komponen/ui/Tabel";
import Lencana from "@/komponen/ui/Lencana";
import Rupiah from "@/komponen/ui/Rupiah";
import type { BarisJurnal } from "@/lib/inti/jurnal";

/**
 * Tabel baris jurnal (pratinjau atau jurnal tersimpan). Baris kredit diberi indentasi seperti jurnal manual.
 * `namaAkun` = peta kode -> nama (ambil dengan petaAkun() di server). Aman dipakai di komponen server dan klien.
 */
export default function TabelJurnal({ baris, namaAkun }: { baris: BarisJurnal[]; namaAkun: Record<string, string> }) {
  const isi = baris.filter((b) => b.debit || b.kredit);
  const d = isi.reduce((s, b) => s + b.debit, 0);
  const k = isi.reduce((s, b) => s + b.kredit, 0);
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <Tabel label="Baris jurnal">
        <thead>
          <tr>
            <th>Akun</th>
            <th className="kolom-angka">Debit (Rp)</th>
            <th className="kolom-angka">Kredit (Rp)</th>
          </tr>
        </thead>
        <tbody>
          {isi.map((b, i) => (
            <tr key={i}>
              <td className={b.kredit ? "pl-10!" : ""}>
                <span className="kode mr-2">{b.akun}</span>
                {namaAkun[b.akun] ?? b.akun}
              </td>
              <td className="kolom-angka">{b.debit ? <Rupiah nilai={b.debit} polos /> : ""}</td>
              <td className="kolom-angka">{b.kredit ? <Rupiah nilai={b.kredit} polos /> : ""}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>
              Total <span className="ml-1">{d === k && d > 0 ? <Lencana warna="hijau">seimbang</Lencana> : <Lencana warna="merah">tidak seimbang</Lencana>}</span>
            </td>
            <td className="kolom-angka"><Rupiah nilai={d} polos /></td>
            <td className="kolom-angka"><Rupiah nilai={k} polos /></td>
          </tr>
        </tfoot>
      </Tabel>
    </div>
  );
}
