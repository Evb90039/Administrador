-- Precio final de cada venta (lo que realmente se cobró).
-- Ejecutar en Supabase: SQL Editor → New query → pegar → Run (después de ventas.sql).

-- Puede quedar vacío en ventas que ya existían.
alter table public.ventas
  add column if not exists precio_final numeric(12, 2) check (precio_final >= 0);

-- Se reemplaza la función para que también guarde el precio final.
-- (Se borra la versión anterior porque cambia la lista de parámetros.)
drop function if exists public.registrar_venta(bigint, bigint, date);

create or replace function public.registrar_venta(
  p_producto_id  bigint,
  p_usuario_id   bigint,
  p_fecha_venta  date default current_date,
  p_precio_final numeric default null
)
returns public.ventas
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_venta public.ventas;
begin
  insert into public.ventas (producto_id, usuario_id, fecha_venta, precio_final)
  values (p_producto_id, p_usuario_id, p_fecha_venta, p_precio_final)
  returning * into v_venta;

  update public.productos set disponibilidad = 'Vendido' where id = p_producto_id;

  return v_venta;
end;
$$;

revoke execute on function public.registrar_venta(bigint, bigint, date, numeric) from public, anon;
grant execute on function public.registrar_venta(bigint, bigint, date, numeric) to authenticated;

notify pgrst, 'reload schema';
