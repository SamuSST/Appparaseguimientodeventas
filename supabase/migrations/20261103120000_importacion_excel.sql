-- Importación de atenciones desde Excel: tipo de revisión, resultado y reinspecciones.

-- 1. Columnas nuevas. tipo_servicio sigue siendo particular/publico y tipo_vehiculo carro/moto/pesado.
alter table public.atenciones
  add column if not exists tipo_revision text not null default 'RTM'
    check (tipo_revision in ('RTM', 'Preventiva', 'Reinspección')),
  add column if not exists electrico boolean not null default false,
  add column if not exists resultado text check (resultado in ('Aprobada', 'Rechazada')),
  add column if not exists fecha_limite_reinspeccion date,
  add column if not exists estado_reinspeccion text
    check (estado_reinspeccion in ('Realizada', 'En plazo', 'Vencida'));

-- Una placa puede tener RTM, preventiva y reinspección; no la misma revisión dos veces el mismo día.
-- También evita duplicados si se vuelve a subir el mismo Excel.
alter table public.atenciones drop constraint if exists atenciones_unica;
alter table public.atenciones
  add constraint atenciones_unica unique nulls not distinct (fecha, placa, tipo_revision);

create index if not exists atenciones_carga_idx on public.atenciones (carga_id);

-- 2. Las reinspecciones son gratis: no cuentan como venta en el cumplimiento ni en el ranking.
create or replace view public.cumplimiento_mensual with (security_invoker = true) as
  select m.vendedor_id, u.nombre, m.periodo, m.meta,
    count(a.id) filter (where a.pagado) as ventas_pagadas,
    round(100.0 * count(a.id) filter (where a.pagado) / m.meta, 1) as cumplimiento
  from public.metas m
  join public.usuarios u on u.id = m.vendedor_id
  left join public.atenciones a
    on a.vendedor_id = m.vendedor_id and to_char(a.fecha, 'YYYY-MM') = m.periodo and a.tipo_revision <> 'Reinspección'
  where m.tipo = 'mensual'
  group by m.vendedor_id, u.nombre, m.periodo, m.meta;

create or replace view public.cumplimiento_anual with (security_invoker = true) as
  select m.vendedor_id, u.nombre, m.periodo, m.meta,
    count(a.id) filter (where a.pagado) as ventas_pagadas,
    round(100.0 * count(a.id) filter (where a.pagado) / m.meta, 1) as cumplimiento
  from public.metas m
  join public.usuarios u on u.id = m.vendedor_id
  left join public.atenciones a
    on a.vendedor_id = m.vendedor_id and to_char(a.fecha, 'YYYY') = m.periodo and a.tipo_revision <> 'Reinspección'
  where m.tipo = 'anual'
  group by m.vendedor_id, u.nombre, m.periodo, m.meta;

create or replace view public.cumplimiento_cda_mensual with (security_invoker = true) as
  select m.periodo, m.meta,
    count(a.id) filter (where a.pagado) as ventas_pagadas,
    count(a.id) filter (where not a.pagado) as ventas_pendientes,
    coalesce(sum(a.ingreso) filter (where a.pagado), 0) as ingresos_pagados,
    round(100.0 * count(a.id) filter (where a.pagado) / m.meta, 1) as cumplimiento
  from public.metas m
  left join public.atenciones a
    on to_char(a.fecha, 'YYYY-MM') = m.periodo and a.tipo_revision <> 'Reinspección'
  where m.tipo = 'mensual' and m.vendedor_id is null and public.es_admin()
  group by m.periodo, m.meta;

create or replace view public.cumplimiento_cda_anual with (security_invoker = true) as
  select m.periodo, m.meta,
    count(a.id) filter (where a.pagado) as ventas_pagadas,
    count(a.id) filter (where not a.pagado) as ventas_pendientes,
    coalesce(sum(a.ingreso) filter (where a.pagado), 0) as ingresos_pagados,
    round(100.0 * count(a.id) filter (where a.pagado) / m.meta, 1) as cumplimiento
  from public.metas m
  left join public.atenciones a
    on to_char(a.fecha, 'YYYY') = m.periodo and a.tipo_revision <> 'Reinspección'
  where m.tipo = 'anual' and m.vendedor_id is null and public.es_admin()
  group by m.periodo, m.meta;

create or replace function public.ranking_vendedores(p_periodo text)
returns table (vendedor_id uuid, nombre text, meta integer, ventas_pagadas bigint)
language sql
stable
security definer
set search_path to ''
as $$
  select u.id, u.nombre, m.meta, count(a.id) filter (where a.pagado)
  from public.usuarios u
  left join public.metas m
    on m.vendedor_id = u.id and m.tipo = 'mensual' and m.periodo = p_periodo
  left join public.atenciones a
    on a.vendedor_id = u.id and to_char(a.fecha, 'YYYY-MM') = p_periodo and a.tipo_revision <> 'Reinspección'
  where u.rol = 'vendedor'
    and u.activo
    and exists (select 1 from public.usuarios yo where yo.id = auth.uid() and yo.activo)
  group by u.id, u.nombre, m.meta;
$$;

-- 3. Resumen del mes por vendedor para el inicio del administrador.
create or replace function public.resumen_vendedores(p_periodo text)
returns table (
  vendedor_id uuid, nombre text, activo boolean, meta integer,
  atenciones bigint, ventas_pagadas bigint, ingresos numeric,
  rtm bigint, preventivas bigint, rechazadas bigint, reinspecciones bigint
)
language sql
stable
security definer
set search_path to ''
as $$
  select u.id, u.nombre, u.activo, m.meta,
    count(a.id) filter (where a.tipo_revision <> 'Reinspección'),
    count(a.id) filter (where a.pagado and a.tipo_revision <> 'Reinspección'),
    coalesce(sum(a.ingreso) filter (where a.pagado), 0),
    count(a.id) filter (where a.tipo_revision = 'RTM'),
    count(a.id) filter (where a.tipo_revision = 'Preventiva'),
    count(a.id) filter (where a.tipo_revision = 'RTM' and a.resultado = 'Rechazada'),
    count(a.id) filter (where a.tipo_revision = 'Reinspección')
  from public.usuarios u
  left join public.metas m
    on m.vendedor_id = u.id and m.tipo = 'mensual' and m.periodo = p_periodo
  left join public.atenciones a
    on a.vendedor_id = u.id and to_char(a.fecha, 'YYYY-MM') = p_periodo
  where u.rol = 'vendedor' and public.es_admin()
  group by u.id, u.nombre, u.activo, m.meta;
$$;

revoke all on function public.resumen_vendedores(text) from public, anon;
grant execute on function public.resumen_vendedores(text) to authenticated;
