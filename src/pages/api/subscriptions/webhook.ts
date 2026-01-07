// =============================================================================
// Webhook de Mercado Pago para Suscripciones
// Recibe notificaciones de cambios en suscripciones y pagos recurrentes
// 
// IMPORTANTE: Mercado Pago envía estos tipos de eventos para suscripciones:
// - subscription_preapproval: Cambios en el estado de la suscripción
// - subscription_authorized_payment: Pago recurrente procesado
// - payment: Pago genérico (puede ser de suscripción)
// =============================================================================

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { getSubscription, mapMPStatusToLocal, calculatePeriodEnd } from '../../../services/subscriptions';
import type { WebhookEvent } from '../../../services/subscriptions';
import { markAsPastDue } from '../../../lib/subscription';

// Helper para obtener información de un pago de MP
async function getMPPayment(paymentId: string) {
  const MP_ACCESS_TOKEN = import.meta.env.MERCADOPAGO_ACCESS_TOKEN;
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
  });
  if (!response.ok) throw new Error(`Payment not found: ${paymentId}`);
  return response.json();
}

// Helper para obtener información de un pago autorizado de suscripción
async function getMPAuthorizedPayment(authorizedPaymentId: string) {
  const MP_ACCESS_TOKEN = import.meta.env.MERCADOPAGO_ACCESS_TOKEN;
  const response = await fetch(`https://api.mercadopago.com/authorized_payments/${authorizedPaymentId}`, {
    headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
  });
  if (!response.ok) throw new Error(`Authorized payment not found: ${authorizedPaymentId}`);
  return response.json();
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Parsear el body del webhook
    const event = await request.json() as WebhookEvent;
    
    console.log('📥 Received MP Webhook:', {
      type: event.type,
      action: event.action,
      dataId: event.data?.id,
      timestamp: new Date().toISOString(),
    });

    // Validar que tenemos los datos necesarios
    if (!event.type || !event.data?.id) {
      console.warn('⚠️ Invalid webhook payload - missing type or data.id');
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
      const { data: localSub } = await supabaseAdmin
        .from('subscriptions')
        .select('id, metadata')
        .eq('store_id', storeId)
        .single();

      const pendingPlanId = (localSub?.metadata as any)?.pending_plan_id as string | undefined;
      const isAnnual = pendingPlanId === 'premium_annual';
      const periodStart = new Date();
      const periodEnd = calculatePeriodEnd(periodStart, isAnnual);
      
      // Actualizar la suscripción en nuestra DB
      const { error: updateError } = await supabaseAdmin
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
        console.error('❌ Error updating subscription:', updateError);
      } else {
        console.log('✅ Subscription updated:', { storeId, status: localStatus });
      }

      // Registrar el evento
      if (localSub?.id) {
        await supabaseAdmin.from('subscription_events').insert({
          subscription_id: localSub.id,
          store_id: storeId,
          event_type: `mp_${event.action}`,
          event_data: {
            mp_subscription_id: mpSubscription.id,
            mp_status: mpSubscription.status,
            local_status: localStatus,
          },
        });
      }
    }

    // ==========================================================================
    // PAGOS RECURRENTES DE SUSCRIPCIÓN
    // Mercado Pago envía 'subscription_authorized_payment' para cada débito
    // ==========================================================================
    if (event.type === 'subscription_authorized_payment') {
      console.log('💳 Processing subscription payment:', event.data.id);
      
      try {
        // Obtener información del pago autorizado
        const authorizedPayment = await getMPAuthorizedPayment(event.data.id);
        console.log('📄 Authorized payment info:', {
          id: authorizedPayment.id,
          preapproval_id: authorizedPayment.preapproval_id,
          payment: authorizedPayment.payment,
        });
        
        // Obtener la suscripción de MP para el external_reference
        const mpSubscription = await getSubscription(authorizedPayment.preapproval_id);
        const externalRef = mpSubscription.external_reference;
        const storeIdMatch = externalRef?.match(/store_([^_]+)/);
        
        if (!storeIdMatch) {
          console.error('❌ Could not extract store_id from:', externalRef);
        } else {
          const storeId = storeIdMatch[1];
          
          // Verificar si ya registramos este pago (evitar duplicados)
          const { data: existingPayment } = await supabaseAdmin
            .from('subscription_payments')
            .select('id')
            .eq('mp_payment_id', authorizedPayment.payment?.id?.toString())
            .single();
          
          if (existingPayment) {
            console.log('⚠️ Payment already registered:', authorizedPayment.payment?.id);
          } else {
            // Obtener la suscripción local
            const { data: subscription } = await supabaseAdmin
              .from('subscriptions')
              .select('id, plan_id, metadata')
              .eq('store_id', storeId)
              .single();

            if (subscription) {
              const paymentStatus = authorizedPayment.payment?.status;
              const paymentAmount = authorizedPayment.transaction_amount || 
                                    mpSubscription.auto_recurring?.transaction_amount || 0;
              
              // Registrar el pago en el historial
              const { error: insertError } = await supabaseAdmin
                .from('subscription_payments')
                .insert({
                  subscription_id: subscription.id,
                  store_id: storeId,
                  amount: paymentAmount,
                  currency: 'ARS',
                  status: paymentStatus === 'approved' ? 'approved' : 
                          paymentStatus === 'rejected' ? 'rejected' : 'pending',
                  mp_payment_id: authorizedPayment.payment?.id?.toString(),
                  mp_status: paymentStatus,
                  mp_status_detail: authorizedPayment.payment?.status_detail,
                  paid_at: paymentStatus === 'approved' ? new Date().toISOString() : null,
                });

              if (insertError) {
                console.error('❌ Error inserting payment:', insertError);
              } else {
                console.log('✅ Payment registered:', {
                  mp_payment_id: authorizedPayment.payment?.id,
                  amount: paymentAmount,
                  status: paymentStatus,
                });
              }

              // Si el pago fue aprobado, renovar el período
              if (paymentStatus === 'approved') {
                const isAnnual = subscription.plan_id === 'premium_annual';
                const periodStart = new Date();
                const periodEnd = calculatePeriodEnd(periodStart, isAnnual);

                await supabaseAdmin
                  .from('subscriptions')
                  .update({
                    status: 'active',
                    current_period_start: periodStart.toISOString(),
                    current_period_end: periodEnd.toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', subscription.id);
                
                console.log('✅ Subscription period renewed until:', periodEnd.toISOString());
                
                // Registrar evento de renovación
                await supabaseAdmin.from('subscription_events').insert({
                  subscription_id: subscription.id,
                  store_id: storeId,
                  event_type: 'payment_succeeded',
                  event_data: {
                    mp_payment_id: authorizedPayment.payment?.id,
                    amount: paymentAmount,
                    period_end: periodEnd.toISOString(),
                  },
                });
              } else if (paymentStatus === 'rejected') {
                // Pago rechazado - marcar como past_due
                await markAsPastDue(subscription.id);
                console.log('⚠️ Payment rejected, subscription marked as past_due');
                
                // Registrar evento de fallo
                await supabaseAdmin.from('subscription_events').insert({
                  subscription_id: subscription.id,
                  store_id: storeId,
                  event_type: 'payment_failed',
                  event_data: {
                    mp_payment_id: authorizedPayment.payment?.id,
                    status_detail: authorizedPayment.payment?.status_detail,
                  },
                });
              }
            }
          }
        }
      } catch (paymentError) {
        console.error('❌ Error processing subscription payment:', paymentError);
      }
    }

    // ==========================================================================
    // PAGOS GENÉRICOS (puede ser primer pago de suscripción)
    // ==========================================================================
    if (event.type === 'payment') {
      console.log('💰 Processing generic payment:', event.data.id);
      
      try {
        const payment = await getMPPayment(event.data.id);
        
        // Solo procesar si está relacionado con una suscripción (tiene preapproval)
        if (payment.metadata?.preapproval_id) {
          const mpSubscription = await getSubscription(payment.metadata.preapproval_id);
          const externalRef = mpSubscription.external_reference;
          const storeIdMatch = externalRef?.match(/store_([^_]+)/);
          
          if (storeIdMatch) {
            const storeId = storeIdMatch[1];
            
            // Verificar duplicados
            const { data: existingPayment } = await supabaseAdmin
              .from('subscription_payments')
              .select('id')
              .eq('mp_payment_id', payment.id?.toString())
              .single();
            
            if (!existingPayment) {
              const { data: subscription } = await supabaseAdmin
                .from('subscriptions')
                .select('id, plan_id')
                .eq('store_id', storeId)
                .single();

              if (subscription) {
                await supabaseAdmin.from('subscription_payments').insert({
                  subscription_id: subscription.id,
                  store_id: storeId,
                  amount: payment.transaction_amount || 0,
                  currency: payment.currency_id || 'ARS',
                  status: payment.status === 'approved' ? 'approved' : 'pending',
                  mp_payment_id: payment.id?.toString(),
                  mp_status: payment.status,
                  mp_status_detail: payment.status_detail,
                  paid_at: payment.status === 'approved' ? new Date().toISOString() : null,
                });
                
                console.log('✅ Generic payment registered:', payment.id);
              }
            }
          }
        }
      } catch (paymentError) {
        console.error('❌ Error processing generic payment:', paymentError);
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

