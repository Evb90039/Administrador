-- ===== Lista blanca de administradores =====
-- Las políticas RLS actuales permiten que CUALQUIER usuario autenticado lea
-- y modifique todo. Si creas más usuarios en Supabase (p. ej. para clientes),
-- también verían las ventas, los costos, los proveedores, etc.
--
-- Este script crea una tabla `app_admins` con los emails autorizados y
-- reemplaza las políticas por versiones que exigen estar en esa lista.
--
-- Antes de ejecutar: añade abajo tu email de login.

create table if not exists public.app_admins (
  email text primary key
);

alter table public.app_admins enable row level security;

-- Nadie puede leer la lista desde el cliente (solo el servicio/postgres).
drop policy if exists "app_admins_no_access" on public.app_admins;
create policy "app_admins_no_access" on public.app_admins
  for all to authenticated using (false) with check (false);

-- Función reutilizable para las policies: devuelve TRUE si el usuario actual
-- está en la lista blanca.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_admins
    where email = (auth.jwt() ->> 'email')
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- ⚠️ CAMBIA ESTE EMAIL POR EL QUE USAS PARA ENTRAR AL ADMIN:
insert into public.app_admins (email) values ('vizcarrabeltranenrique@gmail.com')
on conflict do nothing;

-- ===== Reemplazar policies: solo admins =====
-- productos
drop policy if exists "productos_select_autenticados" on public.productos;
drop policy if exists "productos_insert_autenticados" on public.productos;
drop policy if exists "productos_update_autenticados" on public.productos;
drop policy if exists "productos_delete_autenticados" on public.productos;
create policy "productos_admin_all" on public.productos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- categorias (dejamos SELECT público para el catálogo, resto solo admin)
drop policy if exists "categorias_select_autenticados" on public.categorias;
create policy "categorias_admin_write" on public.categorias
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- usuarios (vendedores)
drop policy if exists "usuarios_select_autenticados" on public.usuarios;
drop policy if exists "usuarios_insert_autenticados" on public.usuarios;
drop policy if exists "usuarios_update_autenticados" on public.usuarios;
drop policy if exists "usuarios_delete_autenticados" on public.usuarios;
create policy "usuarios_admin_all" on public.usuarios
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- proveedores
drop policy if exists "proveedores_select_autenticados" on public.proveedores;
drop policy if exists "proveedores_insert_autenticados" on public.proveedores;
drop policy if exists "proveedores_update_autenticados" on public.proveedores;
drop policy if exists "proveedores_delete_autenticados" on public.proveedores;
create policy "proveedores_admin_all" on public.proveedores
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ventas
drop policy if exists "ventas_select_autenticados" on public.ventas;
drop policy if exists "ventas_insert_autenticados" on public.ventas;
drop policy if exists "ventas_update_autenticados" on public.ventas;
drop policy if exists "ventas_delete_autenticados" on public.ventas;
create policy "ventas_admin_all" on public.ventas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- producto_imagenes (SELECT público para catálogo + resto admin)
drop policy if exists "producto_imagenes_select" on public.producto_imagenes;
drop policy if exists "producto_imagenes_insert" on public.producto_imagenes;
drop policy if exists "producto_imagenes_delete" on public.producto_imagenes;
create policy "producto_imagenes_admin_all" on public.producto_imagenes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Storage: subir/eliminar archivos del bucket solo admins.
drop policy if exists "productos_storage_select" on storage.objects;
drop policy if exists "productos_storage_insert" on storage.objects;
drop policy if exists "productos_storage_delete" on storage.objects;
create policy "productos_storage_admin_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'productos' and public.is_admin());
create policy "productos_storage_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'productos' and public.is_admin());
create policy "productos_storage_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'productos' and public.is_admin());
-- SELECT en objects no es necesario: el bucket es público.

notify pgrst, 'reload schema';
