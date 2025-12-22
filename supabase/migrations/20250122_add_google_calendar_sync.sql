-- Agregar soporte para sincronización con Google Calendar

-- Tabla para almacenar tokens de Google Calendar
CREATE TABLE IF NOT EXISTS public.google_calendar_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_store_id ON public.google_calendar_tokens(store_id);

-- Agregar columna a stores para indicar si está conectado
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS google_calendar_connected BOOLEAN DEFAULT false;

-- Agregar columna a appointments para guardar el ID del evento en Google Calendar
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;

-- Agregar columna para marcar turnos importados de Google Calendar (para evitar notificaciones)
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS imported_from_google_calendar BOOLEAN DEFAULT false;

-- Habilitar RLS
ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Política: Solo el dueño de la tienda puede ver sus tokens
CREATE POLICY "Store owners can view their google calendar tokens"
    ON public.google_calendar_tokens
    FOR SELECT
    USING (
        store_id IN (
            SELECT id FROM public.stores 
            WHERE user_id = auth.uid()
        )
    );

-- Política: Solo el dueño de la tienda puede insertar tokens
CREATE POLICY "Store owners can insert their google calendar tokens"
    ON public.google_calendar_tokens
    FOR INSERT
    WITH CHECK (
        store_id IN (
            SELECT id FROM public.stores 
            WHERE user_id = auth.uid()
        )
    );

-- Política: Solo el dueño de la tienda puede actualizar sus tokens
CREATE POLICY "Store owners can update their google calendar tokens"
    ON public.google_calendar_tokens
    FOR UPDATE
    USING (
        store_id IN (
            SELECT id FROM public.stores 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        store_id IN (
            SELECT id FROM public.stores 
            WHERE user_id = auth.uid()
        )
    );

-- Política: Solo el dueño de la tienda puede eliminar sus tokens
CREATE POLICY "Store owners can delete their google calendar tokens"
    ON public.google_calendar_tokens
    FOR DELETE
    USING (
        store_id IN (
            SELECT id FROM public.stores 
            WHERE user_id = auth.uid()
        )
    );

