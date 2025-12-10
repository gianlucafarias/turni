-- =============================================================================
-- Crear tabla de perfiles de usuario con datos personales
-- =============================================================================

-- Crear tabla de perfiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Datos personales
    first_name TEXT DEFAULT '',
    last_name TEXT DEFAULT '',
    birth_date DATE,
    
    -- Ubicación
    provincia TEXT DEFAULT '',
    localidad TEXT DEFAULT '',
    
    -- Contacto adicional
    phone TEXT DEFAULT '',
    
    -- Preferencias
    notifications_enabled BOOLEAN DEFAULT true,
    newsletter_subscribed BOOLEAN DEFAULT false
);

-- Índice para búsquedas rápidas por user_id
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);

-- Habilitar RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Usuarios pueden ver su propio perfil
CREATE POLICY "Users can view their own profile"
    ON public.user_profiles
    FOR SELECT
    USING (auth.uid() = user_id);

-- Usuarios pueden insertar su propio perfil
CREATE POLICY "Users can insert their own profile"
    ON public.user_profiles
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update their own profile"
    ON public.user_profiles
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Función para crear perfil automáticamente al crear usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, first_name, last_name, birth_date, provincia, localidad)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        CASE 
            WHEN NEW.raw_user_meta_data->>'birth_date' IS NOT NULL 
            AND NEW.raw_user_meta_data->>'birth_date' != '' 
            THEN (NEW.raw_user_meta_data->>'birth_date')::DATE 
            ELSE NULL 
        END,
        COALESCE(NEW.raw_user_meta_data->>'provincia', ''),
        COALESCE(NEW.raw_user_meta_data->>'localidad', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para ejecutar función al crear usuario
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Función para actualizar timestamp de updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at automáticamente
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Crear perfiles para usuarios existentes que no tengan
INSERT INTO public.user_profiles (user_id, first_name, last_name, provincia, localidad)
SELECT 
    u.id,
    COALESCE(u.raw_user_meta_data->>'first_name', ''),
    COALESCE(u.raw_user_meta_data->>'last_name', ''),
    COALESCE(u.raw_user_meta_data->>'provincia', ''),
    COALESCE(u.raw_user_meta_data->>'localidad', '')
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.user_id = u.id
);

-- Comentarios
COMMENT ON TABLE public.user_profiles IS 'Perfiles de usuario con datos personales';
COMMENT ON COLUMN public.user_profiles.first_name IS 'Nombre del usuario';
COMMENT ON COLUMN public.user_profiles.last_name IS 'Apellido del usuario';
COMMENT ON COLUMN public.user_profiles.birth_date IS 'Fecha de nacimiento';
COMMENT ON COLUMN public.user_profiles.provincia IS 'Provincia de residencia';
COMMENT ON COLUMN public.user_profiles.localidad IS 'Ciudad/localidad de residencia';
