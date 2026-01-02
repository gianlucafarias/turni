// =============================================================================
// Webhook de Mercado Pago para Suscripciones
// Recibe notificaciones de cambios en suscripciones y pagos
// =============================================================================

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { processWebhook, getSubscription, mapMPStatusToLocal, calculatePeriodEnd } from '../../../services/subscriptions';
import type { WebhookEvent } from '../../../services/subscriptions';
import { markAsPastDue } from '../../../lib/subscription';

export const POST: APIRoute = async ({ request }) => {
  try {
    // Parsear el body del webhook
    const event = await request.json() as WebhookEvent;
    
    console.log('Received MP Webhook:', {
      type: event.type,
      action: event.action,
      dataId: event.data?.id,
    });

    // Validar que tenemos los datos necesarios
    if (!event.type || !event.data?.id) {
      return new Response(JSON.stringify({ error: 'Invalid webhook payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Procesar según el tipo de evento
    if (event.type === 'subscription_preapproval') {
      // Obtener la suscripción de MP
      const mpSubscription = await getSubscription(event.data.id);
      
      // Extraer store_id del external_reference
      const externalRef = mpSubscription.external_reference;
      const storeIdMatch = externalRef?.match(/store_([^_]+)/);
      
      if (!storeIdMatch) {
        console.error('Could not extract store_id:', externalRef);
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      const storeId = storeIdMatch[1];
      const localStatus = mapMPStatusToLocal(mpSubscription.status);

      // Obtener suscripción local para saber plan pendiente
      const { data: localSub } = await supabase
        .from('subscriptions')
        .select('id, metadata')
        .eq('store_id', storeId)
        .single();

      const pendingPlanId = (localSub?.metadata as any)?.pending_plan_id as string | undefined;
      const isAnnual = pendingPlanId === 'premium_annual';
      const periodStart = new Date();
      const periodEnd = calculatePeriodEnd(periodStart, isAnnual);
      
      // Actualizar la suscripción en nuestra DB
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: localStatus,
          mp_subscription_id: mpSubscription.id,
          mp_payer_id: mpSubscription.payer_id?.toString(),
          // Si es autorizada (activa), actualizar el plan a premium/premium_annual
          ...(mpSubscription.status === 'authorized' && {
            plan_id: pendingPlanId || 'premium',
            current_period_start: periodStart.toISOString(),
            current_period_end: periodEnd.toISOString(),
          }),
          // Si es cancelada, registrar la fecha
          ...(mpSubscription.status === 'cancelled' && {
            cancelled_at: new Date().toISOString(),
          }),
          updated_at: new Date().toISOString(),
        })
        .eq('store_id', storeId);

      if (updateError) {
        console.error('Error updating subscription:', updateError);
      }

      // Registrar el evento
      await supabase.from('subscription_events').insert({
        subscription_id: (await supabase
          .from('subscriptions')
          .select('id')
          .eq('store_id', storeId)
          .single()
        ).data?.id,
        store_id: storeId,
        event_type: `mp_${event.action}`,
        event_data: {
          mp_subscription_id: mpSubscription.id,
          mp_status: mpSubscription.status,
          local_status: localStatus,
        },
      });
    }

    // Para pagos de suscripción
    if (event.type === 'subscription_authorized_payment' || event.type === 'payment') {
      const result = await processWebhook(event);
      
      if (result && 'preapprovalId' in result) {
        // Obtener la suscripción para encontrar el store_id
        const mpSubscription = await getSubscription(result.preapprovalId);
        const externalRef = mpSubscription.external_reference;
        const storeIdMatch = externalRef?.match(/store_([^_]+)/);
        
        if (storeIdMatch) {
          const storeId = storeIdMatch[1];
          
          // Obtener la suscripción local
            const { data: subscription } = await supabase
            .from('subscriptions')
              .select('id, metadata')
              .eq('store_id', storeId)
              .single();

            if (subscription) {
              // Registrar el pago
              await supabase.from('subscription_payments').insert({
                subscription_id: subscription.id,
                store_id: storeId,
                amount: mpSubscription.auto_recurring?.transaction_amount || 0,
                currency: 'ARS',
                status: result.paymentStatus === 'approved' ? 'approved' : 'pending',
                mp_payment_id: result.paymentId,
                mp_status: result.paymentStatus,
                paid_at: result.paymentStatus === 'approved' 
                  ? new Date().toISOString() 
                  : null,
              });

              // Si el pago fue aprobado, actualizar período y plan (usar el pendiente si existe)
              if (result.paymentStatus === 'approved') {
                const pendingPlanId = (subscription.metadata as any)?.pending_plan_id as string | undefined;
                const isAnnual = pendingPlanId === 'premium_annual';
                const periodStart = new Date();
                const periodEnd = calculatePeriodEnd(periodStart, isAnnual);

                await supabase
                  .from('subscriptions')
                  .update({
                    status: 'active',
                    plan_id: pendingPlanId || 'premium',
                    current_period_start: periodStart.toISOString(),
                    current_period_end: periodEnd.toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', subscription.id);
              } else {
                // Si el pago no fue aprobado, marcar la suscripción como past_due
                await markAsPastDue(subscription.id);
              }
            }
        }
      }
    }

    // Responder 200 OK para que MP no reintente
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    
    // Aún así responder 200 para evitar reintentos en errores de procesamiento
    return new Response(JSON.stringify({ 
      received: true, 
      error: 'Processing error' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Mercado Pago también puede enviar GET para verificar el endpoint
export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ status: 'ok' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

