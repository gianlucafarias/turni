-- Create the stores table
CREATE TABLE IF NOT EXISTS public.stores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    plan TEXT DEFAULT 'free' NOT NULL,
    store_type TEXT CHECK (store_type IN ('products', 'appointments')) NOT NULL,
    products_count INTEGER DEFAULT 0 NOT NULL,
    setup_completed BOOLEAN DEFAULT false NOT NULL,
    description TEXT DEFAULT '' NOT NULL,
    location TEXT DEFAULT '' NOT NULL,
    whatsapp_url TEXT,
    twitter_url TEXT,
    banner_url TEXT,
    logo_url TEXT,
    profile_image_url TEXT,
    banner_image_url TEXT
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_stores_user_id ON public.stores(user_id);

-- Enable RLS (Row Level Security)
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Create policies for stores
-- Users can view their own stores
CREATE POLICY "Users can view their own stores"
    ON public.stores
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own stores
CREATE POLICY "Users can insert their own stores"
    ON public.stores
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own stores
CREATE POLICY "Users can update their own stores"
    ON public.stores
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own stores
CREATE POLICY "Users can delete their own stores"
    ON public.stores
    FOR DELETE
    USING (auth.uid() = user_id);

-- Allow public read access to stores (for viewing store pages)
CREATE POLICY "Public can view stores"
    ON public.stores
    FOR SELECT
    USING (true);

