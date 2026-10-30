-- Categorías y productos.
-- Ejecutar en Supabase: SQL Editor → New query → pegar → Run.

-- ===== Categorías (estilo Amazon / Mercado Libre) =====
create table if not exists public.categorias (
  id     bigint generated always as identity primary key,
  nombre text not null unique check (char_length(nombre) between 1 and 60)
);

insert into public.categorias (nombre) values
  ('Electrónica'),
  ('Celulares y Accesorios'),
  ('Computación'),
  ('Videojuegos'),
  ('Hogar y Cocina'),
  ('Electrodomésticos'),
  ('Muebles'),
  ('Herramientas'),
  ('Automotriz'),
  ('Ropa y Moda'),
  ('Calzado'),
  ('Belleza y Cuidado Personal'),
  ('Salud'),
  ('Deportes y Fitness'),
  ('Juguetes'),
  ('Bebés'),
  ('Mascotas'),
  ('Libros'),
  ('Música y Películas'),
  ('Oficina y Papelería'),
  ('Jardín'),
  ('Alimentos y Bebidas'),
  ('Joyería y Relojes'),
  ('Otros')
on conflict (nombre) do nothing;

alter table public.categorias enable row level security;

grant select on public.categorias to authenticated;

create policy "categorias_select_autenticados" on public.categorias
  for select to authenticated using (true);

-- ===== Productos =====
create table if not exists public.productos (
  id           bigint generated always as identity primary key,
  fecha_compra date not null default current_date,
  nombre       text not null check (char_length(nombre) between 1 and 150),
  enlace       text check (enlace is null or (enlace ~* '^https?://' and char_length(enlace) <= 500)),
  tienda       text not null check (char_length(tienda) between 1 and 100),
  categoria_id bigint not null references public.categorias (id) on delete restrict,
  created_at   timestamptz not null default now()
);
-- Las columnas de la pestaña "Compra" se agregan en productos_compra.sql.

alter table public.productos enable row level security;

grant select, insert, update, delete on public.productos to authenticated;

create policy "productos_select_autenticados" on public.productos
  for select to authenticated using (true);

create policy "productos_insert_autenticados" on public.productos
  for insert to authenticated with check (true);

create policy "productos_update_autenticados" on public.productos
  for update to authenticated using (true) with check (true);

create policy "productos_delete_autenticados" on public.productos
  for delete to authenticated using (true);

-- Hace que la API de Supabase detecte las tablas nuevas de inmediato.
notify pgrst, 'reload schema';
