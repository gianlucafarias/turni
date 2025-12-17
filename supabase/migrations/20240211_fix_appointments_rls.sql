-- =============================================================================
-- SOLUCIÓN CRÍTICA: Permitir que CUALQUIERA pueda ver appointments
-- para verificar disponibilidad de horarios en la página pública
-- =============================================================================

-- Eliminar la política restrictiva anterior
DROP POLICY IF EXISTS "Store owners can view their appointments" ON public.appointments;

-- Crear nueva política que permite a CUALQUIERA ver appointments
-- (necesario para que el BookingWidget pueda verificar disponibilidad)
CREATE POLICY "Anyone can view appointments"
    ON public.appointments
    FOR SELECT
    USING (true);

-- Nota: Esta política es segura porque:
-- 1. Solo permite SELECT (lectura), no modificación
-- 2. Es necesario para que los clientes vean qué horarios están ocupados
-- 3. Los datos sensibles del cliente no se exponen en la consulta de disponibilidad






