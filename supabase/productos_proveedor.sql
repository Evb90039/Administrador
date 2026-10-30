-- Proveedor que vendió cada producto.
-- Ejecutar en Supabase: SQL Editor → New query → pegar → Run (después de proveedores.sql).

-- Puede quedar vacío en productos que ya existían; la app lo pide en productos nuevos o editados.
-- restrict: no se puede eliminar un proveedor que tiene productos registrados.
alter table public.productos
  add column if not exists proveedor_id bigint
  references public.proveedores (id) on delete restrict;

create index if not exists productos_proveedor_id_idx on public.productos (proveedor_id);

notify pgrst, 'reload schema';
