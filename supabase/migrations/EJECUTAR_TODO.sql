-- =============================================================================
-- SCRIPT COMPLETO - EJECUTAR EN SUPABASE SQL EDITOR
-- Este script agrega TODAS las columnas necesarias para el MVP
-- =============================================================================

-- =====================
-- 1. TABLA STORES - Campos básicos y perfil
-- =====================

-- Mostrar precios (para turnos)
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS show_prices BOOLEAN DEFAULT true;

-- Múltiples turnos simultáneos
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS allow_multiple_appointments BOOLEAN DEFAULT false;

ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS max_appointments_per_slot INTEGER DEFAULT 1;

-- Slug personalizado para URL amigable
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Dirección completa
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';

-- Bio corta / eslogan
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS short_bio TEXT DEFAULT '';

-- Galería de imágenes
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS gallery_images TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Contacto adicional
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';

ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';

-- Redes sociales
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS instagram_url TEXT DEFAULT '';

ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS facebook_url TEXT DEFAULT '';

ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS tiktok_url TEXT DEFAULT '';

ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS website_url TEXT DEFAULT '';

-- Horario en texto
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS business_hours_text TEXT DEFAULT '';

-- Crear índice para slug
CREATE INDEX IF NOT EXISTS idx_stores_slug ON public.stores(slug);

-- =====================
-- 2. TABLA SCHEDULES - Horarios mejorados
-- =====================

-- Horario continuo o partido
ALTER TABLE public.schedules 
ADD COLUMN IF NOT EXISTS is_continuous BOOLEAN DEFAULT true;

ALTER TABLE public.schedules 
ADD COLUMN IF NOT EXISTS morning_start TIME DEFAULT '09:00';

ALTER TABLE public.schedules 
ADD COLUMN IF NOT EXISTS morning_end TIME DEFAULT '13:00';

ALTER TABLE public.schedules 
ADD COLUMN IF NOT EXISTS afternoon_start TIME DEFAULT '16:00';

ALTER TABLE public.schedules 
ADD COLUMN IF NOT EXISTS afternoon_end TIME DEFAULT '20:00';

-- =====================
-- 3. TABLA DAYS_OFF - Días libres
-- =====================

CREATE TABLE IF NOT EXISTS public.days_off (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    reason TEXT,
    UNIQUE(store_id, date)
);

ALTER TABLE public.days_off ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view days off" ON public.days_off;
CREATE POLICY "Anyone can view days off" ON public.days_off
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Store owners can manage days off" ON public.days_off;
CREATE POLICY "Store owners can manage days off" ON public.days_off
    FOR ALL USING (
        store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
    );

-- =====================
-- 4. TABLA SERVICES - Disponibilidad
-- =====================

ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS available_days INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6];

ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS start_date DATE;

ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS end_date DATE;

-- =====================
-- 5. TABLA APPOINTMENTS - Campos de cliente
-- =====================

ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS client_email TEXT;

ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS client_phone TEXT;

ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS client_location TEXT;

ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Hacer campos opcionales
ALTER TABLE public.appointments 
ALTER COLUMN service_name DROP NOT NULL;

ALTER TABLE public.appointments 
ALTER COLUMN service_price DROP NOT NULL;

ALTER TABLE public.appointments 
ALTER COLUMN client_email DROP NOT NULL;

-- =====================
-- 6. RLS APPOINTMENTS - Permitir lectura pública
-- =====================

DROP POLICY IF EXISTS "Store owners can view their appointments" ON public.appointments;
DROP POLICY IF EXISTS "Anyone can view appointments" ON public.appointments;

CREATE POLICY "Anyone can view appointments" ON public.appointments
    FOR SELECT USING (true);

-- =====================
-- LISTO!
-- =====================
SELECT 'Todas las migraciones ejecutadas correctamente!' as resultado;





