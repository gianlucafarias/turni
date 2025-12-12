-- Agregar token público para acceso a turnos sin autenticación
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS public_token TEXT;

-- Agregar campo para rastrear quién modificó el turno
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS modified_by_client BOOLEAN DEFAULT FALSE;

-- Crear índice para búsquedas rápidas por token
CREATE INDEX IF NOT EXISTS idx_appointments_public_token ON public.appointments(public_token);

-- Agregar constraint UNIQUE después de crear la columna
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'appointments_public_token_key'
  ) THEN
    ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_public_token_key UNIQUE (public_token);
  END IF;
END $$;

-- Función para generar token único
-- Usamos base64 y luego reemplazamos caracteres para hacerlo URL-safe
CREATE OR REPLACE FUNCTION generate_public_token()
RETURNS TEXT AS $$
DECLARE
  new_token TEXT;
  base64_token TEXT;
BEGIN
  LOOP
    -- Generar token único usando base64 (PostgreSQL lo soporta)
    base64_token := encode(gen_random_bytes(32), 'base64');
    -- Convertir a base64url: reemplazar + con -, / con _, y quitar =
    new_token := replace(replace(replace(base64_token, '+', '-'), '/', '_'), '=', '');
    -- Verificar que sea único
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.appointments WHERE public_token = new_token);
  END LOOP;
  RETURN new_token;
END;
$$ LANGUAGE plpgsql;

-- Generar tokens para turnos existentes que no tengan uno
DO $$
DECLARE
  appointment_record RECORD;
BEGIN
  FOR appointment_record IN SELECT id FROM public.appointments WHERE public_token IS NULL
  LOOP
    UPDATE public.appointments
    SET public_token = generate_public_token()
    WHERE id = appointment_record.id;
  END LOOP;
END $$;

-- Trigger para generar token automáticamente en nuevos turnos
CREATE OR REPLACE FUNCTION set_public_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.public_token IS NULL THEN
    NEW.public_token := generate_public_token();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger si existe antes de crearlo
DROP TRIGGER IF EXISTS set_appointment_public_token ON public.appointments;

CREATE TRIGGER set_appointment_public_token
  BEFORE INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION set_public_token();

-- Comentarios
COMMENT ON COLUMN public.appointments.public_token IS 'Token único para acceso público al turno sin autenticación';
COMMENT ON COLUMN public.appointments.modified_by_client IS 'Indica si el turno fue modificado o cancelado por el cliente';

