// =============================================================================
// Gestión del Lifecycle de Suscripciones
// Expiraciones, upgrades, downgrades y recordatorios
// =============================================================================

import { supabase } from '../supabase';
import { PRICING, getPlan } from './plans';
import type { Subscription, PlanId, SubscriptionStatus } from '../../types/subscription';

/**
 * Resultado de la verificación de expiración
 */
interface ExpirationCheckResult {
  expired: number;
  reminded: number;
  errors: string[];
}

/**
 * Verifica y procesa las suscripciones expiradas
 * Esta función debe llamarse periódicamente (cron job)
 */
export async function processExpiredSubscriptions(): Promise<ExpirationCheckResult> {
  const result: ExpirationCheckResult = {
    expired: 0,
    reminded: 0,
    errors: [],
  };

  try {
    // 1. Buscar trials expirados que todavía están en estado 'trial'
    const { data: expiredTrials, error: trialError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('status', 'trial')
      .eq('plan_id', 'trial')
      .lt('trial_ends_at', new Date().toISOString());

    if (trialError) {
      result.errors.push(`Error fetching expired trials: ${trialError.message}`);
    } else if (expiredTrials && expiredTrials.length > 0) {
      for (const subscription of expiredTrials) {
        try {
          // Cambiar a plan free
          await downgradeToFree(subscription.id, 'trial_expired');
          result.expired++;
        } catch (err) {
          result.errors.push(`Error expiring trial ${subscription.id}: ${err}`);
        }
      }
    }

    // 2. Buscar suscripciones de pago con período vencido y en estado past_due
    // que ya pasaron el período de gracia
    const gracePeriodEnd = new Date();
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() - PRICING.GRACE_PERIOD_DAYS);

    const { data: expiredPaid, error: paidError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('status', 'past_due')
      .lt('current_period_end', gracePeriodEnd.toISOString());

    if (paidError) {
      result.errors.push(`Error fetching expired paid: ${paidError.message}`);
    } else if (expiredPaid && expiredPaid.length > 0) {
      for (const subscription of expiredPaid) {
        try {
          await downgradeToFree(subscription.id, 'payment_failed_expired');
          result.expired++;
        } catch (err) {
          result.errors.push(`Error expiring paid ${subscription.id}: ${err}`);
        }
      }
    }

    return result;
  } catch (error) {
    result.errors.push(`General error: ${error}`);
    return result;
  }
}

/**
 * Verifica y envía recordatorios de trial por vencer
 * Esta función debe llamarse diariamente
 */
export async function sendTrialReminders(): Promise<{ sent: number; errors: string[] }> {
  const result = { sent: 0, errors: [] as string[] };

  try {
    // Recordatorios para trials que vencen en 3 días, 1 día y el mismo día
    const reminderDays = [3, 1, 0];

    for (const days of reminderDays) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

      const { data: expiringTrials, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          stores (
            id,
            name,
            user_id,
            users:user_id (
              email
            )
          )
        `)
        .eq('status', 'trial')
        .eq('plan_id', 'trial')
        .gte('trial_ends_at', startOfDay.toISOString())
        .lte('trial_ends_at', endOfDay.toISOString());

      if (error) {
        result.errors.push(`Error fetching trials for ${days} days: ${error.message}`);
        continue;
      }

      if (expiringTrials && expiringTrials.length > 0) {
        for (const subscription of expiringTrials) {
          try {
            // Verificar si ya se envió recordatorio hoy
            const { data: existingReminder } = await supabase
              .from('subscription_events')
              .select('id')
              .eq('subscription_id', subscription.id)
              .eq('event_type', `reminder_${days}_days`)
              .gte('created_at', startOfDay.toISOString())
              .single();

            if (existingReminder) continue; // Ya se envió

            // Registrar el evento de recordatorio
            await supabase.from('subscription_events').insert({
              subscription_id: subscription.id,
              store_id: subscription.store_id,
              event_type: `reminder_${days}_days`,
              event_data: {
                trial_ends_at: subscription.trial_ends_at,
                days_remaining: days,
              },
            });

            // TODO: Aquí se integraría con el servicio de notificaciones
            // await sendReminderEmail(subscription.stores?.users?.email, days);
            // await sendReminderWhatsApp(subscription.stores?.phone, days);

            result.sent++;
          } catch (err) {
            result.errors.push(`Error sending reminder for ${subscription.id}: ${err}`);
          }
        }
      }
    }

    return result;
  } catch (error) {
    result.errors.push(`General error: ${error}`);
    return result;
  }
}

/**
 * Degrada una suscripción al plan free
 */
export async function downgradeToFree(
  subscriptionId: string,
  reason: string
): Promise<void> {
  const { data: subscription, error: fetchError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single();

  if (fetchError || !subscription) {
    throw new Error('Subscription not found');
  }

  // Actualizar la suscripción
  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      plan_id: 'free',
      status: 'active',
      trial_ends_at: null,
      current_period_start: null,
      current_period_end: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId);

  if (updateError) {
    throw updateError;
  }

  // Registrar evento
  await supabase.from('subscription_events').insert({
    subscription_id: subscriptionId,
    store_id: subscription.store_id,
    event_type: 'downgraded',
    event_data: {
      reason,
      previous_plan: subscription.plan_id,
      previous_status: subscription.status,
      new_plan: 'free',
    },
  });
}

/**
 * Actualiza una suscripción a un plan superior
 */
export async function upgradePlan(
  subscriptionId: string,
  newPlanId: PlanId
): Promise<void> {
  const { data: subscription, error: fetchError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single();

  if (fetchError || !subscription) {
    throw new Error('Subscription not found');
  }

  const now = new Date();
  const periodEnd = new Date();
  
  // Determinar duración del período
  if (newPlanId === 'premium_annual') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  // Actualizar la suscripción
  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      plan_id: newPlanId,
      status: 'active',
      trial_ends_at: null, // Limpiar trial si existía
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', subscriptionId);

  if (updateError) {
    throw updateError;
  }

  // Registrar evento
  await supabase.from('subscription_events').insert({
    subscription_id: subscriptionId,
    store_id: subscription.store_id,
    event_type: 'upgraded',
    event_data: {
      previous_plan: subscription.plan_id,
      new_plan: newPlanId,
    },
  });
}

/**
 * Marca una suscripción como past_due (pago fallido)
 */
export async function markAsPastDue(subscriptionId: string): Promise<void> {
  const { data: subscription, error: fetchError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single();

  if (fetchError || !subscription) {
    throw new Error('Subscription not found');
  }

  if (subscription.status === 'past_due') {
    return; // Ya está marcada
  }

  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId);

  if (updateError) {
    throw updateError;
  }

  // Registrar evento
  await supabase.from('subscription_events').insert({
    subscription_id: subscriptionId,
    store_id: subscription.store_id,
    event_type: 'payment_failed',
    event_data: {
      previous_status: subscription.status,
      grace_period_ends: new Date(
        Date.now() + PRICING.GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
      ).toISOString(),
    },
  });
}

/**
 * Obtiene métricas de suscripciones para el dashboard admin
 */
export async function getSubscriptionMetrics() {
  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select('*');

  if (error) {
    throw error;
  }

  const metrics = {
    total: subscriptions?.length || 0,
    byPlan: {
      free: 0,
      trial: 0,
      premium: 0,
      premium_annual: 0,
    },
    byStatus: {
      active: 0,
      trial: 0,
      past_due: 0,
      cancelled: 0,
      expired: 0,
      paused: 0,
    },
    trialsExpiringSoon: 0,
    recentConversions: 0,
    churnRate: 0,
    mrr: 0, // Monthly Recurring Revenue
  };

  if (!subscriptions) return metrics;

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  for (const sub of subscriptions) {
    // Por plan
    if (sub.plan_id in metrics.byPlan) {
      metrics.byPlan[sub.plan_id as keyof typeof metrics.byPlan]++;
    }

    // Por estado
    if (sub.status in metrics.byStatus) {
      metrics.byStatus[sub.status as keyof typeof metrics.byStatus]++;
    }

    // Trials por vencer
    if (
      sub.plan_id === 'trial' &&
      sub.trial_ends_at &&
      new Date(sub.trial_ends_at) <= threeDaysFromNow
    ) {
      metrics.trialsExpiringSoon++;
    }

    // MRR (Monthly Recurring Revenue)
    if (sub.status === 'active') {
      const plan = getPlan(sub.plan_id);
      metrics.mrr += plan.priceMonthly;
    }
  }

  // Conversiones recientes (trials -> premium en los últimos 30 días)
  const { data: conversions } = await supabase
    .from('subscription_events')
    .select('id')
    .eq('event_type', 'upgraded')
    .gte('created_at', thirtyDaysAgo.toISOString());

  metrics.recentConversions = conversions?.length || 0;

  // Churn rate (cancelaciones en los últimos 30 días / suscripciones activas)
  const { data: cancellations } = await supabase
    .from('subscription_events')
    .select('id')
    .eq('event_type', 'cancelled')
    .gte('created_at', thirtyDaysAgo.toISOString());

  const activeSubscriptions = metrics.byStatus.active + metrics.byStatus.trial;
  if (activeSubscriptions > 0) {
    metrics.churnRate = ((cancellations?.length || 0) / activeSubscriptions) * 100;
  }

  return metrics;
}

/**
 * Obtiene el historial de eventos de una suscripción
 */
export async function getSubscriptionHistory(subscriptionId: string) {
  const { data, error } = await supabase
    .from('subscription_events')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * Formatea un precio para mostrar en la UI
 */
export function formatPrice(amount: number, currency: string = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}






