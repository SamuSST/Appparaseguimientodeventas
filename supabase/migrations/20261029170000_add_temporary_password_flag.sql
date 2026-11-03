alter table public.usuarios
  add column if not exists debe_cambiar_password boolean not null default false;
