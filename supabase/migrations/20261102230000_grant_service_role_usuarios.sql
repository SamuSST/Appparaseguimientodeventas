-- Las funciones crear-usuario-admin y cambiar-password-temporal usan service_role
-- para leer el rol del administrador y crear o actualizar perfiles.
grant select, insert, update on table public.usuarios to service_role;
