-- =============================================================================
-- Agregar campo de rubro del negocio (business_category) a stores
-- =============================================================================

-- Agregar columna business_category a la tabla stores
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS business_category TEXT DEFAULT '';

-- Crear índice para búsquedas por rubro
CREATE INDEX IF NOT EXISTS idx_stores_business_category ON public.stores(business_category);

-- Comentario para documentar los valores posibles
COMMENT ON COLUMN public.stores.business_category IS 'Rubro del negocio: profesional, peluqueria, salud, estetica, fitness, otro';













