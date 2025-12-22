-- Agregar opción de múltiples turnos simultáneos en stores
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS allow_multiple_appointments BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS max_appointments_per_slot INTEGER DEFAULT 1;

-- Comentarios
COMMENT ON COLUMN public.stores.allow_multiple_appointments IS 'Si permite múltiples turnos en el mismo horario';
COMMENT ON COLUMN public.stores.max_appointments_per_slot IS 'Cantidad máxima de turnos simultáneos permitidos';













