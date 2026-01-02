-- =============================================================================
-- Habilitar Trial de 7 días + Límite de 5 turnos por día en plan Free
-- =============================================================================

-- =====================
-- 1. AGREGAR COLUMNAS PARA TRACKING DEL TRIAL
-- =====================

-- Campo para saber si ya usó el trial (no puede activarlo de nuevo)
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT false;

-- Campo para saber si ya se notificó la expiración
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS trial_expiry_notified BOOLEAN DEFAULT false;

-- Marcar las suscripciones existentes como que ya usaron trial (evitar que lo activen)
UPDATE public.subscriptions 
SET trial_used = true 
WHERE created_at < NOW() - INTERVAL '1 day';

-- =====================
-- 2. FUNCIÓN PARA OBTENER LÍMITE DE TURNOS POR DÍA
-- =====================
CREATE OR REPLACE FUNCTION public.get_daily_appointments_limit(p_store_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_plan TEXT;
BEGIN
    v_plan := public.get_effective_plan(p_store_id);
    
    CASE v_plan
        WHEN 'free' THEN RETURN 5;  -- Plan free: máximo 5 turnos por día
        ELSE RETURN -1;             -- Premium/Trial: ilimitado
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- 3. FUNCIÓN PARA CONTAR TURNOS DEL DÍA
-- =====================
CREATE OR REPLACE FUNCTION public.count_daily_appointments(p_store_id UUID, p_date DATE)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.appointments
    WHERE store_id = p_store_id 
      AND date = p_date
      AND status IN ('pending', 'confirmed');
    
    RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- 4. FUNCIÓN PARA VERIFICAR SI SE PUEDE CREAR UN TURNO
-- =====================
CREATE OR REPLACE FUNCTION public.can_create_appointment(p_store_id UUID, p_date DATE)
RETURNS BOOLEAN AS $$
DECLARE
    v_limit INTEGER;
    v_current INTEGER;
BEGIN
    v_limit := public.get_daily_appointments_limit(p_store_id);
    
    -- -1 = ilimitado
    IF v_limit = -1 THEN
        RETURN true;
    END IF;
    
    v_current := public.count_daily_appointments(p_store_id, p_date);
    
    RETURN v_current < v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- 5. TRIGGER PARA VERIFICAR LÍMITE AL CREAR TURNO
-- =====================
CREATE OR REPLACE FUNCTION public.check_daily_appointments_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_limit INTEGER;
    v_current INTEGER;
BEGIN
    -- Solo verificar en INSERT y cuando el status es pending o confirmed
    IF TG_OP = 'INSERT' AND NEW.status IN ('pending', 'confirmed') THEN
        v_limit := public.get_daily_appointments_limit(NEW.store_id);
        
        -- -1 = ilimitado
        IF v_limit = -1 THEN
            RETURN NEW;
        END IF;
        
        v_current := public.count_daily_appointments(NEW.store_id, NEW.date);
        
        IF v_current >= v_limit THEN
            RAISE EXCEPTION 'DAILY_LIMIT_EXCEEDED: Se alcanzó el límite de % turnos para este día. Pasate a Premium para turnos ilimitados.', v_limit;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_check_daily_appointments_limit ON public.appointments;
CREATE TRIGGER trigger_check_daily_appointments_limit
    BEFORE INSERT ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.check_daily_appointments_limit();

-- =====================
-- 6. ACTUALIZAR TRIGGER DE NUEVA TIENDA PARA ACTIVAR TRIAL
-- =====================
CREATE OR REPLACE FUNCTION public.create_subscription_for_new_store()
RETURNS TRIGGER AS $$
BEGIN
    -- Crear suscripción con TRIAL de 7 días para nuevas tiendas
    INSERT INTO public.subscriptions (
        store_id,
        plan_id,
        status,
        trial_ends_at,
        trial_used
    ) VALUES (
        NEW.id,
        'trial',
        'trial',
        NOW() + INTERVAL '7 days',
        true  -- Marcar como que ya usó el trial
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
            'trial_days', 7,
            'trial_ends_at', (NOW() + INTERVAL '7 days')::text,
            'features_enabled', ARRAY['clients_management', 'notifications', 'multiple_services', 'google_calendar']
        )
    FROM public.subscriptions s
    WHERE s.store_id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- 7. FUNCIÓN PARA PROCESAR TRIALS EXPIRADOS
-- =====================
CREATE OR REPLACE FUNCTION public.process_expired_trials()
RETURNS TABLE(
    store_id UUID,
    store_name TEXT,
    owner_email TEXT,
    services_paused INTEGER
) AS $$
DECLARE
    v_subscription RECORD;
    v_store RECORD;
    v_services_to_pause INTEGER;
BEGIN
    -- Buscar todas las suscripciones trial que expiraron y no fueron procesadas
    FOR v_subscription IN 
        SELECT s.*, st.name as store_name, st.user_id
        FROM public.subscriptions s
        JOIN public.stores st ON st.id = s.store_id
        WHERE s.plan_id = 'trial' 
          AND s.status = 'trial'
          AND s.trial_ends_at IS NOT NULL
          AND s.trial_ends_at < NOW()
    LOOP
        -- 1. Cambiar el plan a FREE
        UPDATE public.subscriptions
        SET 
            plan_id = 'free',
            status = 'active',
            updated_at = NOW()
        WHERE id = v_subscription.id;
        
        -- 2. Contar servicios que hay que pausar (dejar solo 1 activo)
        SELECT COUNT(*) - 1 INTO v_services_to_pause
        FROM public.services
        WHERE store_id = v_subscription.store_id AND active = true;
        
        -- 3. Pausar servicios extra (mantener solo el primero creado)
        IF v_services_to_pause > 0 THEN
            UPDATE public.services
            SET active = false
            WHERE store_id = v_subscription.store_id
              AND active = true
              AND id NOT IN (
                  SELECT id 
                  FROM public.services 
                  WHERE store_id = v_subscription.store_id AND active = true
                  ORDER BY created_at ASC
                  LIMIT 1
              );
        END IF;
        
        -- 4. Desactivar sincronización con Google Calendar en la tienda
        UPDATE public.stores
        SET 
            google_calendar_enabled = false,
            updated_at = NOW()
        WHERE id = v_subscription.store_id;
        
        -- 5. Registrar evento de expiración
        INSERT INTO public.subscription_events (
            subscription_id,
            store_id,
            event_type,
            event_data
        ) VALUES (
            v_subscription.id,
            v_subscription.store_id,
            'trial_expired',
            jsonb_build_object(
                'trial_ended_at', v_subscription.trial_ends_at,
                'new_plan', 'free',
                'services_paused', GREATEST(0, v_services_to_pause),
                'features_disabled', ARRAY['clients_management', 'notifications', 'multiple_services', 'google_calendar']
            )
        );
        
        -- Obtener email del owner
        SELECT email INTO v_store
        FROM auth.users
        WHERE id = v_subscription.user_id;
        
        -- Retornar info para notificación
        store_id := v_subscription.store_id;
        store_name := v_subscription.store_name;
        owner_email := v_store.email;
        services_paused := GREATEST(0, v_services_to_pause);
        
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- 8. FUNCIÓN PARA VERIFICAR SI EL TRIAL ESTÁ POR EXPIRAR (para notificaciones)
-- =====================
CREATE OR REPLACE FUNCTION public.get_expiring_trials(p_days_before INTEGER DEFAULT 1)
RETURNS TABLE(
    store_id UUID,
    store_name TEXT,
    owner_email TEXT,
    trial_ends_at TIMESTAMPTZ,
    days_remaining INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.store_id,
        st.name as store_name,
        u.email as owner_email,
        s.trial_ends_at,
        EXTRACT(DAY FROM s.trial_ends_at - NOW())::INTEGER as days_remaining
    FROM public.subscriptions s
    JOIN public.stores st ON st.id = s.store_id
    JOIN auth.users u ON u.id = st.user_id
    WHERE s.plan_id = 'trial' 
      AND s.status = 'trial'
      AND s.trial_ends_at IS NOT NULL
      AND s.trial_ends_at > NOW()
      AND s.trial_ends_at <= NOW() + (p_days_before || ' days')::INTERVAL
      AND s.trial_expiry_notified = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- 9. FUNCIÓN PARA MARCAR TRIAL COMO NOTIFICADO
-- =====================
CREATE OR REPLACE FUNCTION public.mark_trial_notified(p_store_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.subscriptions
    SET trial_expiry_notified = true
    WHERE store_id = p_store_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- 10. FUNCIÓN API PARA VERIFICAR DISPONIBILIDAD DE TURNOS
-- =====================
CREATE OR REPLACE FUNCTION public.check_appointment_availability(
    p_store_id UUID, 
    p_date DATE
)
RETURNS JSONB AS $$
DECLARE
    v_limit INTEGER;
    v_current INTEGER;
    v_plan TEXT;
BEGIN
    v_plan := public.get_effective_plan(p_store_id);
    v_limit := public.get_daily_appointments_limit(p_store_id);
    v_current := public.count_daily_appointments(p_store_id, p_date);
    
    RETURN jsonb_build_object(
        'plan', v_plan,
        'daily_limit', v_limit,
        'current_count', v_current,
        'slots_remaining', CASE WHEN v_limit = -1 THEN -1 ELSE v_limit - v_current END,
        'can_book', CASE WHEN v_limit = -1 THEN true ELSE v_current < v_limit END,
        'is_unlimited', v_limit = -1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Trial de 7 días habilitado + Límite de 5 turnos/día en plan free' as resultado;
