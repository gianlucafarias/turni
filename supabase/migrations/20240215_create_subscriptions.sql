-- =============================================================================
-- Sistema de Suscripciones para Tiendita
-- Modelo: Freemium + Trial + Premium (mensual/anual)
-- Pasarela: Mercado Pago Suscripciones
-- =============================================================================

-- =====================
-- 1. TABLA SUBSCRIPTIONS - Suscripciones de tiendas
-- =====================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL UNIQUE,
    
    -- Plan y estado
    plan_id TEXT NOT NULL DEFAULT 'free' CHECK (plan_id IN ('free', 'trial', 'premium', 'premium_annual')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'past_due', 'cancelled', 'expired', 'paused')),
    
    -- Fechas importantes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    
    -- Integración con Mercado Pago
    mp_subscription_id TEXT,              -- ID de suscripción en MP
    mp_preapproval_id TEXT,               -- ID de preapproval en MP
    mp_payer_id TEXT,                     -- ID del pagador en MP
    
    -- Metadata
    cancel_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_subscriptions_store_id ON public.subscriptions(store_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON public.subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_ends ON public.subscriptions(trial_ends_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_mp_subscription ON public.subscriptions(mp_subscription_id);

-- =====================
-- 2. TABLA SUBSCRIPTION_PAYMENTS - Historial de pagos
-- =====================
CREATE TABLE IF NOT EXISTS public.subscription_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE NOT NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    
    -- Datos del pago
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ARS',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'refunded')),
    
    -- Mercado Pago
    mp_payment_id TEXT,
    mp_status TEXT,
    mp_status_detail TEXT,
    
    -- Fechas
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscription ON public.subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_store ON public.subscription_payments(store_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status ON public.subscription_payments(status);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_mp_payment ON public.subscription_payments(mp_payment_id);

-- =====================
-- 3. TABLA SUBSCRIPTION_EVENTS - Log de eventos (auditoría)
-- =====================
CREATE TABLE IF NOT EXISTS public.subscription_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE NOT NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    
    event_type TEXT NOT NULL,  -- 'created', 'upgraded', 'downgraded', 'cancelled', 'renewed', 'payment_failed', etc.
    event_data JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_subscription_events_subscription ON public.subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON public.subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created ON public.subscription_events(created_at);

-- =====================
-- 4. RLS POLICIES
-- =====================

-- Subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Los dueños pueden ver su propia suscripción
DROP POLICY IF EXISTS "Store owners can view their subscription" ON public.subscriptions;
CREATE POLICY "Store owners can view their subscription" ON public.subscriptions
    FOR SELECT USING (
        store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
    );

-- Solo el sistema puede modificar suscripciones (via service role)
-- Los usuarios no pueden modificar directamente

-- Subscription Payments
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners can view their payments" ON public.subscription_payments;
CREATE POLICY "Store owners can view their payments" ON public.subscription_payments
    FOR SELECT USING (
        store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
    );

-- Subscription Events
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners can view their events" ON public.subscription_events;
CREATE POLICY "Store owners can view their events" ON public.subscription_events
    FOR SELECT USING (
        store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
    );

-- =====================
-- 5. FUNCIONES AUXILIARES
-- =====================

-- Función para obtener el plan efectivo de una tienda
CREATE OR REPLACE FUNCTION public.get_effective_plan(p_store_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_subscription RECORD;
BEGIN
    SELECT * INTO v_subscription
    FROM public.subscriptions
    WHERE store_id = p_store_id;
    
    -- Si no tiene suscripción, es free
    IF NOT FOUND THEN
        RETURN 'free';
    END IF;
    
    -- Si está en trial, verificar expiración
    IF v_subscription.plan_id = 'trial' AND v_subscription.trial_ends_at IS NOT NULL THEN
        IF v_subscription.trial_ends_at < now() THEN
            RETURN 'free';  -- Trial expirado
        END IF;
    END IF;
    
    -- Verificar estado
    IF v_subscription.status NOT IN ('active', 'trial') THEN
        RETURN 'free';
    END IF;
    
    RETURN v_subscription.plan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar si tiene acceso premium
CREATE OR REPLACE FUNCTION public.has_premium_access(p_store_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_plan TEXT;
BEGIN
    v_plan := public.get_effective_plan(p_store_id);
    RETURN v_plan IN ('trial', 'premium', 'premium_annual');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener límite de productos
CREATE OR REPLACE FUNCTION public.get_products_limit(p_store_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_plan TEXT;
BEGIN
    v_plan := public.get_effective_plan(p_store_id);
    
    CASE v_plan
        WHEN 'free' THEN RETURN 5;
        ELSE RETURN -1;  -- Ilimitado
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener límite de servicios
CREATE OR REPLACE FUNCTION public.get_services_limit(p_store_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_plan TEXT;
BEGIN
    v_plan := public.get_effective_plan(p_store_id);
    
    CASE v_plan
        WHEN 'free' THEN RETURN 1;
        ELSE RETURN -1;  -- Ilimitado
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- 6. TRIGGER PARA ACTUALIZAR updated_at
-- =====================
CREATE OR REPLACE FUNCTION public.update_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_subscription_updated_at ON public.subscriptions;
CREATE TRIGGER trigger_update_subscription_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_subscription_updated_at();

-- =====================
-- 7. CREAR SUSCRIPCIÓN FREE POR DEFECTO PARA TIENDAS EXISTENTES
-- =====================
INSERT INTO public.subscriptions (store_id, plan_id, status)
SELECT id, 'free', 'active'
FROM public.stores
WHERE id NOT IN (SELECT store_id FROM public.subscriptions)
ON CONFLICT (store_id) DO NOTHING;

-- =====================
-- 8. TRIGGER PARA CREAR SUSCRIPCIÓN AL CREAR TIENDA
-- =====================
CREATE OR REPLACE FUNCTION public.create_subscription_for_new_store()
RETURNS TRIGGER AS $$
BEGIN
    -- Crear suscripción trial para nuevas tiendas
    INSERT INTO public.subscriptions (
        store_id,
        plan_id,
        status,
        trial_ends_at
    ) VALUES (
        NEW.id,
        'trial',
        'trial',
        now() + INTERVAL '14 days'
    );
    
    -- Registrar evento
    INSERT INTO public.subscription_events (
        subscription_id,
        store_id,
        event_type,
        event_data
    )
    SELECT 
        s.id,
        NEW.id,
        'trial_started',
        jsonb_build_object(
            'trial_days', 14,
            'trial_ends_at', (now() + INTERVAL '14 days')::text
        )
    FROM public.subscriptions s
    WHERE s.store_id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_create_subscription ON public.stores;
CREATE TRIGGER trigger_create_subscription
    AFTER INSERT ON public.stores
    FOR EACH ROW
    EXECUTE FUNCTION public.create_subscription_for_new_store();

-- =====================
-- 9. FUNCIÓN PARA VERIFICAR LÍMITES ANTES DE INSERTAR
-- =====================

-- Verificar límite de productos
CREATE OR REPLACE FUNCTION public.check_products_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_limit INTEGER;
    v_current INTEGER;
BEGIN
    v_limit := public.get_products_limit(NEW.store_id);
    
    -- -1 = ilimitado
    IF v_limit = -1 THEN
        RETURN NEW;
    END IF;
    
    SELECT COUNT(*) INTO v_current
    FROM public.products
    WHERE store_id = NEW.store_id AND active = true;
    
    IF v_current >= v_limit THEN
        RAISE EXCEPTION 'LIMIT_EXCEEDED: Has alcanzado el límite de % productos. Actualizá a Premium para productos ilimitados.', v_limit;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_check_products_limit ON public.products;
CREATE TRIGGER trigger_check_products_limit
    BEFORE INSERT ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.check_products_limit();

-- Verificar límite de servicios
CREATE OR REPLACE FUNCTION public.check_services_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_limit INTEGER;
    v_current INTEGER;
BEGIN
    v_limit := public.get_services_limit(NEW.store_id);
    
    -- -1 = ilimitado
    IF v_limit = -1 THEN
        RETURN NEW;
    END IF;
    
    SELECT COUNT(*) INTO v_current
    FROM public.services
    WHERE store_id = NEW.store_id AND active = true;
    
    IF v_current >= v_limit THEN
        RAISE EXCEPTION 'LIMIT_EXCEEDED: El plan Gratis permite solo % servicio. Actualizá a Premium para servicios ilimitados.', v_limit;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_check_services_limit ON public.services;
CREATE TRIGGER trigger_check_services_limit
    BEFORE INSERT ON public.services
    FOR EACH ROW
    EXECUTE FUNCTION public.check_services_limit();

SELECT 'Sistema de suscripciones creado correctamente!' as resultado;













