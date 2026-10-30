-- Imágenes de productos: archivos en Supabase Storage + tabla que los relaciona con cada producto.
-- Ejecutar en Supabase: SQL Editor → New query → pegar → Run.

-- ===== Bucket privado =====
-- Máx. 5 MB por archivo y solo imágenes (Supabase rechaza lo demás aunque se salten la app).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Solo usuarios con sesión pueden ver, subir y borrar archivos de este bucket.
drop policy if exists "productos_storage_select" on storage.objects;
create policy "productos_storage_select" on storage.objects
  for select to authenticated using (bucket_id = 'productos');

drop policy if exists "productos_storage_insert" on storage.objects;
create policy "productos_storage_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'productos');

drop policy if exists "productos_storage_delete" on storage.objects;
create policy "productos_storage_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'productos');

-- ===== Tabla de relación =====
create table if not exists public.producto_imagenes (
  id          bigint generated always as identity primary key,
  -- cascade: al eliminar el producto se eliminan sus filas de imágenes.
  producto_id bigint not null references public.productos (id) on delete cascade,
  path        text not null unique check (char_length(path) <= 300),
  orden       int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists producto_imagenes_producto_id_idx on public.producto_imagenes (producto_id);

alter table public.producto_imagenes enable row level security;

grant select, insert, delete on public.producto_imagenes to authenticated;

drop policy if exists "producto_imagenes_select" on public.producto_imagenes;
create policy "producto_imagenes_select" on public.producto_imagenes
  for select to authenticated using (true);

drop policy if exists "producto_imagenes_insert" on public.producto_imagenes;
create policy "producto_imagenes_insert" on public.producto_imagenes
  for insert to authenticated with check (true);

drop policy if exists "producto_imagenes_delete" on public.producto_imagenes;
create policy "producto_imagenes_delete" on public.producto_imagenes
  for delete to authenticated using (true);

notify pgrst, 'reload schema';
