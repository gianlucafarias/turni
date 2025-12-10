// =============================================================================
// API para crear una suscripción
// Redirige al usuario al checkout de Mercado Pago
// =============================================================================

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { createSubscription } from '../../../services/subscriptions';
import { isPaidPlan, type PlanId } from '../../../lib/subscription';

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
    const { planId, storeId } = body as { planId: PlanId; storeId: string };

    // Validar datos
    if (!planId || !storeId) {
      return new Response(JSON.stringify({ error: 'Datos incompletos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verificar que es un plan de pago
    if (!isPaidPlan(planId)) {
      return new Response(JSON.stringify({ error: 'Plan no válido para suscripción' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verificar que la tienda pertenece al usuario
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, name, user_id')
      .eq('id', storeId)
      .eq('user_id', user.id)
      .single();

    if (storeError || !store) {
      return new Response(JSON.stringify({ error: 'Tienda no encontrada' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verificar si ya tiene una suscripción activa de pago
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('store_id', storeId)
      .in('status', ['active'])
      .in('plan_id', ['premium', 'premium_annual'])
      .single();

    if (existingSubscription) {
      return new Response(JSON.stringify({ 
        error: 'Ya tienes una suscripción activa',
        subscription: existingSubscription,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Crear suscripción en Mercado Pago
    const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';
    const result = await createSubscription({
      storeId,
      planId,
      payerEmail: user.email!,
      backUrl: `${siteUrl}/dashboard/subscription/callback`,
      externalReference: `store_${storeId}_${Date.now()}`,
    });

    // Actualizar la suscripción local con el ID de MP
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        mp_subscription_id: result.subscriptionId,
        mp_preapproval_id: result.subscriptionId,
        metadata: {
          pending_plan_id: planId,
          checkout_started_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('store_id', storeId);

    if (updateError) {
      console.error('Error updating subscription:', updateError);
    }

    // Registrar evento
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('store_id', storeId)
      .single();

    if (subscription) {
      await supabase.from('subscription_events').insert({
        subscription_id: subscription.id,
        store_id: storeId,
        event_type: 'checkout_started',
        event_data: {
          plan_id: planId,
          mp_subscription_id: result.subscriptionId,
        },
      });
    }

    // Devolver URL de checkout
    return new Response(JSON.stringify({
      success: true,
      checkoutUrl: result.initPoint,
      subscriptionId: result.subscriptionId,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error creating subscription:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('card_token_id is required') ? 400 : 500;
    return new Response(JSON.stringify({ 
      error: message,
    }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

