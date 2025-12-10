ALTER TABLE products
ADD COLUMN category_id UUID REFERENCES categories(id);

-- Actualizar la política RLS para incluir la nueva columna
ALTER POLICY "Usuarios pueden ver productos de su tienda" ON products
    USING (store_id IN (
        SELECT id FROM stores 
        WHERE user_id = auth.uid()
    ));

ALTER POLICY "Usuarios pueden modificar productos de su tienda" ON products
    USING (store_id IN (
        SELECT id FROM stores 
        WHERE user_id = auth.uid()
    ))
    WITH CHECK (store_id IN (
        SELECT id FROM stores 
        WHERE user_id = auth.uid()
    )); 