-- Agregar campo auto_confirm a servicios para confirmación automática de turnos
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS auto_confirm BOOLEAN DEFAULT false NOT NULL;

-- Comentario para documentar
COMMENT ON COLUMN public.services.auto_confirm IS 'Si es true, los turnos de este servicio se confirman automáticamente al crearse (requiere plan Premium)';

