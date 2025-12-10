-- Create the products table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    image_url TEXT NOT NULL,
    stock INTEGER DEFAULT 0 NOT NULL,
    active BOOLEAN DEFAULT true NOT NULL,
    category_id UUID
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_products_store_id ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(active);

-- Enable RLS (Row Level Security)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create policies for products
-- Users can view products from their stores
CREATE POLICY "Usuarios pueden ver productos de su tienda"
    ON public.products
    FOR SELECT
    USING (
        store_id IN (
            SELECT id FROM public.stores 
            WHERE user_id = auth.uid()
        )
    );

-- Public can view active products
CREATE POLICY "Public can view active products"
    ON public.products
    FOR SELECT
    USING (active = true);

-- Users can insert products in their stores
CREATE POLICY "Usuarios pueden insertar productos en su tienda"
    ON public.products
    FOR INSERT
    WITH CHECK (
        store_id IN (
            SELECT id FROM public.stores 
            WHERE user_id = auth.uid()
        )
    );

-- Users can update products in their stores
CREATE POLICY "Usuarios pueden modificar productos de su tienda"
    ON public.products
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

-- Users can delete products from their stores
CREATE POLICY "Usuarios pueden eliminar productos de su tienda"
    ON public.products
    FOR DELETE
    USING (
        store_id IN (
            SELECT id FROM public.stores 
            WHERE user_id = auth.uid()
        )
    );

