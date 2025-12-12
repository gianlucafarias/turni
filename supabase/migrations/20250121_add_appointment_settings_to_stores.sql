-- Agregar configuraciones de citas a stores
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS auto_approve_appointments BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_notify_users BOOLEAN DEFAULT FALSE;

-- Comentarios
COMMENT ON COLUMN public.stores.auto_approve_appointments IS 'Si las citas se aprueban automáticamente al crearse';
COMMENT ON COLUMN public.stores.auto_notify_users IS 'Si se notifica automáticamente a los usuarios cuando se confirma o cancela un turno';

