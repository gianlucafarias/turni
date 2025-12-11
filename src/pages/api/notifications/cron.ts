// =============================================================================
// Cron Job para procesar notificaciones programadas
// Debe ser llamado periódicamente (ej. cada 5 minutos)
// =============================================================================

import type { APIRoute } from 'astro';
import { getNotificationScheduler } from '../../../lib/notifications/scheduler';

/**
 * Procesa jobs de notificaciones programados
 * Protegido con token secreto para evitar ejecuciones no autorizadas
 */
export const GET: APIRoute = async ({ request }) => {
  // Verificar token de autorización
  const authHeader = request.headers.get('Authorization');
  const expectedToken = import.meta.env.CRON_SECRET_TOKEN;
  
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  try {
    const scheduler = getNotificationScheduler();
    const result = await scheduler.processScheduledJobs();
    
    console.log(`[Notifications Cron] Processed: ${result.processed}, Success: ${result.successful}, Failed: ${result.failed}`);
    
    return new Response(JSON.stringify({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Notifications Cron] Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST = GET; // Permitir POST también para compatibilidad con distintos servicios de cron



