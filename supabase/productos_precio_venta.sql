-- Precio de venta de cada producto (lo que se pide por él en el catálogo).
-- Ejecutar en Supabase: SQL Editor → New query → pegar → Run.

alter table public.productos
  add column if not exists precio_venta numeric(12, 2) check (precio_venta >= 0);

notify pgrst, 'reload schema';
