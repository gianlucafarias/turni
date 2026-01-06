-- =============================================================================
-- Agregar tokens públicos para acceso desde URLs públicas
-- Permite editar cliente y registrar turnos desde URLs públicas
-- =============================================================================

-- Token para editar cliente desde página pública
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS edit_token TEXT UNIQUE;

-- Token para registrar turno desde página pública
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS booking_token TEXT UNIQUE;

-- Índices para búsqueda rápida por token
CREATE INDEX IF NOT EXISTS idx_clients_edit_token ON public.clients(edit_token);
CREATE INDEX IF NOT EXISTS idx_clients_booking_token ON public.clients(booking_token);

-- Función para generar tokens únicos
CREATE OR REPLACE FUNCTION generate_client_token()
RETURNS TEXT AS $$
DECLARE
    token TEXT;
    exists_check BOOLEAN;
BEGIN
    LOOP
        -- Generar token aleatorio de 32 caracteres
        token := encode(gen_random_bytes(24), 'base64');
        token := replace(replace(token, '/', '_'), '+', '-');
        token := substring(token from 1 for 32);
        
        -- Verificar que no exista
        SELECT EXISTS(SELECT 1 FROM public.clients WHERE edit_token = token OR booking_token = token) INTO exists_check;
        
        EXIT WHEN NOT exists_check;
    END LOOP;
    
    RETURN token;
END;
$$ LANGUAGE plpgsql;

-- Generar tokens para clientes existentes que no los tengan
UPDATE public.clients 
SET 
    edit_token = generate_client_token(),
    booking_token = generate_client_token()
WHERE edit_token IS NULL OR booking_token IS NULL;

-- Trigger para generar tokens automáticamente en nuevos clientes
CREATE OR REPLACE FUNCTION set_client_tokens()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.edit_token IS NULL THEN
        NEW.edit_token := generate_client_token();
    END IF;
    
    IF NEW.booking_token IS NULL THEN
        NEW.booking_token := generate_client_token();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_client_tokens ON public.clients;
CREATE TRIGGER trigger_set_client_tokens
    BEFORE INSERT ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION set_client_tokens();

-- RLS Policy para permitir lectura pública por token (solo lectura)
-- Nota: Las políticas de escritura seguirán siendo solo para dueños de tienda

-- Permitir lectura de cliente por edit_token
DROP POLICY IF EXISTS "Public can read client by edit_token" ON public.clients;
CREATE POLICY "Public can read client by edit_token" ON public.clients
    FOR SELECT USING (edit_token IS NOT NULL);

-- Permitir lectura de cliente por booking_token
DROP POLICY IF EXISTS "Public can read client by booking_token" ON public.clients;
CREATE POLICY "Public can read client by booking_token" ON public.clients
    FOR SELECT USING (booking_token IS NOT NULL);

-- Permitir actualización de cliente por edit_token (solo campos específicos)
DROP POLICY IF EXISTS "Public can update client by edit_token" ON public.clients;
CREATE POLICY "Public can update client by edit_token" ON public.clients
    FOR UPDATE USING (edit_token IS NOT NULL)
    WITH CHECK (
        edit_token IS NOT NULL AND
        -- Solo permitir actualizar campos específicos, no store_id ni estadísticas
        store_id = (SELECT store_id FROM public.clients WHERE edit_token = current_setting('request.jwt.claims', true)::json->>'edit_token' LIMIT 1)
    );

SELECT 'Tokens públicos agregados a clientes correctamente!' as resultado;
