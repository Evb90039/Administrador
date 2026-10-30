-- Proveedores.
-- Ejecutar en Supabase: SQL Editor → New query → pegar → Run.

create table if not exists public.proveedores (
  id         bigint generated always as identity primary key,
  nombre     text not null check (char_length(nombre) between 1 and 100),
  telefono   text not null unique check (telefono ~ '^\+?[0-9]{7,15}$'),
  created_at timestamptz not null default now()
);

alter table public.proveedores enable row level security;

grant select, insert, update, delete on public.proveedores to authenticated;

drop policy if exists "proveedores_select_autenticados" on public.proveedores;
create policy "proveedores_select_autenticados" on public.proveedores
  for select to authenticated using (true);

drop policy if exists "proveedores_insert_autenticados" on public.proveedores;
create policy "proveedores_insert_autenticados" on public.proveedores
  for insert to authenticated with check (true);

drop policy if exists "proveedores_update_autenticados" on public.proveedores;
create policy "proveedores_update_autenticados" on public.proveedores
  for update to authenticated using (true) with check (true);

drop policy if exists "proveedores_delete_autenticados" on public.proveedores;
create policy "proveedores_delete_autenticados" on public.proveedores
  for delete to authenticated using (true);

-- Datos iniciales (teléfonos sin espacios ni guiones, igual que los guarda la app).
-- "Becky" venía duplicado con el mismo teléfono: on conflict lo ignora.
insert into public.proveedores (nombre, telefono) values
  ('Md Mahin Islam',     '+8801774547779'),
  ('kwan',               '+8615766699487'),
  ('~Jihadi Hasan',      '+8801954218501'),
  ('Yuki',               '+8615089436653'),
  ('Alice',              '+8613412318741'),
  ('Honest S_2',         '+5215659271364'),
  ('Zoey',               '+8618925446992'),
  ('kabirul5104',        '+8801401724215'),
  ('Becky',              '+8613048963090'),
  ('louis',              '+13602406779'),
  ('Anna',               '+8613345866284'),
  ('Angela',             '+8615521297424'),
  ('looking',            '+8613827205613'),
  ('Catherine Buettner', '+8619129340450'),
  ('Yolanda',            '+8613532681983'),
  ('Eric',               '+8617740687372')
on conflict (telefono) do nothing;

notify pgrst, 'reload schema';
