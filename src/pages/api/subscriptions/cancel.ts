// =============================================================================
// API para cancelar una suscripción
// =============================================================================

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { cancelSubscription as cancelMPSubscription } from '../../../services/subscriptions';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Verificar autenticación (cookie o Authorization: Bearer)
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7)
      : null;
    const accessToken = bearerToken || cookies.get('sb-access-token')?.value;
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Obtener usuario actual
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parsear body
    const body = await request.json();
    const { storeId, reason } = body as { storeId: string; reason?: string };

    if (!storeId) {
      return new Response(JSON.stringify({ error: 'Datos incompletos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verificar que la tienda pertenece al usuario
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, user_id')
      .eq('id', storeId)
      .eq('user_id', user.id)
      .single();

    if (storeError || !store) {
      return new Response(JSON.stringify({ error: 'Tienda no encontrada' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Obtener la suscripción
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('store_id', storeId)
      .single();

    if (subError || !subscription) {
      return new Response(JSON.stringify({ error: 'Suscripción no encontrada' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Cancelar en Mercado Pago si existe
    if (subscription.mp_subscription_id) {
      try {
        await cancelMPSubscription(subscription.mp_subscription_id);
      } catch (mpError) {
        console.error('Error cancelling MP subscription:', mpError);
        // Continuamos con la cancelación local aunque falle MP
      }
    }

    // Actualizar estado local
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason || 'User requested cancellation',
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);

    if (updateError) {
      throw updateError;
    }

    // Registrar evento
    await supabase.from('subscription_events').insert({
      subscription_id: subscription.id,
      store_id: storeId,
      event_type: 'cancelled',
      event_data: {
        reason,
        cancelled_by: 'user',
        previous_status: subscription.status,
        previous_plan: subscription.plan_id,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Suscripción cancelada. Seguirás teniendo acceso hasta el fin del período actual.',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return new Response(JSON.stringify({ 
      error: 'Error al cancelar suscripción',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

