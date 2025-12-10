// =============================================================================
// API para obtener el estado de la suscripción de una tienda
// =============================================================================

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getSubscriptionSummary } from '../../../lib/subscription';
import type { Subscription } from '../../../types/subscription';

export const GET: APIRoute = async ({ request, url, cookies }) => {
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

    // Obtener storeId del query param
    const storeId = url.searchParams.get('storeId');
    if (!storeId) {
      return new Response(JSON.stringify({ error: 'storeId requerido' }), {
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

    // Obtener resumen
    const summary = getSubscriptionSummary(subscription as Subscription | null);

    // Obtener historial de pagos recientes
    const { data: payments } = await supabase
      .from('subscription_payments')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(5);

    return new Response(JSON.stringify({
      subscription: subscription || null,
      summary,
      recentPayments: payments || [],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error getting subscription status:', error);
    return new Response(JSON.stringify({ 
      error: 'Error al obtener estado de suscripción',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

