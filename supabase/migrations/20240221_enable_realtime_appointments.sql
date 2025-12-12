-- =============================================================================
-- Habilitar Supabase Realtime para la tabla appointments
-- Esto permite recibir notificaciones en tiempo real cuando se crean turnos
-- =============================================================================

-- Habilitar la replicación para la tabla appointments
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;

-- Verificar que la publicación incluya la tabla
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- NOTA: También se puede habilitar desde el Dashboard de Supabase:
-- 1. Ir a Database > Replication
-- 2. Encontrar la tabla 'appointments'
-- 3. Activar el toggle para habilitarla

SELECT 'Realtime habilitado para tabla appointments' as resultado;

