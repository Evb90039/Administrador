-- Imagen principal de cada producto.
-- Ejecutar en Supabase: SQL Editor → New query → pegar → Run (después de imagenes.sql).

-- set null: si se borra la imagen principal, el producto queda sin principal
-- y la app muestra la primera imagen en su lugar.
alter table public.productos
  add column if not exists imagen_principal_id bigint
  references public.producto_imagenes (id) on delete set null;

notify pgrst, 'reload schema';
