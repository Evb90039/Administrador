-- Agrega los datos de la pestaña "Compra" a la tabla productos (no borra datos existentes).
-- Ejecutar en Supabase: SQL Editor → New query → pegar → Run.

alter table public.productos
  add column if not exists tarjeta            text check (char_length(tarjeta) <= 60),
  add column if not exists precio_compra      numeric(12, 2) not null default 0 check (precio_compra >= 0),
  add column if not exists dinero_reembolsado numeric(12, 2) check (dinero_reembolsado >= 0),
  add column if not exists reembolso_via      text check (char_length(reembolso_via) <= 60);

-- El default 0 solo sirve para rellenar productos ya existentes; los nuevos deben traer precio.
alter table public.productos alter column precio_compra drop default;

-- No se puede reembolsar más de lo que se pagó.
alter table public.productos drop constraint if exists productos_reembolso_max;
alter table public.productos add constraint productos_reembolso_max
  check (dinero_reembolsado is null or dinero_reembolsado <= precio_compra);

notify pgrst, 'reload schema';
