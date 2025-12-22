-- Función para incrementar el contador de usos de un cupón
CREATE OR REPLACE FUNCTION public.increment_coupon_uses(p_coupon_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.coupons
    SET times_used = COALESCE(times_used, 0) + 1
    WHERE id = p_coupon_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;









