import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

/**
 * Endpoint para procesar trials expirados
 * Debe ejecutarse periódicamente (cron job) para:
 * 1. Convertir trials expirados a plan free
 * 2. Pausar servicios extra (dejar solo 1)
 * 3. Desactivar Google Calendar
 * 4. Enviar notificaciones de expiración
 * 
 * Seguridad: Solo accesible con API key o desde cron interno
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    // Verificar autorización (API key o header especial)
    const authHeader = request.headers.get('Authorization');
    const cronSecret = import.meta.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Llamar a la función de PostgreSQL que procesa los trials expirados
    const { data: expiredTrials, error: processError } = await supabase
      .rpc('process_expired_trials');

    if (processError) {
      console.error('Error procesando trials expirados:', processError);
      return new Response(JSON.stringify({ 
        error: 'Error procesando trials',
        details: processError.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Si hay trials que expiraron, enviar notificaciones
    const notifications: any[] = [];
    
    if (expiredTrials && expiredTrials.length > 0) {
      for (const trial of expiredTrials) {
        // Crear notificación interna
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            store_id: trial.store_id,
            type: 'trial_expired',
            title: 'Tu período de prueba finalizó',
            message: `Tu prueba gratuita de 7 días ha finalizado. Ahora estás en el plan Gratis con funciones limitadas. ¡Pasate a Premium para seguir disfrutando de todas las funciones!`,
            action_url: '/dashboard/subscription',
            action_label: 'Ver planes',
            priority: 'high'
          });

        if (notifError) {
          console.error('Error creando notificación:', notifError);
        }

        notifications.push({
          store_id: trial.store_id,
          store_name: trial.store_name,
          services_paused: trial.services_paused
        });

        // TODO: Enviar email de notificación
        // await sendTrialExpiredEmail(trial.owner_email, trial.store_name);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: expiredTrials?.length || 0,
      notifications
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error en process-expired-trials:', error);
    return new Response(JSON.stringify({ 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * GET: Obtener trials que están por expirar (para notificar)
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const daysBefore = parseInt(url.searchParams.get('days') || '1');

    // Obtener trials que expiran en los próximos X días
    const { data: expiringTrials, error } = await supabase
      .rpc('get_expiring_trials', { p_days_before: daysBefore });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      expiring: expiringTrials || [],
      count: expiringTrials?.length || 0
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Error interno',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
