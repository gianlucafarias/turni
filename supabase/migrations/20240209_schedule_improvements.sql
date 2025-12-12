-- Agregar campos para horario partido en schedules
ALTER TABLE public.schedules 
ADD COLUMN IF NOT EXISTS is_continuous BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS morning_start TIME DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS morning_end TIME DEFAULT '13:00',
ADD COLUMN IF NOT EXISTS afternoon_start TIME DEFAULT '16:00',
ADD COLUMN IF NOT EXISTS afternoon_end TIME DEFAULT '20:00';

-- Crear tabla de días libres/feriados
CREATE TABLE IF NOT EXISTS public.days_off (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    reason TEXT,
    UNIQUE(store_id, date)
);

-- Habilitar RLS
ALTER TABLE public.days_off ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Anyone can view days off" ON public.days_off
    FOR SELECT USING (true);

CREATE POLICY "Store owners can manage days off" ON public.days_off
    FOR ALL USING (
        store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
    );

-- Comentarios
COMMENT ON COLUMN public.schedules.is_continuous IS 'Si el horario es de corrido (true) o partido mañana/tarde (false)';
COMMENT ON COLUMN public.schedules.morning_start IS 'Hora inicio turno mañana';
COMMENT ON COLUMN public.schedules.morning_end IS 'Hora fin turno mañana';
COMMENT ON COLUMN public.schedules.afternoon_start IS 'Hora inicio turno tarde';
COMMENT ON COLUMN public.schedules.afternoon_end IS 'Hora fin turno tarde';
COMMENT ON TABLE public.days_off IS 'Días libres, feriados o vacaciones de cada tienda';





