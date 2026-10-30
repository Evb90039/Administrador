-- Productos vendidos: quién vendió cada producto y cuándo.
-- Ejecutar en Supabase: SQL Editor → New query → pegar → Run.

create table if not exists public.ventas (
  id          bigint generated always as identity primary key,
  -- unique: un producto solo se puede vender una vez.
  -- cascade: si se elimina el producto, se elimina su venta.
  producto_id bigint not null unique references public.productos (id) on delete cascade,
  -- restrict: no se puede eliminar un usuario que tiene ventas registradas.
  usuario_id  bigint not null references public.usuarios (id) on delete restrict,
  fecha_venta date not null default current_date,
  created_at  timestamptz not null default now()
);

create index if not exists ventas_usuario_id_idx on public.ventas (usuario_id);

alter table public.ventas enable row level security;

grant select, insert, update, delete on public.ventas to authenticated;

create policy "ventas_select_autenticados" on public.ventas
  for select to authenticated using (true);

create policy "ventas_insert_autenticados" on public.ventas
  for insert to authenticated with check (true);

create policy "ventas_update_autenticados" on public.ventas
  for update to authenticated using (true) with check (true);

create policy "ventas_delete_autenticados" on public.ventas
  for delete to authenticated using (true);

-- Registra la venta y marca el producto como "Vendido" en una sola transacción:
-- si cualquiera de los dos pasos falla, no se guarda nada.
-- security invoker: se ejecuta con los permisos (y RLS) del usuario que la llama.
create or replace function public.registrar_venta(
  p_producto_id bigint,
  p_usuario_id  bigint,
  p_fecha_venta date default current_date
)
returns public.ventas
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_venta public.ventas;
begin
  insert into public.ventas (producto_id, usuario_id, fecha_venta)
  values (p_producto_id, p_usuario_id, p_fecha_venta)
  returning * into v_venta;

  update public.productos set disponibilidad = 'Vendido' where id = p_producto_id;

  return v_venta;
end;
$$;

revoke execute on function public.registrar_venta(bigint, bigint, date) from public, anon;
grant execute on function public.registrar_venta(bigint, bigint, date) to authenticated;

notify pgrst, 'reload schema';
