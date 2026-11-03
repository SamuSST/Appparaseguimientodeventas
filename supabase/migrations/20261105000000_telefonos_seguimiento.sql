-- Teléfonos para que el vendedor llame a sus clientes desde Seguimiento.

-- 1. Celular del cliente en cada atención.
alter table public.atenciones add column if not exists cliente_telefono text;

-- Las atenciones ya cargadas no traían teléfono: se usa el mismo número que trae el Excel,
-- que se calcula a partir de la placa (el mismo vehículo conserva el número entre años).
update public.atenciones
set cliente_telefono =
  (array['300','301','302','304','305','310','311','312','313','314','315','316','317','318','319','320','321','322','323','350','351'])
    [(('x' || substr(md5(placa), 1, 2))::bit(8)::int % 21) + 1]
  || lpad(((('x' || lpad(substr(md5(placa), 3, 8), 16, '0'))::bit(64)::bigint) % 10000000)::text, 7, '0')
where cliente_telefono is null;

-- 2. Celular de los vendedores de la carga de Excel (solo si aún no tienen uno). El admin lo cambia en "Cuentas".
update public.usuarios u
set telefono = t.telefono
from (values
  ('Laura Gómez', '3104567821'),
  ('Andrés Rojas', '3157894512'),
  ('Valentina Herrera', '3201458796'),
  ('Juan Pablo Castro', '3119873456'),
  ('Daniela Moreno', '3006541238'),
  ('Santiago Vargas', '3183216549'),
  ('Camila Ríos', '3224785123'),
  ('Felipe Ramírez', '3012589634'),
  ('Natalia Ortiz', '3165478932')
) as t(nombre, telefono)
where u.nombre = t.nombre and u.rol = 'vendedor' and (u.telefono is null or u.telefono = '');

-- 3. Seguimiento con los teléfonos del cliente y del vendedor (cambia lo que devuelven, por eso se recrean).
drop function if exists public.reinspecciones_pendientes(integer);
create function public.reinspecciones_pendientes(p_dias integer default 60)
returns table (
  atencion_id bigint, vendedor_id uuid, vendedor text, vendedor_telefono text, fecha date, placa text,
  cliente_nombre text, cliente_telefono text, marca text, vehiculo text, tipo_vehiculo text,
  fecha_limite date, dias_restantes integer, estado text
)
language sql
stable
security invoker
set search_path to ''
as $$
  select a.id, a.vendedor_id, u.nombre, u.telefono, a.fecha, a.placa, a.cliente_nombre, a.cliente_telefono,
    a.marca, a.vehiculo, a.tipo_vehiculo, a.fecha_limite_reinspeccion,
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

drop function if exists public.renovaciones_proximas(integer, integer);
create function public.renovaciones_proximas(p_dias_antes integer default 45, p_dias_despues integer default 30)
returns table (
  atencion_id bigint, vendedor_id uuid, vendedor text, vendedor_telefono text, ultima_rtm date, vence date,
  dias_para_vencer integer, placa text, cliente_nombre text, cliente_telefono text, marca text, vehiculo text,
  tipo_vehiculo text, tipo_servicio text
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
  select l.id, l.vendedor_id, u.nombre, u.telefono, l.fecha, (l.fecha + interval '1 year')::date,
    ((l.fecha + interval '1 year')::date - current_date)::integer,
    l.placa, l.cliente_nombre, l.cliente_telefono, l.marca, l.vehiculo, l.tipo_vehiculo, l.tipo_servicio
  from ultima l
  left join public.usuarios u on u.id = l.vendedor_id
  where (l.fecha + interval '1 year')::date between current_date - p_dias_despues and current_date + p_dias_antes
  order by 6;
$$;

-- Solo usuarios con sesión (las funciones nuevas se pueden ejecutar por PUBLIC si no se quita).
revoke all on function public.reinspecciones_pendientes(integer) from public, anon;
revoke all on function public.renovaciones_proximas(integer, integer) from public, anon;
grant execute on function public.reinspecciones_pendientes(integer) to authenticated;
grant execute on function public.renovaciones_proximas(integer, integer) to authenticated;
