-- Limita la tienda a Amazon o Mercado Libre.
-- Ejecutar en Supabase: SQL Editor → New query → pegar → Run.

alter table public.productos drop constraint if exists productos_tienda_valida;

-- "not valid": no revisa los productos ya guardados (no falla si alguno tiene otra tienda),
-- pero sí obliga a que todo producto nuevo o editado sea Amazon o Mercado Libre.
alter table public.productos add constraint productos_tienda_valida
  check (tienda in ('Amazon', 'Mercado Libre')) not valid;

notify pgrst, 'reload schema';
