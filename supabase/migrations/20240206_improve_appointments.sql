-- Mejorar tabla de citas/reservas
-- Agregar columnas necesarias si no existen

-- Agregar referencia a servicio
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE SET NULL;

-- Agregar columnas de tiempo más flexibles
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS client_phone TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- Hacer opcionales las columnas que antes eran requeridas
ALTER TABLE public.appointments 
ALTER COLUMN client_email DROP NOT NULL;

-- Si service_name y service_price existen, hacerlas opcionales
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'service_name') THEN
        ALTER TABLE public.appointments ALTER COLUMN service_name DROP NOT NULL;
        ALTER TABLE public.appointments ALTER COLUMN service_name SET DEFAULT '';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'service_price') THEN
        ALTER TABLE public.appointments ALTER COLUMN service_price DROP NOT NULL;
        ALTER TABLE public.appointments ALTER COLUMN service_price SET DEFAULT 0;
    END IF;
END $$;



