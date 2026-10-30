-- Agrega los datos de la pestaña "Estado" a la tabla productos (no borra datos existentes).
-- Ejecutar en Supabase: SQL Editor → New query → pegar → Run.

alter table public.productos
  add column if not exists resenado       boolean not null default false,
  add column if not exists disponibilidad text not null default 'Disponible';

alter table public.productos drop constraint if exists productos_disponibilidad_valida;
alter table public.productos add constraint productos_disponibilidad_valida
  check (disponibilidad in ('Disponible', 'Apartado', 'Regalado', 'Vendido'));

notify pgrst, 'reload schema';
