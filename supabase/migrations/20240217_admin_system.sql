-- =============================================================================
-- Sistema de Administración
-- Agrega campos para admin, cupones y configuración
-- =============================================================================

-- 1. AGREGAR CAMPO IS_ADMIN A PROFILES (si existe) o crear tabla
-- Si ya existe profiles, agregar columna. Si no, usar auth.users metadata
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 2. TABLA DE CONFIGURACIÓN GLOBAL DEL SITIO
CREATE TABLE IF NOT EXISTS public.site_config (
    id TEXT PRIMARY KEY DEFAULT 'main',
    
    -- Configuración general
    site_name TEXT DEFAULT 'Tiendita',
    site_description TEXT DEFAULT 'Tu negocio online',
    maintenance_mode BOOLEAN DEFAULT false,
    
    -- Configuración de planes (JSON para flexibilidad)
    plan_config JSONB DEFAULT '{
        "free": {
            "maxProducts": 5,
            "maxServices": 1,
            "maxAppointmentsPerMonth": 30,
            "maxClients": 0
        },
        "premium": {
            "maxProducts": -1,
            "maxServices": -1,
            "maxAppointmentsPerMonth": -1,
            "maxClients": -1
        }
    }'::jsonb,
    
    -- Precios (en centavos para precisión)
    pricing JSONB DEFAULT '{
        "premium_monthly": 4990,
        "premium_annual": 49900,
        "currency": "ARS"
    }'::jsonb,
    
    -- Metadata
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Insertar configuración por defecto si no existe
INSERT INTO public.site_config (id) VALUES ('main') ON CONFLICT (id) DO NOTHING;

-- 3. TABLA DE CUPONES DE DESCUENTO
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Código del cupón (único)
    code TEXT UNIQUE NOT NULL,
    
    -- Descripción
    description TEXT,
    
    -- Tipo de descuento: 'percentage' o 'fixed'
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    
    -- Valor del descuento (porcentaje o monto fijo)
    discount_value NUMERIC(10, 2) NOT NULL,
    
    -- Restricciones
    min_amount NUMERIC(10, 2) DEFAULT 0, -- Monto mínimo para aplicar
    max_uses INTEGER, -- NULL = ilimitado
    max_uses_per_user INTEGER DEFAULT 1,
    
    -- Planes aplicables (NULL = todos)
    applicable_plans TEXT[], -- ['premium', 'premium_annual']
    
    -- Vigencia
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT now(),
    valid_until TIMESTAMP WITH TIME ZONE,
    
    -- Estado
    active BOOLEAN DEFAULT true,
    
    -- Contadores
    times_used INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Índices para cupones
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON public.coupons(active);

-- 4. TABLA DE USO DE CUPONES
CREATE TABLE IF NOT EXISTS public.coupon_uses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    coupon_id UUID REFERENCES public.coupons(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    store_id UUID REFERENCES public.stores(id),
    subscription_id UUID REFERENCES public.subscriptions(id),
    
    -- Detalles del uso
    discount_applied NUMERIC(10, 2) NOT NULL,
    original_amount NUMERIC(10, 2) NOT NULL,
    final_amount NUMERIC(10, 2) NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. TABLA DE LOG DE ADMIN
CREATE TABLE IF NOT EXISTS public.admin_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    entity_type TEXT, -- 'user', 'store', 'subscription', 'coupon', 'config'
    entity_id TEXT,
    details JSONB DEFAULT '{}',
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para logs
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON public.admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON public.admin_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON public.admin_logs(created_at);

-- 6. RLS POLICIES

-- Site Config - Solo admins pueden leer/modificar
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage site config" ON public.site_config;
CREATE POLICY "Admins can manage site config" ON public.site_config
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.stores WHERE user_id = auth.uid() AND is_admin = true)
    );

-- También permitir lectura pública de configuración básica
DROP POLICY IF EXISTS "Public can read site config" ON public.site_config;
CREATE POLICY "Public can read site config" ON public.site_config
    FOR SELECT USING (true);

-- Coupons - Solo admins pueden gestionar
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage coupons" ON public.coupons;
CREATE POLICY "Admins can manage coupons" ON public.coupons
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.stores WHERE user_id = auth.uid() AND is_admin = true)
    );

-- Cupones activos pueden ser leídos por todos (para validar)
DROP POLICY IF EXISTS "Users can read active coupons" ON public.coupons;
CREATE POLICY "Users can read active coupons" ON public.coupons
    FOR SELECT USING (active = true);

-- Coupon Uses - Users can see their own, admins can see all
ALTER TABLE public.coupon_uses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see their coupon uses" ON public.coupon_uses;
CREATE POLICY "Users can see their coupon uses" ON public.coupon_uses
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage coupon uses" ON public.coupon_uses;
CREATE POLICY "Admins can manage coupon uses" ON public.coupon_uses
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.stores WHERE user_id = auth.uid() AND is_admin = true)
    );

-- Admin Logs - Solo admins
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view logs" ON public.admin_logs;
CREATE POLICY "Admins can view logs" ON public.admin_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.stores WHERE user_id = auth.uid() AND is_admin = true)
    );

-- 7. FUNCIÓN PARA VERIFICAR SI ES ADMIN
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.stores 
        WHERE user_id = p_user_id AND is_admin = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. FUNCIÓN PARA VALIDAR CUPÓN
CREATE OR REPLACE FUNCTION public.validate_coupon(
    p_code TEXT,
    p_user_id UUID,
    p_plan_id TEXT DEFAULT NULL,
    p_amount NUMERIC DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_coupon RECORD;
    v_user_uses INTEGER;
    v_discount NUMERIC;
BEGIN
    -- Buscar cupón
    SELECT * INTO v_coupon
    FROM public.coupons
    WHERE code = UPPER(p_code) AND active = true;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Cupón no encontrado');
    END IF;
    
    -- Verificar vigencia
    IF v_coupon.valid_from > now() THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Cupón aún no válido');
    END IF;
    
    IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < now() THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Cupón expirado');
    END IF;
    
    -- Verificar usos máximos
    IF v_coupon.max_uses IS NOT NULL AND v_coupon.times_used >= v_coupon.max_uses THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Cupón agotado');
    END IF;
    
    -- Verificar usos por usuario
    SELECT COUNT(*) INTO v_user_uses
    FROM public.coupon_uses
    WHERE coupon_id = v_coupon.id AND user_id = p_user_id;
    
    IF v_user_uses >= v_coupon.max_uses_per_user THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Ya usaste este cupón');
    END IF;
    
    -- Verificar monto mínimo
    IF p_amount < v_coupon.min_amount THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Monto mínimo no alcanzado: $' || v_coupon.min_amount);
    END IF;
    
    -- Verificar plan aplicable
    IF v_coupon.applicable_plans IS NOT NULL AND p_plan_id IS NOT NULL THEN
        IF NOT (p_plan_id = ANY(v_coupon.applicable_plans)) THEN
            RETURN jsonb_build_object('valid', false, 'error', 'Cupón no válido para este plan');
        END IF;
    END IF;
    
    -- Calcular descuento
    IF v_coupon.discount_type = 'percentage' THEN
        v_discount := p_amount * (v_coupon.discount_value / 100);
    ELSE
        v_discount := v_coupon.discount_value;
    END IF;
    
    -- No puede ser mayor al monto
    IF v_discount > p_amount THEN
        v_discount := p_amount;
    END IF;
    
    RETURN jsonb_build_object(
        'valid', true,
        'coupon_id', v_coupon.id,
        'code', v_coupon.code,
        'description', v_coupon.description,
        'discount_type', v_coupon.discount_type,
        'discount_value', v_coupon.discount_value,
        'discount_amount', v_discount,
        'final_amount', p_amount - v_discount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. MARCAR UN USUARIO COMO ADMIN (ejecutar manualmente)
-- UPDATE public.stores SET is_admin = true WHERE user_id = 'TU_USER_ID';

SELECT 'Sistema de admin creado correctamente' as resultado;



