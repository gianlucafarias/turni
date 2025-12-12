-- Función para aplicar cupón del 100% y actualizar suscripción a premium
-- Esta función se ejecuta con SECURITY DEFINER para poder actualizar la suscripción
CREATE OR REPLACE FUNCTION public.apply_coupon_premium(
  p_store_id UUID,
  p_coupon_id UUID,
  p_user_id UUID,
  p_months INTEGER DEFAULT 1
)
RETURNS JSONB AS $$
DECLARE
  v_subscription_id UUID;
  v_period_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Buscar o esperar la suscripción (puede haber sido creada por trigger)
  SELECT id INTO v_subscription_id
  FROM public.subscriptions
  WHERE store_id = p_store_id
  LIMIT 1;

  -- Si no existe, esperar un momento (el trigger puede estar creándola)
  IF v_subscription_id IS NULL THEN
    PERFORM pg_sleep(0.5);
    SELECT id INTO v_subscription_id
    FROM public.subscriptions
    WHERE store_id = p_store_id
    LIMIT 1;
  END IF;

  IF v_subscription_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No se encontró suscripción');
  END IF;

  -- Calcular fecha de fin
  v_period_end := now() + (p_months::text || ' months')::INTERVAL;

  -- Actualizar suscripción a premium
  UPDATE public.subscriptions
  SET 
    plan_id = 'premium',
    status = 'active',
    current_period_start = now(),
    current_period_end = v_period_end,
    trial_ends_at = NULL,
    updated_at = now()
  WHERE id = v_subscription_id;

  -- Registrar el uso del cupón
  INSERT INTO public.coupon_uses (
    coupon_id,
    user_id,
    store_id,
    subscription_id,
    discount_applied,
    original_amount,
    final_amount
  ) VALUES (
    p_coupon_id,
    p_user_id,
    p_store_id,
    v_subscription_id,
    2999, -- Precio del plan
    2999, -- Monto original
    0     -- Monto final (gratis)
  );

  -- Incrementar contador de usos del cupón
  UPDATE public.coupons
  SET times_used = COALESCE(times_used, 0) + 1
  WHERE id = p_coupon_id;

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_subscription_id,
    'plan_id', 'premium',
    'period_end', v_period_end
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

