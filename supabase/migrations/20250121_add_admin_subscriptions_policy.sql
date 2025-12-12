-- Permitir que los admins vean todas las suscripciones
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.stores WHERE user_id = auth.uid() AND is_admin = true)
    );

-- Permitir que los admins actualicen todas las suscripciones (aunque usamos supabaseAdmin, esto es por si acaso)
DROP POLICY IF EXISTS "Admins can update all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can update all subscriptions" ON public.subscriptions
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.stores WHERE user_id = auth.uid() AND is_admin = true)
    );

-- Permitir que los admins inserten suscripciones
DROP POLICY IF EXISTS "Admins can insert subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can insert subscriptions" ON public.subscriptions
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.stores WHERE user_id = auth.uid() AND is_admin = true)
    );

