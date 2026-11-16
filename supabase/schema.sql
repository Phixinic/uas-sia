-- Skema database Supabase untuk SIA Laundry Sukses Mandiri.
-- Satu tabel dokumen: setiap koleksi aplikasi (jurnal, aset, slip, ...) disimpan sebagai baris dengan kolom `col`.
create table if not exists public.docs (
  col text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (col, id)
);
alter table public.docs enable row level security;
-- Akses terbuka untuk demo tugas kuliah (belum ada login). Jangan dipakai untuk data sungguhan.
create policy "demo_select" on public.docs for select to anon, authenticated using (true);
create policy "demo_insert" on public.docs for insert to anon, authenticated with check (true);
create policy "demo_update" on public.docs for update to anon, authenticated using (true) with check (true);
create policy "demo_delete" on public.docs for delete to anon, authenticated using (true);
alter publication supabase_realtime add table public.docs;
