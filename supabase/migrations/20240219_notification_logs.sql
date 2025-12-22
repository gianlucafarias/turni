-- =============================================================================
-- Sistema de logs de notificaciones WhatsApp + Email
-- Para auditoría, métricas y seguimiento de costos
-- =============================================================================

-- =====================
-- 1. TABLA NOTIFICATION_LOGS - Historial de todas las notificaciones
-- =====================
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Referencias
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    
    -- Tipo y canal
    type TEXT NOT NULL, -- appointment_reminder, appointment_confirmed, etc.
    channel TEXT NOT NULL, -- whatsapp, email
    
    -- Estado actual
    status TEXT NOT NULL DEFAULT 'pending', -- pending, queued, sent, delivered, read, failed, rejected
    
    -- Historial de estados (para tracking completo)
    status_history JSONB DEFAULT '[]'::jsonb,
    
    -- IDs externos
    external_message_id TEXT, -- ID de WhatsApp o proveedor de email
    
    -- Contenido (para auditoría)
    template_id TEXT,
    variables JSONB,
    
    -- Costos
    cost_amount NUMERIC(10, 6),
    cost_currency TEXT DEFAULT 'USD',
    message_category TEXT, -- marketing, utility, authentication, service
    
    -- Errores
    error_code TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Metadata adicional
    metadata JSONB
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_notification_logs_store_id ON public.notification_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_client_id ON public.notification_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_appointment_id ON public.notification_logs(appointment_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_external_id ON public.notification_logs(external_message_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON public.notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON public.notification_logs(type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON public.notification_logs(created_at DESC);

-- =====================
-- 2. TABLA CLIENT_NOTIFICATION_PREFERENCES - Preferencias de opt-in/out
-- =====================
CREATE TABLE IF NOT EXISTS public.client_notification_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    
    -- Canales habilitados
    whatsapp_enabled BOOLEAN DEFAULT true,
    email_enabled BOOLEAN DEFAULT true,
    
    -- Tipos de notificación
    appointment_reminders BOOLEAN DEFAULT true,
    appointment_updates BOOLEAN DEFAULT true,
    marketing_messages BOOLEAN DEFAULT false, -- Opt-in explícito para marketing
    
    -- Razón de opt-out
    opt_out_reason TEXT,
    
    CONSTRAINT unique_client_store_prefs UNIQUE (client_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_client_prefs_client ON public.client_notification_preferences(client_id);
CREATE INDEX IF NOT EXISTS idx_client_prefs_store ON public.client_notification_preferences(store_id);

-- =====================
-- 3. TABLA NOTIFICATION_CAMPAIGNS - Para campañas masivas
-- =====================
CREATE TABLE IF NOT EXISTS public.notification_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    
    -- Configuración
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- inactivity, tag_based, custom
    channel TEXT NOT NULL, -- whatsapp, email, both
    
    -- Filtros de segmentación (guardados para auditoría)
    segmentation_filters JSONB,
    
    -- Contenido
    message_template TEXT,
    subject TEXT, -- Para email
    
    -- Estado
    status TEXT NOT NULL DEFAULT 'draft', -- draft, scheduled, running, completed, cancelled
    scheduled_for TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Métricas
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    
    -- Costos
    estimated_cost NUMERIC(10, 4),
    actual_cost NUMERIC(10, 4),
    cost_currency TEXT DEFAULT 'USD',
    
    -- Usuario que creó la campaña
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_campaigns_store ON public.notification_campaigns(store_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.notification_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON public.notification_campaigns(scheduled_for);

-- =====================
-- 4. TABLA SCHEDULED_NOTIFICATION_JOBS - Jobs programados
-- =====================
CREATE TABLE IF NOT EXISTS public.scheduled_notification_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Tipo de job
    type TEXT NOT NULL, -- reminder, status_change, inactivity, campaign
    status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
    
    -- Referencias opcionales
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.notification_campaigns(id) ON DELETE CASCADE,
    
    -- Scheduling
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Resultados
    total_notifications INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    
    -- Metadata
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_scheduled ON public.scheduled_notification_jobs(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_jobs_appointment ON public.scheduled_notification_jobs(appointment_id);
CREATE INDEX IF NOT EXISTS idx_jobs_campaign ON public.scheduled_notification_jobs(campaign_id);

-- =====================
-- 5. RLS POLICIES
-- =====================

-- Notification Logs
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners can view their notification logs" ON public.notification_logs;
CREATE POLICY "Store owners can view their notification logs" ON public.notification_logs
    FOR SELECT USING (
        store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "System can manage notification logs" ON public.notification_logs;
CREATE POLICY "System can manage notification logs" ON public.notification_logs
    FOR ALL USING (true); -- Los logs se crean desde el backend

-- Client Notification Preferences
ALTER TABLE public.client_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners can manage client preferences" ON public.client_notification_preferences;
CREATE POLICY "Store owners can manage client preferences" ON public.client_notification_preferences
    FOR ALL USING (
        store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
    );

-- Notification Campaigns
ALTER TABLE public.notification_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners can manage their campaigns" ON public.notification_campaigns;
CREATE POLICY "Store owners can manage their campaigns" ON public.notification_campaigns
    FOR ALL USING (
        store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
    );

-- Scheduled Jobs
ALTER TABLE public.scheduled_notification_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners can view their scheduled jobs" ON public.scheduled_notification_jobs;
CREATE POLICY "Store owners can view their scheduled jobs" ON public.scheduled_notification_jobs
    FOR SELECT USING (
        store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
    );

-- =====================
-- 6. FUNCIONES AUXILIARES
-- =====================

-- Función para agregar entrada al historial de estados
CREATE OR REPLACE FUNCTION public.append_notification_status_history(
    p_message_id TEXT,
    p_status_entry JSONB
) RETURNS void AS $$
BEGIN
    UPDATE public.notification_logs
    SET 
        status_history = status_history || p_status_entry,
        updated_at = now()
    WHERE external_message_id = p_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener métricas de notificaciones por tienda
CREATE OR REPLACE FUNCTION public.get_notification_metrics(
    p_store_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE (
    total_sent BIGINT,
    total_delivered BIGINT,
    total_read BIGINT,
    total_failed BIGINT,
    delivery_rate NUMERIC,
    read_rate NUMERIC,
    total_cost NUMERIC,
    by_channel JSONB,
    by_type JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) FILTER (WHERE nl.status IN ('sent', 'delivered', 'read')) as total_sent,
        COUNT(*) FILTER (WHERE nl.status IN ('delivered', 'read')) as total_delivered,
        COUNT(*) FILTER (WHERE nl.status = 'read') as total_read,
        COUNT(*) FILTER (WHERE nl.status = 'failed') as total_failed,
        ROUND(
            COUNT(*) FILTER (WHERE nl.status IN ('delivered', 'read'))::NUMERIC / 
            NULLIF(COUNT(*) FILTER (WHERE nl.status IN ('sent', 'delivered', 'read')), 0) * 100,
            2
        ) as delivery_rate,
        ROUND(
            COUNT(*) FILTER (WHERE nl.status = 'read')::NUMERIC / 
            NULLIF(COUNT(*) FILTER (WHERE nl.status IN ('delivered', 'read')), 0) * 100,
            2
        ) as read_rate,
        COALESCE(SUM(nl.cost_amount), 0) as total_cost,
        jsonb_object_agg(
            nl.channel,
            (SELECT COUNT(*) FROM public.notification_logs WHERE store_id = p_store_id AND channel = nl.channel)
        ) as by_channel,
        jsonb_object_agg(
            nl.type,
            (SELECT COUNT(*) FROM public.notification_logs WHERE store_id = p_store_id AND type = nl.type)
        ) as by_type
    FROM public.notification_logs nl
    WHERE nl.store_id = p_store_id
      AND nl.created_at >= p_start_date
      AND nl.created_at < p_end_date + INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener clientes inactivos
CREATE OR REPLACE FUNCTION public.get_inactive_clients(
    p_store_id UUID,
    p_inactive_days INTEGER DEFAULT 30,
    p_limit INTEGER DEFAULT 100
) RETURNS TABLE (
    id UUID,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    last_appointment_date DATE,
    days_inactive INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.last_appointment_date,
        (CURRENT_DATE - c.last_appointment_date)::INTEGER as days_inactive
    FROM public.clients c
    LEFT JOIN public.client_notification_preferences cnp 
        ON c.id = cnp.client_id AND c.store_id = cnp.store_id
    WHERE c.store_id = p_store_id
      AND c.is_active = true
      AND c.last_appointment_date IS NOT NULL
      AND c.last_appointment_date < CURRENT_DATE - p_inactive_days
      AND (cnp.id IS NULL OR cnp.marketing_messages = true)
      AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
    ORDER BY c.last_appointment_date ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION public.notification_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_notification_logs_updated_at ON public.notification_logs;
CREATE TRIGGER update_notification_logs_updated_at
    BEFORE UPDATE ON public.notification_logs
    FOR EACH ROW EXECUTE FUNCTION public.notification_logs_updated_at();

DROP TRIGGER IF EXISTS update_client_prefs_updated_at ON public.client_notification_preferences;
CREATE TRIGGER update_client_prefs_updated_at
    BEFORE UPDATE ON public.client_notification_preferences
    FOR EACH ROW EXECUTE FUNCTION public.notification_logs_updated_at();

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.notification_campaigns;
CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON public.notification_campaigns
    FOR EACH ROW EXECUTE FUNCTION public.notification_logs_updated_at();

-- =====================
-- 7. COMENTARIOS
-- =====================
COMMENT ON TABLE public.notification_logs IS 'Historial de todas las notificaciones enviadas (WhatsApp y Email)';
COMMENT ON TABLE public.client_notification_preferences IS 'Preferencias de opt-in/opt-out de clientes para notificaciones';
COMMENT ON TABLE public.notification_campaigns IS 'Campañas masivas de notificaciones';
COMMENT ON TABLE public.scheduled_notification_jobs IS 'Jobs programados para envío de notificaciones';

COMMENT ON FUNCTION public.get_notification_metrics IS 'Obtiene métricas de notificaciones para una tienda';
COMMENT ON FUNCTION public.get_inactive_clients IS 'Obtiene clientes inactivos para campañas de reactivación';
COMMENT ON FUNCTION public.append_notification_status_history IS 'Agrega entrada al historial de estados de una notificación';

SELECT 'Tablas de notificaciones creadas correctamente!' as resultado;













