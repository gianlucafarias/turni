-- Crear una función de seguridad que verifique si un usuario existe
-- Esta función tiene permisos para acceder a auth.users
CREATE OR REPLACE FUNCTION public.user_exists(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = user_uuid
    );
END;
$$;

-- Eliminar la política existente para recrearla con mejor lógica
DROP POLICY IF EXISTS "Users can insert their own stores" ON public.stores;

-- Crear una política más permisiva para inserts
-- Permite insertar si:
-- 1. El user_id coincide con auth.uid() (usuario autenticado)
-- 2. O el user_id existe en auth.users (caso de registro reciente sin sesión activa)
CREATE POLICY "Users can insert their own stores"
    ON public.stores
    FOR INSERT
    WITH CHECK (
        -- Caso 1: Usuario autenticado creando su propia tienda
        (auth.uid() IS NOT NULL AND auth.uid() = user_id)
        OR
        -- Caso 2: Usuario recién registrado (user_id existe en auth.users)
        -- Esto permite crear tiendas durante el registro antes de que la sesión esté completamente activa
        public.user_exists(user_id)
    );

