// =============================================================================
// API de Cron para procesar suscripciones
// Debe llamarse periódicamente (ej: cada hora o diariamente)
// 
// Seguridad: Protegido por un token secreto en el header
// Usar con servicios como Vercel Cron, Railway, o un cron externo
// =============================================================================

import type { APIRoute } from 'astro';
import { 
  processExpiredSubscriptions, 
  sendTrialReminders,
  getSubscriptionMetrics 
} from '../../../lib/subscription';

// Token secreto para autorizar el cron
const CRON_SECRET = import.meta.env.CRON_SECRET || 'dev-cron-secret';

export const GET: APIRoute = async ({ request }) => {
  // Verificar autorización
  const authHeader = request.headers.get('Authorization');
  const providedToken = authHeader?.replace('Bearer ', '');

  if (providedToken !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const startTime = Date.now();
  const results: Record<string, any> = {};

  try {
    // 1. Procesar suscripciones expiradas
    results.expirations = await processExpiredSubscriptions();

    // 2. Enviar recordatorios de trial
    results.reminders = await sendTrialReminders();

    // 3. Obtener métricas actuales
    results.metrics = await getSubscriptionMetrics();

    const duration = Date.now() - startTime;

    return new Response(JSON.stringify({
      success: true,
      duration: `${duration}ms`,
      results,
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Cron job error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      partialResults: results,
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// También soportar POST para mayor compatibilidad con servicios de cron
export const POST = GET;






