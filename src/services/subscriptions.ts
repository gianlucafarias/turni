// =============================================================================
// Servicio de Suscripciones con Mercado Pago
// Gestiona la creación, cancelación y estado de suscripciones recurrentes
// =============================================================================

import { PRICING, PLANS, getPlan, type PlanId } from '../lib/subscription';

// Configuración de la API de Mercado Pago
const MP_API_URL = 'https://api.mercadopago.com';
const MP_ACCESS_TOKEN = import.meta.env.MERCADOPAGO_ACCESS_TOKEN;

// IDs de planes creados en Mercado Pago (se crean una vez y se reutilizan)
// Estos se guardarían en la DB o env vars después de crearlos
let mpPlanIds: Record<string, string> = {};

// =============================================================================
// TIPOS
// =============================================================================

export interface MPPreapprovalPlan {
  id: string;
  status: string;
  reason: string;
  auto_recurring: {
    frequency: number;
    frequency_type: 'days' | 'months';
    transaction_amount: number;
    currency_id: string;
    repetitions?: number;
    free_trial?: {
      frequency: number;
      frequency_type: 'days' | 'months';
    };
  };
  back_url: string;
  init_point?: string;
}

export interface MPPreapproval {
  id: string;
  payer_id: number;
  payer_email: string;
  back_url: string;
  collector_id: number;
  application_id: number;
  status: 'pending' | 'authorized' | 'paused' | 'cancelled';
  reason: string;
  external_reference: string;
  date_created: string;
  last_modified: string;
  init_point: string;
  preapproval_plan_id?: string;
  auto_recurring: {
    frequency: number;
    frequency_type: 'days' | 'months';
    transaction_amount: number;
    currency_id: string;
    start_date: string;
    end_date?: string;
  };
  summarized?: {
    quotas?: number;
    charged_quantity?: number;
    pending_charge_quantity?: number;
    charged_amount?: number;
    pending_charge_amount?: number;
    semaphore?: string;
    last_charged_date?: string;
    last_charged_amount?: number;
  };
}

export interface CreateSubscriptionParams {
  storeId: string;
  planId: PlanId;
  payerEmail: string;
  backUrl: string;
  externalReference?: string;
}

export interface WebhookEvent {
  id: string;
  live_mode: boolean;
  type: string;
  date_created: string;
  user_id: string;
  api_version: string;
  action: string;
  data: {
    id: string;
  };
}

// =============================================================================
// FUNCIONES DE API DE MERCADO PAGO
// =============================================================================

/**
 * Helper para hacer requests a la API de Mercado Pago
 */
async function mpFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${MP_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('Mercado Pago API Error:', error);
    throw new Error(error.message || `MP API Error: ${response.status}`);
  }

  return response.json();
}

// =============================================================================
// GESTIÓN DE PLANES (Preapproval Plans)
// =============================================================================

/**
 * Crea un plan de suscripción en Mercado Pago
 * Solo necesita ejecutarse una vez para crear los planes base
 */
export async function createMPPlan(planId: PlanId): Promise<MPPreapprovalPlan> {
  const plan = getPlan(planId);
  const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';
  
  // Determinar frecuencia según el plan
  const isAnnual = planId === 'premium_annual';
  
  const payload = {
    reason: `Tiendita ${plan.name}`,
    auto_recurring: {
      frequency: isAnnual ? 12 : 1,
      frequency_type: 'months' as const,
      transaction_amount: isAnnual ? plan.priceAnnual : plan.priceMonthly,
      currency_id: 'ARS',
      // Trial de 14 días para plan mensual
      ...(planId === 'premium' && {
        free_trial: {
          frequency: PRICING.TRIAL_DAYS,
          frequency_type: 'days' as const,
        },
      }),
    },
    back_url: `${siteUrl}/dashboard/subscription/callback`,
  };

  const mpPlan = await mpFetch<MPPreapprovalPlan>('/preapproval_plan', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  // Guardar el ID del plan para uso futuro
  mpPlanIds[planId] = mpPlan.id;
  
  return mpPlan;
}

/**
 * Obtiene o crea un plan de MP para el planId dado
 */
export async function getOrCreateMPPlan(planId: PlanId): Promise<string> {
  // Si ya tenemos el ID en memoria, devolverlo
  if (mpPlanIds[planId]) {
    return mpPlanIds[planId];
  }

  // En producción, estos IDs deberían venir de env vars o DB
  const envPlanId = import.meta.env[`MP_PLAN_ID_${planId.toUpperCase()}`];
  if (envPlanId) {
    mpPlanIds[planId] = envPlanId;
    return envPlanId;
  }

  // Si no existe, crear el plan
  const plan = await createMPPlan(planId);
  return plan.id;
}

// =============================================================================
// GESTIÓN DE SUSCRIPCIONES (Preapprovals)
// =============================================================================

/**
 * Crea una suscripción en Mercado Pago
 * Devuelve el init_point (URL de checkout) para redirigir al usuario
 * 
 * IMPORTANTE: Para checkout redirect (sin pedir tarjeta), NO usar preapproval_plan_id
 * Solo enviar auto_recurring con los datos del plan. MP genera init_point para redirect.
 */
export async function createSubscription(
  params: CreateSubscriptionParams & { finalPrice?: number }
): Promise<{ subscriptionId: string; initPoint: string }> {
  const { storeId, planId, payerEmail, backUrl, externalReference, finalPrice } = params;
  const plan = getPlan(planId);
  
  // Solo permitir planes de pago
  if (planId === 'free' || planId === 'trial') {
    throw new Error('No se puede crear suscripción para plan gratuito o trial');
  }

  const isAnnual = planId === 'premium_annual';
  const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';
  
  // Calcular fechas
  const startDate = new Date();
  const endDate = new Date();
  if (isAnnual) {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 12); // 12 meses de suscripción
  }

  // Usar precio final con descuento si se proporciona
  const transactionAmount = finalPrice !== undefined 
    ? finalPrice 
    : (isAnnual ? plan.priceAnnual : plan.priceMonthly)

  // Payload para checkout redirect - SIN preapproval_plan_id
  // Esto hace que MP nos devuelva init_point para redirect al checkout
  const payload = {
    reason: `Suscripción ${plan.name} - Tiendita`,
    external_reference: externalReference || `store_${storeId}_${Date.now()}`,
    payer_email: payerEmail,
    auto_recurring: {
      frequency: isAnnual ? 12 : 1,
      frequency_type: 'months' as const,
      transaction_amount: transactionAmount,
      currency_id: 'ARS',
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    },
    back_url: backUrl || `${siteUrl}/dashboard/subscription/callback`,
    status: 'pending',
  };

  console.log('Creating MP subscription with payload:', JSON.stringify(payload, null, 2));

  const subscription = await mpFetch<MPPreapproval>('/preapproval', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  console.log('MP subscription created:', subscription.id, 'init_point:', subscription.init_point);

  return {
    subscriptionId: subscription.id,
    initPoint: subscription.init_point,
  };
}

/**
 * Obtiene el estado de una suscripción
 */
export async function getSubscription(subscriptionId: string): Promise<MPPreapproval> {
  return mpFetch<MPPreapproval>(`/preapproval/${subscriptionId}`);
}

/**
 * Busca suscripciones por external_reference
 */
export async function searchSubscriptions(
  externalReference: string
): Promise<MPPreapproval[]> {
  const result = await mpFetch<{ results: MPPreapproval[] }>(
    `/preapproval/search?external_reference=${encodeURIComponent(externalReference)}`
  );
  return result.results;
}

/**
 * Cancela una suscripción
 */
export async function cancelSubscription(
  subscriptionId: string
): Promise<MPPreapproval> {
  return mpFetch<MPPreapproval>(`/preapproval/${subscriptionId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'cancelled' }),
  });
}

/**
 * Pausa una suscripción
 */
export async function pauseSubscription(
  subscriptionId: string
): Promise<MPPreapproval> {
  return mpFetch<MPPreapproval>(`/preapproval/${subscriptionId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'paused' }),
  });
}

/**
 * Reactiva una suscripción pausada
 */
export async function reactivateSubscription(
  subscriptionId: string
): Promise<MPPreapproval> {
  return mpFetch<MPPreapproval>(`/preapproval/${subscriptionId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'authorized' }),
  });
}

/**
 * Actualiza el monto de una suscripción (para cambio de plan)
 */
export async function updateSubscriptionAmount(
  subscriptionId: string,
  newAmount: number
): Promise<MPPreapproval> {
  return mpFetch<MPPreapproval>(`/preapproval/${subscriptionId}`, {
    method: 'PUT',
    body: JSON.stringify({
      auto_recurring: {
        transaction_amount: newAmount,
      },
    }),
  });
}

// =============================================================================
// MANEJO DE WEBHOOKS
// =============================================================================

/**
 * Mapea el estado de MP al estado interno de suscripción
 */
export function mapMPStatusToLocal(
  mpStatus: string
): 'active' | 'trial' | 'past_due' | 'cancelled' | 'expired' | 'paused' {
  switch (mpStatus) {
    case 'authorized':
      return 'active';
    case 'pending':
      return 'trial'; // O 'past_due' dependiendo del contexto
    case 'paused':
      return 'paused';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'expired';
  }
}

/**
 * Procesa un webhook de Mercado Pago
 * Esta función debe ser llamada desde el endpoint de webhook
 */
export async function processWebhook(event: WebhookEvent) {
  console.log('Processing MP Webhook:', event.type, event.action);
  
  switch (event.type) {
    case 'subscription_preapproval':
      // Cambio en el estado de la suscripción
      return handleSubscriptionUpdate(event.data.id);
    
    case 'subscription_authorized_payment':
      // Pago de suscripción procesado
      return handlePaymentProcessed(event.data.id);
    
    case 'payment':
      // Pago genérico (puede ser de suscripción)
      return handlePayment(event.data.id);
    
    default:
      console.log('Unhandled webhook type:', event.type);
      return null;
  }
}

/**
 * Maneja la actualización de una suscripción
 */
async function handleSubscriptionUpdate(preapprovalId: string) {
  try {
    const subscription = await getSubscription(preapprovalId);
    
    // Extraer store_id del external_reference (formato: store_{storeId}_{timestamp})
    const externalRef = subscription.external_reference;
    const storeIdMatch = externalRef?.match(/store_([^_]+)/);
    
    if (!storeIdMatch) {
      console.error('Could not extract store_id from external_reference:', externalRef);
      return null;
    }
    
    const storeId = storeIdMatch[1];
    const localStatus = mapMPStatusToLocal(subscription.status);
    
    // Aquí actualizarías la DB con el nuevo estado
    // Este código se ejecutará en el endpoint del webhook
    return {
      storeId,
      mpSubscriptionId: subscription.id,
      status: localStatus,
      mpStatus: subscription.status,
      payerEmail: subscription.payer_email,
    };
  } catch (error) {
    console.error('Error handling subscription update:', error);
    throw error;
  }
}

/**
 * Maneja el pago procesado de una suscripción
 */
async function handlePaymentProcessed(authorizedPaymentId: string) {
  try {
    // Obtener información del pago autorizado
    const paymentInfo = await mpFetch<{
      id: string;
      preapproval_id: string;
      payment: {
        id: string;
        status: string;
        status_detail: string;
      };
    }>(`/authorized_payments/${authorizedPaymentId}`);
    
    return {
      authorizedPaymentId,
      preapprovalId: paymentInfo.preapproval_id,
      paymentId: paymentInfo.payment.id,
      paymentStatus: paymentInfo.payment.status,
    };
  } catch (error) {
    console.error('Error handling authorized payment:', error);
    throw error;
  }
}

/**
 * Maneja un pago genérico
 */
async function handlePayment(paymentId: string) {
  try {
    const payment = await mpFetch<{
      id: string;
      status: string;
      status_detail: string;
      external_reference: string;
      transaction_amount: number;
    }>(`/v1/payments/${paymentId}`);
    
    return {
      paymentId: payment.id,
      status: payment.status,
      statusDetail: payment.status_detail,
      externalReference: payment.external_reference,
      amount: payment.transaction_amount,
    };
  } catch (error) {
    console.error('Error handling payment:', error);
    throw error;
  }
}

// =============================================================================
// UTILIDADES
// =============================================================================

/**
 * Calcula la fecha de fin del período actual
 */
export function calculatePeriodEnd(startDate: Date, isAnnual: boolean): Date {
  const endDate = new Date(startDate);
  if (isAnnual) {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }
  return endDate;
}

/**
 * Verifica si una suscripción está en período de gracia
 */
export function isInGracePeriod(
  periodEnd: Date,
  gracePeriodDays: number = PRICING.GRACE_PERIOD_DAYS
): boolean {
  const now = new Date();
  const graceEnd = new Date(periodEnd);
  graceEnd.setDate(graceEnd.getDate() + gracePeriodDays);
  
  return now > periodEnd && now <= graceEnd;
}

/**
 * Formatea un precio para mostrar
 */
export function formatPrice(amount: number, currency: string = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
  }).format(amount);
}

