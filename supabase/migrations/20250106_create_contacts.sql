-- =============================================================================
-- Tabla de Contactos
-- Guarda los mensajes del formulario de contacto
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Datos del contacto
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    
    -- Estado
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived')),
    read_at TIMESTAMP WITH TIME ZONE,
    replied_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Fechas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_contacts_status ON public.contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON public.contacts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email);

-- RLS Policies
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden ver contactos
DROP POLICY IF EXISTS "Admins can view contacts" ON public.contacts;
CREATE POLICY "Admins can view contacts" ON public.contacts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.stores
            WHERE stores.user_id = auth.uid()
            AND stores.is_admin = true
        )
    );

-- Solo admins pueden actualizar contactos
DROP POLICY IF EXISTS "Admins can update contacts" ON public.contacts;
CREATE POLICY "Admins can update contacts" ON public.contacts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.stores
            WHERE stores.user_id = auth.uid()
            AND stores.is_admin = true
        )
    );

-- Cualquiera puede insertar (formulario público)
DROP POLICY IF EXISTS "Anyone can create contacts" ON public.contacts;
CREATE POLICY "Anyone can create contacts" ON public.contacts
    FOR INSERT WITH CHECK (true);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_contact_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_contact_updated_at ON public.contacts;
CREATE TRIGGER trigger_update_contact_updated_at
    BEFORE UPDATE ON public.contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_contact_updated_at();

SELECT 'Tabla de contactos creada correctamente!' as resultado;
