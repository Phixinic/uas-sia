export default function Memuat() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Memuat">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-40 animate-pulse rounded-xl bg-slate-200/70" />
    </div>
  );
}
