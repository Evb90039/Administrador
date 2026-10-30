-- Limita la tarjeta a las tarjetas registradas (o vacío).
-- Ejecutar en Supabase: SQL Editor → New query → pegar → Run.

alter table public.productos drop constraint if exists productos_tarjeta_valida;

-- "not valid": no revisa los productos ya guardados, solo los nuevos o editados.
alter table public.productos add constraint productos_tarjeta_valida
  check (
    tarjeta is null or tarjeta in (
      'BBVA 9154',
      'Bsmart 859',
      'Clasica 680',
      'Santander Like U 9966',
      'Mercadolibre 5584',
      'HomeDepot 344'
    )
  ) not valid;

notify pgrst, 'reload schema';
