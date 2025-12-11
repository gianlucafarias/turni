-- =============================================================================
-- Desactivar Trial - Nuevos usuarios empiezan en plan Free
-- =============================================================================

-- 1. Actualizar el trigger para crear suscripciones FREE en lugar de TRIAL
CREATE OR REPLACE FUNCTION public.create_subscription_for_new_store()
RETURNS TRIGGER AS $$
BEGIN
    -- Crear suscripción FREE para nuevas tiendas (sin trial)
    INSERT INTO public.subscriptions (
        store_id,
        plan_id,
        status
    ) VALUES (
        NEW.id,
        'free',
        'active'
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
        'subscription_created',
        jsonb_build_object(
            'plan_id', 'free',
            'status', 'active'
        )
    FROM public.subscriptions s
    WHERE s.store_id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Convertir todas las suscripciones TRIAL existentes a FREE
UPDATE public.subscriptions
SET 
    plan_id = 'free',
    status = 'active',
    trial_ends_at = NULL,
    updated_at = now()
WHERE plan_id = 'trial' OR status = 'trial';

-- 3. Registrar el cambio en eventos
INSERT INTO public.subscription_events (subscription_id, store_id, event_type, event_data)
SELECT 
    id,
    store_id,
    'trial_disabled',
    jsonb_build_object(
        'reason', 'Trial desactivado globalmente',
        'new_plan', 'free'
    )
FROM public.subscriptions
WHERE plan_id = 'free';

SELECT 'Trial desactivado. Nuevos usuarios empiezan en plan Free.' as resultado;



