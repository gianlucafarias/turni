-- Tabla de servicios para tiendas de turnos
-- Cada servicio tiene nombre, descripción, duración y precio

CREATE TABLE IF NOT EXISTS public.services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    duration INTEGER NOT NULL DEFAULT 30, -- duración en minutos
    price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    active BOOLEAN DEFAULT true NOT NULL
);

-- Índice para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_services_store_id ON public.services(store_id);

-- Habilitar RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
-- Cualquiera puede ver servicios activos (para la página pública)
CREATE POLICY "Anyone can view active services"
    ON public.services
    FOR SELECT
    USING (active = true);

-- Dueños pueden ver todos sus servicios
CREATE POLICY "Store owners can view all their services"
    ON public.services
    FOR SELECT
    USING (
        store_id IN (
            SELECT id FROM public.stores 
            WHERE user_id = auth.uid()
        )
    );

-- Dueños pueden crear servicios
CREATE POLICY "Store owners can create services"
    ON public.services
    FOR INSERT
    WITH CHECK (
        store_id IN (
            SELECT id FROM public.stores 
            WHERE user_id = auth.uid()
        )
    );

-- Dueños pueden actualizar sus servicios
CREATE POLICY "Store owners can update their services"
    ON public.services
    FOR UPDATE
    USING (
        store_id IN (
            SELECT id FROM public.stores 
            WHERE user_id = auth.uid()
        )
    );

-- Dueños pueden eliminar sus servicios
CREATE POLICY "Store owners can delete their services"
    ON public.services
    FOR DELETE
    USING (
        store_id IN (
            SELECT id FROM public.stores 
            WHERE user_id = auth.uid()
        )
    );



