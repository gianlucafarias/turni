-- =============================================================================
-- Agregar campos para perfil completo de tienda
-- =============================================================================

-- Slug personalizado para URL amigable
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Crear índice para búsquedas por slug
CREATE INDEX IF NOT EXISTS idx_stores_slug ON public.stores(slug);

-- Dirección completa
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';

-- Bio corta / eslogan
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS short_bio TEXT DEFAULT '';

-- Galería de imágenes (array de URLs)
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS gallery_images TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Información de contacto adicional
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

-- Horario de atención en texto libre (para mostrar en perfil)
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS business_hours_text TEXT DEFAULT '';

-- Función para generar slug desde nombre
CREATE OR REPLACE FUNCTION generate_slug(name TEXT)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Convertir a minúsculas, reemplazar espacios y caracteres especiales
    base_slug := lower(name);
    base_slug := regexp_replace(base_slug, '[áàäâ]', 'a', 'g');
    base_slug := regexp_replace(base_slug, '[éèëê]', 'e', 'g');
    base_slug := regexp_replace(base_slug, '[íìïî]', 'i', 'g');
    base_slug := regexp_replace(base_slug, '[óòöô]', 'o', 'g');
    base_slug := regexp_replace(base_slug, '[úùüû]', 'u', 'g');
    base_slug := regexp_replace(base_slug, '[ñ]', 'n', 'g');
    base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
    base_slug := regexp_replace(base_slug, '^-+|-+$', '', 'g');
    
    final_slug := base_slug;
    
    -- Verificar unicidad
    WHILE EXISTS (SELECT 1 FROM public.stores WHERE slug = final_slug) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Generar slugs para tiendas existentes que no tienen
UPDATE public.stores 
SET slug = generate_slug(name) 
WHERE slug IS NULL;

-- Comentarios
COMMENT ON COLUMN public.stores.slug IS 'URL personalizada para la tienda (ej: mi-negocio)';
COMMENT ON COLUMN public.stores.gallery_images IS 'Array de URLs de imágenes para galería/carrusel';
COMMENT ON COLUMN public.stores.short_bio IS 'Descripción breve o eslogan de la tienda';

