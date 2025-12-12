-- Política RLS para permitir acceso público a turnos por token
-- Nota: La validación del token se hace en la aplicación (página /appointment/[token])
-- Esta política permite acceso de lectura a turnos con token
CREATE POLICY "Public access to appointments by token"
    ON public.appointments
    FOR SELECT
    USING (public_token IS NOT NULL);

-- Política para permitir actualización por token (solo clientes)
-- Nota: La validación del token se hace en la aplicación antes de actualizar
-- Esta política permite actualización de turnos con token, pero la aplicación
-- debe validar que el token coincida antes de permitir la actualización
CREATE POLICY "Clients can update their appointments by token"
    ON public.appointments
    FOR UPDATE
    USING (public_token IS NOT NULL)
    WITH CHECK (public_token IS NOT NULL);

