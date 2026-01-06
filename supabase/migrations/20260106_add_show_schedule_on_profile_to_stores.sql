-- Agrega un flag para permitir que la tienda decida si muestra o no
-- sus horarios públicos en la página de perfil.

alter table public.stores
  add column if not exists show_schedule_on_profile boolean not null default true;

