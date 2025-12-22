-- Agregar campo para guardar cuándo fue modificado por el cliente
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS client_modified_at TIMESTAMP WITH TIME ZONE;

-- Comentario
COMMENT ON COLUMN public.appointments.client_modified_at IS 'Fecha y hora en que el turno fue modificado por el cliente';









