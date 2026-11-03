-- Metas de noviembre y del año 2026: promedio de ventas pagadas ene–oct + 10%.
insert into public.metas (tipo, periodo, vendedor_id, meta)
select v.tipo, v.periodo, u.id, v.meta
from (values
  ('Andrés Rojas', 290, 3430),
  ('Laura Gómez', 215, 2560),
  ('Juan Pablo Castro', 190, 2230),
  ('Felipe Ramírez', 150, 1770),
  ('Natalia Ortiz', 145, 1730),
  ('Camila Ríos', 135, 1590),
  ('Valentina Herrera', 130, 1540),
  ('Santiago Vargas', 90, 1070),
  ('Daniela Moreno', 90, 1060)
) as m(nombre, mensual, anual)
join public.usuarios u on u.nombre = m.nombre and u.rol = 'vendedor'
cross join lateral (values ('mensual', '2026-11', m.mensual), ('anual', '2026', m.anual)) as v(tipo, periodo, meta)
on conflict (tipo, periodo, vendedor_id) do update set meta = excluded.meta;

-- Meta general del CDA para noviembre.
insert into public.metas (tipo, periodo, vendedor_id, meta)
values ('mensual', '2026-11', null, 1435)
on conflict (tipo, periodo, vendedor_id) do update set meta = excluded.meta;
