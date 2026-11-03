-- ===== Catálogo público =====
-- El catálogo (/catalogo) es accesible sin login. Este script expone solo lo
-- necesario para lectores anónimos, sin abrir las tablas completas:
--   - Vista `catalogo_productos`: solo productos "Disponible" y solo columnas
--     seguras (excluye tarjeta, proveedor, reembolso_via, resenado, fecha_compra).
--   - SELECT anónimo en `categorias` (solo id/nombre, sin datos sensibles).
--   - SELECT anónimo en `producto_imagenes` (los paths ya son públicos porque
--     el bucket "productos" es público).
--
-- Al ser una vista con security_invoker = false, se ejecuta con los permisos
-- del propietario (postgres): RLS de `productos` no aplica sobre la vista y
-- nosotros controlamos qué filas/columnas salen.

create or replace view public.catalogo_productos
with (security_invoker = false) as
select
  id,
  nombre,
  enlace,
  tienda,
  categoria_id,
  precio_compra,
  dinero_reembolsado,
  precio_venta,
  disponibilidad,
  imagen_principal_id
from public.productos
where disponibilidad = 'Disponible';

grant select on public.catalogo_productos to anon;
grant select on public.catalogo_productos to authenticated;

-- Categorías: el catálogo las usa para los chips de filtro (solo id y nombre).
drop policy if exists "categorias_select_publico" on public.categorias;
create policy "categorias_select_publico" on public.categorias
  for select to anon using (true);

-- Imágenes: el bucket ya es público, solo falta leer la tabla de relación.
drop policy if exists "producto_imagenes_select_publico" on public.producto_imagenes;
create policy "producto_imagenes_select_publico" on public.producto_imagenes
  for select to anon using (true);

notify pgrst, 'reload schema';
