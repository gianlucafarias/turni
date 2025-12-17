-- =============================================================================
-- Sistema de Clientes para tiendas de turnos
-- Guarda automáticamente los datos de clientes y permite gestionarlos
-- =============================================================================

-- =====================
-- 1. TABLA CLIENTS - Clientes únicos
-- =====================
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    
    -- Datos de identificación (para matching)
    email TEXT,
    phone TEXT,
    
    -- Datos personales
    first_name TEXT NOT NULL,
    last_name TEXT,
    location TEXT,
    
    -- Notas y observaciones del negocio
    notes TEXT,
    
    -- Estadísticas (se actualizan automáticamente)
    total_appointments INTEGER DEFAULT 0,
    completed_appointments INTEGER DEFAULT 0,
    cancelled_appointments INTEGER DEFAULT 0,
    last_appointment_date DATE,
    first_appointment_date DATE,
    total_spent NUMERIC(10, 2) DEFAULT 0,
    
    -- Estado
    is_active BOOLEAN DEFAULT true,
    
    -- Índice único por tienda + email o teléfono
    CONSTRAINT unique_client_email UNIQUE (store_id, email),
    CONSTRAINT unique_client_phone UNIQUE (store_id, phone)
);

-- Índices para búsqueda
CREATE INDEX IF NOT EXISTS idx_clients_store_id ON public.clients(store_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_last_appointment ON public.clients(last_appointment_date);
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients(first_name, last_name);

-- =====================
-- 2. TABLA CLIENT_TAGS - Etiquetas para clientes
-- =====================
CREATE TABLE IF NOT EXISTS public.client_tags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1', -- Color por defecto (indigo)
    description TEXT,
    
    CONSTRAINT unique_tag_name UNIQUE (store_id, name)
);

CREATE INDEX IF NOT EXISTS idx_client_tags_store_id ON public.client_tags(store_id);

-- =====================
-- 3. TABLA CLIENT_TAG_RELATIONS - Relación clientes-etiquetas
-- =====================
CREATE TABLE IF NOT EXISTS public.client_tag_relations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    tag_id UUID REFERENCES public.client_tags(id) ON DELETE CASCADE NOT NULL,
    
    CONSTRAINT unique_client_tag UNIQUE (client_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_client_tag_relations_client ON public.client_tag_relations(client_id);
CREATE INDEX IF NOT EXISTS idx_client_tag_relations_tag ON public.client_tag_relations(tag_id);

-- =====================
-- 4. VINCULAR APPOINTMENTS CON CLIENTS
-- =====================
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON public.appointments(client_id);

-- =====================
-- 5. RLS POLICIES
-- =====================

-- Clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners can manage their clients" ON public.clients;
CREATE POLICY "Store owners can manage their clients" ON public.clients
    FOR ALL USING (
        store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
    );

-- Client Tags
ALTER TABLE public.client_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners can manage their tags" ON public.client_tags;
CREATE POLICY "Store owners can manage their tags" ON public.client_tags
    FOR ALL USING (
        store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
    );

-- Client Tag Relations
ALTER TABLE public.client_tag_relations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners can manage client tags" ON public.client_tag_relations;
CREATE POLICY "Store owners can manage client tags" ON public.client_tag_relations
    FOR ALL USING (
        client_id IN (
            SELECT c.id FROM public.clients c
            JOIN public.stores s ON c.store_id = s.id
            WHERE s.user_id = auth.uid()
        )
    );

-- =====================
-- 6. FUNCIÓN PARA CREAR/ACTUALIZAR CLIENTE DESDE APPOINTMENT
-- =====================
CREATE OR REPLACE FUNCTION public.sync_client_from_appointment()
RETURNS TRIGGER AS $$
DECLARE
    v_client_id UUID;
    v_first_name TEXT;
    v_last_name TEXT;
BEGIN
    -- Solo procesar si hay datos del cliente
    IF NEW.client_name IS NULL OR NEW.client_name = '' THEN
        RETURN NEW;
    END IF;

    -- Separar nombre y apellido
    v_first_name := split_part(NEW.client_name, ' ', 1);
    v_last_name := NULLIF(substring(NEW.client_name from position(' ' in NEW.client_name) + 1), '');
    
    -- Buscar cliente existente por email o teléfono
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE store_id = NEW.store_id
      AND (
          (email IS NOT NULL AND email = NEW.client_email)
          OR (phone IS NOT NULL AND phone = NEW.client_phone)
      )
    LIMIT 1;
    
    -- Si no existe, crear nuevo cliente
    IF v_client_id IS NULL THEN
        INSERT INTO public.clients (
            store_id,
            email,
            phone,
            first_name,
            last_name,
            location,
            total_appointments,
            first_appointment_date,
            last_appointment_date
        ) VALUES (
            NEW.store_id,
            NULLIF(NEW.client_email, ''),
            NULLIF(NEW.client_phone, ''),
            v_first_name,
            v_last_name,
            NULLIF(NEW.client_location, ''),
            1,
            NEW.date,
            NEW.date
        )
        ON CONFLICT (store_id, email) DO UPDATE SET
            phone = COALESCE(EXCLUDED.phone, public.clients.phone),
            last_name = COALESCE(EXCLUDED.last_name, public.clients.last_name),
            location = COALESCE(EXCLUDED.location, public.clients.location),
            total_appointments = public.clients.total_appointments + 1,
            last_appointment_date = GREATEST(public.clients.last_appointment_date, EXCLUDED.last_appointment_date),
            updated_at = now()
        RETURNING id INTO v_client_id;
        
        -- Si falló por email, intentar por teléfono
        IF v_client_id IS NULL AND NEW.client_phone IS NOT NULL THEN
            INSERT INTO public.clients (
                store_id,
                email,
                phone,
                first_name,
                last_name,
                location,
                total_appointments,
                first_appointment_date,
                last_appointment_date
            ) VALUES (
                NEW.store_id,
                NULLIF(NEW.client_email, ''),
                NULLIF(NEW.client_phone, ''),
                v_first_name,
                v_last_name,
                NULLIF(NEW.client_location, ''),
                1,
                NEW.date,
                NEW.date
            )
            ON CONFLICT (store_id, phone) DO UPDATE SET
                email = COALESCE(EXCLUDED.email, public.clients.email),
                last_name = COALESCE(EXCLUDED.last_name, public.clients.last_name),
                location = COALESCE(EXCLUDED.location, public.clients.location),
                total_appointments = public.clients.total_appointments + 1,
                last_appointment_date = GREATEST(public.clients.last_appointment_date, EXCLUDED.last_appointment_date),
                updated_at = now()
            RETURNING id INTO v_client_id;
        END IF;
    ELSE
        -- Actualizar cliente existente
        UPDATE public.clients SET
            last_name = COALESCE(v_last_name, last_name),
            location = COALESCE(NULLIF(NEW.client_location, ''), location),
            total_appointments = total_appointments + 1,
            last_appointment_date = GREATEST(last_appointment_date, NEW.date),
            updated_at = now()
        WHERE id = v_client_id;
    END IF;
    
    -- Vincular appointment con cliente
    NEW.client_id := v_client_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para sincronizar clientes
DROP TRIGGER IF EXISTS trigger_sync_client ON public.appointments;
CREATE TRIGGER trigger_sync_client
    BEFORE INSERT ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_client_from_appointment();

-- =====================
-- 7. FUNCIÓN PARA ACTUALIZAR ESTADÍSTICAS DE CLIENTE
-- =====================
CREATE OR REPLACE FUNCTION public.update_client_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar estadísticas cuando cambia el estado del turno
    IF NEW.client_id IS NOT NULL THEN
        UPDATE public.clients SET
            completed_appointments = (
                SELECT COUNT(*) FROM public.appointments 
                WHERE client_id = NEW.client_id AND status = 'confirmed'
            ),
            cancelled_appointments = (
                SELECT COUNT(*) FROM public.appointments 
                WHERE client_id = NEW.client_id AND status = 'cancelled'
            ),
            total_spent = (
                SELECT COALESCE(SUM(service_price), 0) FROM public.appointments 
                WHERE client_id = NEW.client_id AND status = 'confirmed'
            ),
            updated_at = now()
        WHERE id = NEW.client_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para actualizar stats
DROP TRIGGER IF EXISTS trigger_update_client_stats ON public.appointments;
CREATE TRIGGER trigger_update_client_stats
    AFTER UPDATE OF status ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_client_stats();

-- =====================
-- 8. MIGRAR CLIENTES EXISTENTES DE APPOINTMENTS
-- =====================
-- Esto creará clientes a partir de los appointments existentes
INSERT INTO public.clients (store_id, email, phone, first_name, last_name, location, total_appointments, first_appointment_date, last_appointment_date)
SELECT DISTINCT ON (a.store_id, COALESCE(a.client_email, a.client_phone))
    a.store_id,
    NULLIF(a.client_email, ''),
    NULLIF(a.client_phone, ''),
    split_part(a.client_name, ' ', 1),
    NULLIF(substring(a.client_name from position(' ' in a.client_name) + 1), ''),
    NULLIF(a.client_location, ''),
    1,
    MIN(a.date) OVER (PARTITION BY a.store_id, COALESCE(a.client_email, a.client_phone)),
    MAX(a.date) OVER (PARTITION BY a.store_id, COALESCE(a.client_email, a.client_phone))
FROM public.appointments a
WHERE a.client_name IS NOT NULL 
  AND a.client_name != ''
  AND a.client_id IS NULL
ON CONFLICT DO NOTHING;

-- Vincular appointments existentes con clientes
UPDATE public.appointments a SET
    client_id = c.id
FROM public.clients c
WHERE a.store_id = c.store_id
  AND a.client_id IS NULL
  AND (
      (a.client_email IS NOT NULL AND a.client_email = c.email)
      OR (a.client_phone IS NOT NULL AND a.client_phone = c.phone)
  );

-- Actualizar contadores de clientes
UPDATE public.clients c SET
    total_appointments = (SELECT COUNT(*) FROM public.appointments WHERE client_id = c.id),
    completed_appointments = (SELECT COUNT(*) FROM public.appointments WHERE client_id = c.id AND status = 'confirmed'),
    cancelled_appointments = (SELECT COUNT(*) FROM public.appointments WHERE client_id = c.id AND status = 'cancelled'),
    total_spent = (SELECT COALESCE(SUM(service_price), 0) FROM public.appointments WHERE client_id = c.id AND status = 'confirmed'),
    first_appointment_date = (SELECT MIN(date) FROM public.appointments WHERE client_id = c.id),
    last_appointment_date = (SELECT MAX(date) FROM public.appointments WHERE client_id = c.id);

SELECT 'Tablas de clientes creadas correctamente!' as resultado;






