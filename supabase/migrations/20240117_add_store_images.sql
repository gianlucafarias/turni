-- Agregar columnas para imágenes de tienda
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS profile_image_url TEXT,
ADD COLUMN IF NOT EXISTS banner_image_url TEXT; 