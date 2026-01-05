-- =============================================================================
-- Agregar campos de ciudad y provincia a la tabla stores
-- =============================================================================

-- Agregar columna city (ciudad)
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS city TEXT DEFAULT '';

-- Agregar columna province (provincia)
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS province TEXT DEFAULT '';

-- Comentarios
COMMENT ON COLUMN public.stores.city IS 'Ciudad donde se encuentra la tienda';
COMMENT ON COLUMN public.stores.province IS 'Provincia donde se encuentra la tienda';
