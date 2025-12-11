-- Mejorar tabla de horarios de trabajo
-- Si no existe, crearla

CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    day INTEGER NOT NULL CHECK (day >= 0 AND day <= 6), -- 0=Lunes, 6=Domingo
    enabled BOOLEAN DEFAULT false NOT NULL,
    start_time TIME DEFAULT '09:00' NOT NULL,
    end_time TIME DEFAULT '18:00' NOT NULL,
    slot_duration INTEGER DEFAULT 30 NOT NULL, -- duración de cada turno en minutos
    UNIQUE(store_id, day)
);

-- Índice
CREATE INDEX IF NOT EXISTS idx_schedules_store_id ON public.schedules(store_id);

-- Habilitar RLS
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede ver horarios (para mostrar disponibilidad)
CREATE POLICY "Anyone can view schedules"
    ON public.schedules
    FOR SELECT
    USING (true);

-- Dueños pueden gestionar sus horarios
CREATE POLICY "Store owners can manage their schedules"
    ON public.schedules
    FOR ALL
    USING (
        store_id IN (
            SELECT id FROM public.stores 
            WHERE user_id = auth.uid()
        )
    );



