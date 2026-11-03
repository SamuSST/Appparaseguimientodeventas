-- Panel de vendedor: metas por vendedor, ranking y fotos de visitas.

-- 1. Una sola meta por tipo, periodo y vendedor (vendedor_id null = meta general del CDA),
--    para que el administrador pueda guardarlas con upsert.
alter table public.metas
  add constraint metas_tipo_periodo_vendedor_key
  unique nulls not distinct (tipo, periodo, vendedor_id);

-- 2. Ranking mensual: cada vendedor ve el nombre y el cumplimiento de los demás,
--    sin poder leer las atenciones de otros (RLS sigue igual).
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
    on a.vendedor_id = u.id and to_char(a.fecha, 'YYYY-MM') = p_periodo
  where u.rol = 'vendedor'
    and u.activo
    and exists (select 1 from public.usuarios yo where yo.id = auth.uid() and yo.activo)
  group by u.id, u.nombre, m.meta;
$$;

revoke all on function public.ranking_vendedores(text) from public, anon;
grant execute on function public.ranking_vendedores(text) to authenticated;

-- 3. Fotos de las visitas: bucket privado, cada vendedor sube en su carpeta (<uid>/...).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('visitas', 'visitas', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "visitas: vendedor sube sus fotos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'visitas' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "visitas: ver fotos propias o admin"
  on storage.objects for select to authenticated
  using (bucket_id = 'visitas' and ((storage.foldername(name))[1] = auth.uid()::text or public.es_admin()));
