-- =============================================================================
-- FIX: Recrear políticas de clientes (eliminar si existen primero)
-- =============================================================================

-- Client Tags
DROP POLICY IF EXISTS "Store owners can manage their tags" ON public.client_tags;
CREATE POLICY "Store owners can manage their tags" ON public.client_tags
    FOR ALL USING (
        store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
    );

-- Client Tag Relations
DROP POLICY IF EXISTS "Store owners can manage client tags" ON public.client_tag_relations;
CREATE POLICY "Store owners can manage client tags" ON public.client_tag_relations
    FOR ALL USING (
        client_id IN (
            SELECT c.id FROM public.clients c
            JOIN public.stores s ON c.store_id = s.id
            WHERE s.user_id = auth.uid()
        )
    );

-- Clients
DROP POLICY IF EXISTS "Store owners can manage their clients" ON public.clients;
CREATE POLICY "Store owners can manage their clients" ON public.clients
    FOR ALL USING (
        store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
    );

SELECT 'Políticas de clientes actualizadas!' as resultado;





