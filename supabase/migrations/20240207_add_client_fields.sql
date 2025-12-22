-- Agregar campos de cliente a appointments
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS client_email TEXT,
ADD COLUMN IF NOT EXISTS client_location TEXT;

-- Agregar opción de mostrar precios a stores
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS show_prices BOOLEAN DEFAULT true;

-- Comentarios para documentar
COMMENT ON COLUMN public.appointments.client_email IS 'Correo electrónico del cliente';
COMMENT ON COLUMN public.appointments.client_location IS 'Localidad/ciudad del cliente';
COMMENT ON COLUMN public.stores.show_prices IS 'Si mostrar precios en la página pública';













