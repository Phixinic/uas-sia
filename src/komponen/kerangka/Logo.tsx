/*
 * Logo di sidebar dan halaman masuk. Bila public/logo.svg sudah ada (dibuat agen lain), gambar itu yang dipakai;
 * kalau belum, tampil placeholder teks. `adaLogo` dihitung di server (lihat src/lib/server/logo.ts).
 */
export default function Logo({ adaLogo, nama, keterangan, gelap }: { adaLogo: boolean; nama: string; keterangan?: string; gelap?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {adaLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/logo.svg" alt="" className="size-9 shrink-0 rounded-lg object-contain" />
      ) : (
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold ${gelap ? "bg-aksen text-white" : "bg-merek text-white"}`} aria-hidden>
          DP
        </span>
      )}
      <span className="flex min-w-0 flex-col leading-tight">
        <b className={`truncate text-[15px] ${gelap ? "text-white" : "text-slate-900"}`}>{nama}</b>
        {keterangan && <span className={`truncate text-[11px] ${gelap ? "text-merek-lembut/80" : "text-slate-500"}`}>{keterangan}</span>}
      </span>
    </div>
  );
}
