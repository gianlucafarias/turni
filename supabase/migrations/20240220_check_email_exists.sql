-- =============================================================================
-- Función para verificar si un email ya existe en auth.users
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_email_exists(p_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    -- Verificar si el email existe en auth.users
    SELECT EXISTS(
        SELECT 1 
        FROM auth.users 
        WHERE email = lower(trim(p_email))
    ) INTO v_exists;
    
    RETURN v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permitir que cualquier usuario pueda ejecutar esta función
GRANT EXECUTE ON FUNCTION public.check_email_exists(TEXT) TO anon, authenticated;

-- Comentario
COMMENT ON FUNCTION public.check_email_exists IS 'Verifica si un email ya existe en auth.users';




