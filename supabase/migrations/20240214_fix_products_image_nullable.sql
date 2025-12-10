-- =============================================================================
-- FIX: Hacer image_url opcional en productos
-- =============================================================================

-- Cambiar image_url a nullable y agregar valor por defecto
ALTER TABLE products 
ALTER COLUMN image_url DROP NOT NULL;

-- Cambiar description a nullable también (por si acaso)
ALTER TABLE products 
ALTER COLUMN description DROP NOT NULL;

-- Establecer valor por defecto vacío para nuevos registros
ALTER TABLE products 
ALTER COLUMN image_url SET DEFAULT '';

ALTER TABLE products 
ALTER COLUMN description SET DEFAULT '';

SELECT 'Columnas image_url y description ahora son opcionales!' as resultado;

