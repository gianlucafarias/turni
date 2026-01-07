import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

/**
 * Health check endpoint para monitoreo
 * 
 * Retorna:
 * - 200: Todo OK
 * - 503: Algún servicio no está disponible
 * 
 * Uso: Monitorear con UptimeRobot o similar
 */
export const GET: APIRoute = async () => {
  const startTime = Date.now();
  const checks: Record<string, { status: boolean; latency?: number; error?: string }> = {};

  // Check 1: Database connection
  try {
    const dbStart = Date.now();
    const { error } = await supabase.from('stores').select('id').limit(1);
    checks.database = {
      status: !error,
      latency: Date.now() - dbStart,
      error: error?.message,
    };
  } catch (error: any) {
    checks.database = {
      status: false,
      error: error.message,
    };
  }

  // Check 2: Environment variables
  checks.environment = {
    status: !!(
      import.meta.env.PUBLIC_SUPABASE_URL &&
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY
    ),
  };

  // Check 3: Application is responding
  checks.application = {
    status: true,
    latency: Date.now() - startTime,
  };

  const allHealthy = Object.values(checks).every(check => check.status);
  const totalLatency = Date.now() - startTime;

  const response = {
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
    latency: totalLatency,
    version: '1.0.0',
  };

  return new Response(JSON.stringify(response, null, 2), {
    status: allHealthy ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
};
