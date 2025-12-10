-- Agregar campos de disponibilidad a servicios
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS available_days INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6],
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Comentarios para documentar
COMMENT ON COLUMN public.services.available_days IS 'Días de la semana disponibles (0=Lunes, 6=Domingo)';
COMMENT ON COLUMN public.services.start_date IS 'Fecha de inicio de disponibilidad (null = sin límite)';
COMMENT ON COLUMN public.services.end_date IS 'Fecha de fin de disponibilidad (null = sin límite)';

