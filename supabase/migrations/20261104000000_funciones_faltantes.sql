-- Recuperar contraseña, registro de atenciones por el vendedor, seguimiento de reinspecciones y renovaciones.

-- 1. Límite para pedir una contraseña nueva por "¿Olvidaste tu contraseña?".
alter table public.usuarios add column if not exists ultimo_reinicio_password timestamptz;

-- 2. El vendedor registra sus propias atenciones desde la app (sin carga de Excel)
--    y puede borrar las que registró hoy por error.
drop policy if exists "atenciones: vendedor registra las suyas" on public.atenciones;
create policy "atenciones: vendedor registra las suyas"
  on public.atenciones for insert to authenticated
  with check (
    vendedor_id = auth.uid()
    and carga_id is null
    and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.activo)
  );

drop policy if exists "atenciones: vendedor borra lo que registró hoy" on public.atenciones;
create policy "atenciones: vendedor borra lo que registró hoy"
  on public.atenciones for delete to authenticated
  using (vendedor_id = auth.uid() and carga_id is null and fecha = current_date);

-- 3. Precio fijo y fecha límite de reinspección automáticos. Si no es el admin, el precio
--    siempre se calcula aquí (el vendedor no ve ni define valores).
create or replace function public.completar_atencion()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.ingreso is null or not public.es_admin() then
    new.ingreso := case
      when new.tipo_revision = 'Reinspección' then 0
      when new.tipo_revision = 'Preventiva' then
        case new.tipo_vehiculo when 'moto' then 30000 when 'pesado' then 80000 else 50000 end
      else
        case
          when new.tipo_vehiculo = 'moto' then 232600
          when new.tipo_vehiculo = 'pesado' then 519500
          when new.electrico then 258400
          when new.tipo_servicio = 'publico' then 342500
          else 343100
        end
    end;
  end if;

  if new.tipo_revision = 'Reinspección' then
    new.pagado := true;
  end if;
  if new.tipo_revision = 'RTM' and new.resultado = 'Rechazada' then
    new.fecha_limite_reinspeccion := coalesce(new.fecha_limite_reinspeccion, new.fecha + 15);
  elsif new.tipo_revision <> 'RTM' or new.resultado is distinct from 'Rechazada' then
    new.fecha_limite_reinspeccion := null;
  end if;
  if new.tipo_revision = 'Preventiva' then
    new.resultado := null;
  end if;
  return new;
end;
$$;

drop trigger if exists completar_atencion on public.atenciones;
create trigger completar_atencion
  before insert on public.atenciones
  for each row execute function public.completar_atencion();

-- 4. Reinspecciones pendientes calculadas con la fecha de hoy (no con lo que decía el Excel).
--    security invoker: cada vendedor ve solo las suyas y el admin ve todas.
create or replace function public.reinspecciones_pendientes(p_dias integer default 60)
returns table (
  atencion_id bigint, vendedor_id uuid, vendedor text, fecha date, placa text,
  cliente_nombre text, marca text, vehiculo text, tipo_vehiculo text,
  fecha_limite date, dias_restantes integer, estado text
)
language sql
stable
security invoker
set search_path to ''
as $$
  select a.id, a.vendedor_id, u.nombre, a.fecha, a.placa, a.cliente_nombre, a.marca, a.vehiculo, a.tipo_vehiculo,
    a.fecha_limite_reinspeccion,
    (a.fecha_limite_reinspeccion - current_date)::integer,
    case when a.fecha_limite_reinspeccion >= current_date then 'En plazo' else 'Vencida' end
  from public.atenciones a
  left join public.usuarios u on u.id = a.vendedor_id
  where a.tipo_revision = 'RTM'
    and a.resultado = 'Rechazada'
    and a.fecha >= current_date - p_dias
    and not exists (
      select 1 from public.atenciones r
      where r.placa = a.placa and r.tipo_revision = 'Reinspección'
        and r.fecha > a.fecha and r.fecha <= a.fecha_limite_reinspeccion
    )
  order by a.fecha_limite_reinspeccion;
$$;

-- 5. Vehículos que deben renovar su RTM (se hace cada año): última RTM aprobada hace casi un año
--    y sin otra RTM después.
create or replace function public.renovaciones_proximas(p_dias_antes integer default 45, p_dias_despues integer default 30)
returns table (
  atencion_id bigint, vendedor_id uuid, vendedor text, ultima_rtm date, vence date, dias_para_vencer integer,
  placa text, cliente_nombre text, marca text, vehiculo text, tipo_vehiculo text, tipo_servicio text
)
language sql
stable
security invoker
set search_path to ''
as $$
  with ultima as (
    select distinct on (a.placa) a.*
    from public.atenciones a
    where a.tipo_revision in ('RTM', 'Reinspección') and a.resultado = 'Aprobada'
    order by a.placa, a.fecha desc
  )
  select l.id, l.vendedor_id, u.nombre, l.fecha, (l.fecha + interval '1 year')::date,
    ((l.fecha + interval '1 year')::date - current_date)::integer,
    l.placa, l.cliente_nombre, l.marca, l.vehiculo, l.tipo_vehiculo, l.tipo_servicio
  from ultima l
  left join public.usuarios u on u.id = l.vendedor_id
  where (l.fecha + interval '1 year')::date between current_date - p_dias_despues and current_date + p_dias_antes
  order by 5;
$$;

grant execute on function public.reinspecciones_pendientes(integer) to authenticated;
grant execute on function public.renovaciones_proximas(integer, integer) to authenticated;
revoke all on function public.reinspecciones_pendientes(integer) from anon;
revoke all on function public.renovaciones_proximas(integer, integer) from anon;
