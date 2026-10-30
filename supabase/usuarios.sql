-- Tabla de usuarios del panel de administración.
-- Ejecutar en Supabase: SQL Editor → New query → pegar → Run.

create table if not exists public.usuarios (
  id         bigint generated always as identity primary key,
  nombre     text not null check (char_length(nombre) between 1 and 100),
  telefono   text not null unique check (telefono ~ '^\+?[0-9]{7,15}$'),
  rol        text not null default 'Usuario' check (rol in ('Admin', 'Usuario', 'Invitado')),
  created_at timestamptz not null default now()
);

-- Seguridad: sin estas políticas nadie puede leer ni escribir la tabla.
alter table public.usuarios enable row level security;

grant select, insert, update, delete on public.usuarios to authenticated;

create policy "usuarios_select_autenticados" on public.usuarios
  for select to authenticated using (true);

create policy "usuarios_insert_autenticados" on public.usuarios
  for insert to authenticated with check (true);

create policy "usuarios_update_autenticados" on public.usuarios
  for update to authenticated using (true) with check (true);

create policy "usuarios_delete_autenticados" on public.usuarios
  for delete to authenticated using (true);

-- Hace que la API de Supabase detecte la tabla nueva de inmediato.
notify pgrst, 'reload schema';
