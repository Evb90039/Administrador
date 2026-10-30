-- Limita "Reembolso vía" a Transferencia o PayPal (o vacío).
-- Ejecutar en Supabase: SQL Editor → New query → pegar → Run.

alter table public.productos drop constraint if exists productos_reembolso_via_valida;

-- "not valid": no revisa los productos ya guardados, solo los nuevos o editados.
alter table public.productos add constraint productos_reembolso_via_valida
  check (reembolso_via is null or reembolso_via in ('Transferencia', 'PayPal')) not valid;

notify pgrst, 'reload schema';
