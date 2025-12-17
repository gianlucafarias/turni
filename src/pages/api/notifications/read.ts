// =============================================================================
// API para marcar notificaciones como leídas (opcional, para persistencia en DB)
// Por ahora las notificaciones se guardan en localStorage, pero este endpoint
// está preparado para cuando se quiera persistir en base de datos
// =============================================================================

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { notificationIds, markAll } = body as { 
      notificationIds?: string[]; 
      markAll?: boolean;
    };

    // Por ahora solo respondemos OK ya que usamos localStorage
    // En el futuro, aquí se actualizaría la tabla de notificaciones
    
    return new Response(JSON.stringify({ 
      success: true,
      message: markAll 
        ? 'Todas las notificaciones marcadas como leídas'
        : `${notificationIds?.length || 0} notificaciones marcadas como leídas`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Obtener notificaciones (para futuro uso con DB)
export const GET: APIRoute = async ({ request, url }) => {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Obtener store del usuario
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!store) {
      return new Response(JSON.stringify({ error: 'Tienda no encontrada' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generar notificaciones dinámicas basadas en el estado actual
    const notifications = await generateDynamicNotifications(store.id);

    return new Response(JSON.stringify({ notifications }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error getting notifications:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Generar notificaciones dinámicas
async function generateDynamicNotifications(storeId: string) {
  const notifications = [];
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // 1. Turnos del día
  const { data: todayAppointments } = await supabase
    .from('appointments')
    .select('id, client_name, time, service_name, status')
    .eq('store_id', storeId)
    .eq('date', todayStr)
    .in('status', ['pending', 'confirmed'])
    .order('time', { ascending: true });

  if (todayAppointments && todayAppointments.length > 0) {
    const pendingCount = todayAppointments.filter(a => a.status === 'pending').length;
    notifications.push({
      id: `daily_summary_${todayStr}`,
      type: 'daily_summary',
      title: '📅 Turnos de hoy',
      message: `Tenés ${todayAppointments.length} turno${todayAppointments.length !== 1 ? 's' : ''} hoy${pendingCount > 0 ? ` (${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''})` : ''}`,
      priority: 'medium',
      createdAt: new Date().toISOString(),
      data: {
        linkTo: '/dashboard/appointments',
      },
    });
  }

  // 2. Verificar próximo pago de suscripción
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan_id, status, current_period_end, trial_ends_at')
    .eq('store_id', storeId)
    .single();

  if (subscription) {
    // Suscripción próxima a vencer
    if (subscription.current_period_end && subscription.status === 'active') {
      const endDate = new Date(subscription.current_period_end);
      const daysUntilEnd = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilEnd <= 5 && daysUntilEnd > 0) {
        notifications.push({
          id: `payment_reminder_${daysUntilEnd}`,
          type: 'subscription_reminder',
          title: '💳 Próximo pago',
          message: `Tu suscripción se renueva en ${daysUntilEnd} día${daysUntilEnd !== 1 ? 's' : ''}`,
          priority: 'medium',
          createdAt: new Date().toISOString(),
          data: {
            daysRemaining: daysUntilEnd,
            linkTo: '/dashboard/subscription',
          },
        });
      }
    }

    // Trial por terminar
    if (subscription.trial_ends_at && subscription.status === 'trial') {
      const trialEnd = new Date(subscription.trial_ends_at);
      const daysUntilTrialEnd = Math.ceil((trialEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilTrialEnd <= 3 && daysUntilTrialEnd > 0) {
        notifications.push({
          id: `trial_ending_${daysUntilTrialEnd}`,
          type: 'trial_ending',
          title: '⏳ Tu prueba termina pronto',
          message: `Quedan ${daysUntilTrialEnd} día${daysUntilTrialEnd !== 1 ? 's' : ''} de prueba gratuita`,
          priority: 'high',
          createdAt: new Date().toISOString(),
          data: {
            daysRemaining: daysUntilTrialEnd,
            linkTo: '/dashboard/subscription',
          },
        });
      }
    }
  }

  // 3. Verificar turnos pendientes de confirmar
  const { data: pendingAppointments } = await supabase
    .from('appointments')
    .select('id')
    .eq('store_id', storeId)
    .eq('status', 'pending')
    .gte('date', todayStr);

  if (pendingAppointments && pendingAppointments.length > 0) {
    notifications.push({
      id: 'pending_appointments',
      type: 'appointment_reminder',
      title: '⏰ Turnos pendientes',
      message: `Tenés ${pendingAppointments.length} turno${pendingAppointments.length !== 1 ? 's' : ''} por confirmar`,
      priority: 'medium',
      createdAt: new Date().toISOString(),
      data: {
        linkTo: '/dashboard/appointments?filter=pending',
      },
    });
  }

  return notifications;
}


