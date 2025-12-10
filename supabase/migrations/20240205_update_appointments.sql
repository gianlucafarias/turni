-- Update appointments table to a more flexible schema

-- Add new columns
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS client_phone TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Make some columns optional
ALTER TABLE public.appointments 
ALTER COLUMN client_email DROP NOT NULL,
ALTER COLUMN service_name DROP NOT NULL,
ALTER COLUMN service_price DROP NOT NULL;

-- Set default values for service columns
ALTER TABLE public.appointments 
ALTER COLUMN service_name SET DEFAULT '',
ALTER COLUMN service_price SET DEFAULT 0;

-- Migrate existing data from date/time to start_time/end_time if needed
UPDATE public.appointments 
SET start_time = (date + time)::timestamp with time zone,
    end_time = (date + time + (duration * interval '1 minute'))::timestamp with time zone
WHERE start_time IS NULL AND date IS NOT NULL;

