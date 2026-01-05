-- =============================================================================
-- Crear tabla de sucursales (branches) para funcionalidad PRO
-- =============================================================================

-- Crear tabla de sucursales
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Información de la sucursal
    name TEXT NOT NULL,
    city TEXT DEFAULT '',
    province TEXT DEFAULT '',
    address TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    
    -- Orden de visualización
    display_order INTEGER DEFAULT 0,
    
    -- Si está activa
    is_active BOOLEAN DEFAULT true
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_branches_store_id ON public.branches(store_id);
CREATE INDEX IF NOT EXISTS idx_branches_active ON public.branches(store_id, is_active) WHERE is_active = true;

-- Habilitar RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
-- Usuarios pueden ver sucursales de sus tiendas
CREATE POLICY "Users can view branches of their stores"
    ON public.branches
    FOR SELECT
    USING (
        store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
    );

-- Usuarios pueden insertar sucursales en sus tiendas
CREATE POLICY "Users can insert branches in their stores"
    ON public.branches
    FOR INSERT
    WITH CHECK (
        store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
    );

-- Usuarios pueden actualizar sucursales de sus tiendas
CREATE POLICY "Users can update branches of their stores"
    ON public.branches
    FOR UPDATE
    USING (
        store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
    )
    WITH CHECK (
        store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
    );

-- Usuarios pueden eliminar sucursales de sus tiendas
CREATE POLICY "Users can delete branches of their stores"
    ON public.branches
    FOR DELETE
    USING (
        store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
    );

-- Permitir lectura pública de sucursales activas (para el widget de reserva)
CREATE POLICY "Public can view active branches"
    ON public.branches
    FOR SELECT
    USING (is_active = true);

-- Agregar campo branches_available a services
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS branches_available UUID[] DEFAULT ARRAY[]::UUID[];

-- Agregar campo branch_id a appointments
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- Índice para búsquedas por sucursal
CREATE INDEX IF NOT EXISTS idx_appointments_branch_id ON public.appointments(branch_id);

-- Comentarios
COMMENT ON TABLE public.branches IS 'Sucursales de las tiendas (funcionalidad PRO)';
COMMENT ON COLUMN public.services.branches_available IS 'Array de IDs de sucursales donde el servicio está disponible. Vacío significa todas las sucursales.';
COMMENT ON COLUMN public.appointments.branch_id IS 'ID de la sucursal donde se realizará el turno. NULL significa la ubicación principal.';
