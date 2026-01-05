import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

/**
 * Endpoint para notificar a usuarios cuyo trial está por expirar
 * Debe ejecutarse diariamente (cron job)
 * 
 * Envía notificaciones cuando:
 * - Faltan 2 días para que expire el trial
 * - Falta 1 día para que expire el trial
 * - El trial expiró hoy
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    // Verificar autorización
    const authHeader = request.headers.get('Authorization');
    const cronSecret = import.meta.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const notifications: any[] = [];

    // 1. Notificar trials que expiran en 2 días
    const { data: expiring2Days } = await supabase
      .rpc('get_expiring_trials', { p_days_before: 2 });
    
    if (expiring2Days && expiring2Days.length > 0) {
      for (const trial of expiring2Days) {
        // Solo notificar si no ha sido notificado antes
        const { data: existingNotif } = await supabase
          .from('notifications')
          .select('id')
          .eq('store_id', trial.store_id)
          .eq('type', 'trial_expiring_2days')
          .single();
        
        if (!existingNotif) {
          await supabase.from('notifications').insert({
            store_id: trial.store_id,
            type: 'trial_expiring_2days',
            title: '⏰ Tu prueba termina en 2 días',
            message: `¡Aprovechá! Te quedan 2 días de acceso Premium. Pasate al plan Premium para no perder las funciones avanzadas como notificaciones por WhatsApp, gestión de clientes y más.`,
            action_url: '/dashboard/subscription',
            action_label: 'Ver planes',
            priority: 'medium'
          });
          notifications.push({ store_id: trial.store_id, type: '2_days' });
        }
      }
    }

    // 2. Notificar trials que expiran mañana
    const { data: expiring1Day } = await supabase
      .rpc('get_expiring_trials', { p_days_before: 1 });
    
    if (expiring1Day && expiring1Day.length > 0) {
      for (const trial of expiring1Day) {
        const daysRemaining = trial.days_remaining;
        
        // Solo notificar si quedan exactamente 1 día y no ha sido notificado
        if (daysRemaining <= 1) {
          const { data: existingNotif } = await supabase
            .from('notifications')
            .select('id')
            .eq('store_id', trial.store_id)
            .eq('type', 'trial_expiring_tomorrow')
            .single();
          
          if (!existingNotif) {
            await supabase.from('notifications').insert({
              store_id: trial.store_id,
              type: 'trial_expiring_tomorrow',
              title: '🚨 ¡Último día de prueba!',
              message: `Tu período de prueba termina mañana. Si no actualizás tu plan, perderás acceso a las notificaciones por WhatsApp, la gestión de clientes y otras funciones Premium.`,
              action_url: '/dashboard/subscription',
              action_label: 'Actualizar ahora',
              priority: 'high'
            });
            notifications.push({ store_id: trial.store_id, type: '1_day' });
          }
        }
      }
    }

    // 3. Procesar trials expirados
    const { data: expiredTrials } = await supabase
      .rpc('process_expired_trials');

    if (expiredTrials && expiredTrials.length > 0) {
      for (const trial of expiredTrials) {
        // La notificación de expiración ya se crea en process_expired_trials
        notifications.push({ store_id: trial.store_id, type: 'expired' });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      notifications_sent: notifications.length,
      details: notifications
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error en notify-expiring-trials:', error);
    return new Response(JSON.stringify({ 
      error: 'Error interno',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
