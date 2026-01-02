// =============================================================================
// Helpers para verificar límites y acceso a features premium
// =============================================================================

import type { 
  PlanId, 
  PremiumFeature, 
  Subscription, 
  LimitCheckResult, 
  FeatureCheckResult,
  SubscriptionStatus 
} from '../../types/subscription';
import { getPlan, getPlanLimits, planHasFeature, hasPremiumAccess } from './plans';

/**
 * Calcula el plan efectivo basado en la suscripción
 * Si el trial expiró, devuelve 'free'
 */
export function getEffectivePlanId(subscription: Subscription | null): PlanId {
  if (!subscription) return 'free';
  
  // Si está en trial, verificar si no expiró
  if (subscription.plan_id === 'trial' && subscription.trial_ends_at) {
    const trialEnd = new Date(subscription.trial_ends_at);
    if (trialEnd < new Date()) {
      return 'free'; // Trial expirado
    }
  }
  
  // Verificar estado de la suscripción
  const activeStatuses: SubscriptionStatus[] = ['active', 'trial'];
  if (!activeStatuses.includes(subscription.status)) {
    return 'free';
  }
  
  return subscription.plan_id;
}

/**
 * Verifica si el trial está activo
 */
export function isTrialActive(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  if (subscription.plan_id !== 'trial') return false;
  if (subscription.status !== 'trial') return false;
  
  if (subscription.trial_ends_at) {
    const trialEnd = new Date(subscription.trial_ends_at);
    return trialEnd > new Date();
  }
  
  return false;
}

/**
 * Calcula los días restantes del trial
 */
export function getTrialDaysRemaining(subscription: Subscription | null): number {
  if (!subscription || !subscription.trial_ends_at) return 0;
  if (subscription.plan_id !== 'trial') return 0;
  
  const trialEnd = new Date(subscription.trial_ends_at);
  const now = new Date();
  const diffMs = trialEnd.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

/**
 * Verifica si la tienda tiene acceso premium (trial activo o plan pago)
 */
export function hasActivePremium(subscription: Subscription | null): boolean {
  const effectivePlan = getEffectivePlanId(subscription);
  return hasPremiumAccess(effectivePlan);
}

/**
 * Verifica si la tienda puede acceder a una feature
 */
export function canAccessFeature(
  subscription: Subscription | null, 
  feature: PremiumFeature
): FeatureCheckResult {
  const effectivePlan = getEffectivePlanId(subscription);
  const allowed = planHasFeature(effectivePlan, feature);
  
  return {
    allowed,
    feature,
    upgradeRequired: !allowed,
    message: allowed 
      ? undefined 
      : `Esta función requiere el plan Premium`,
  };
}

/**
 * Verifica el límite de productos
 */
export function checkProductsLimit(
  subscription: Subscription | null,
  currentCount: number
): LimitCheckResult {
  const effectivePlan = getEffectivePlanId(subscription);
  const limits = getPlanLimits(effectivePlan);
  const limit = limits.maxProducts;
  
  // -1 significa ilimitado
  if (limit === -1) {
    return {
      allowed: true,
      current: currentCount,
      limit: -1,
      upgradeRequired: false,
    };
  }
  
  const allowed = currentCount < limit;
  
  return {
    allowed,
    current: currentCount,
    limit,
    upgradeRequired: !allowed,
    message: allowed 
      ? undefined 
      : `Has alcanzado el límite de ${limit} productos. Pasate a Premium para productos ilimitados.`,
  };
}

/**
 * Verifica el límite de servicios
 */
export function checkServicesLimit(
  subscription: Subscription | null,
  currentCount: number
): LimitCheckResult {
  const effectivePlan = getEffectivePlanId(subscription);
  const limits = getPlanLimits(effectivePlan);
  const limit = limits.maxServices;
  
  if (limit === -1) {
    return {
      allowed: true,
      current: currentCount,
      limit: -1,
      upgradeRequired: false,
    };
  }
  
  const allowed = currentCount < limit;
  
  return {
    allowed,
    current: currentCount,
    limit,
    upgradeRequired: !allowed,
    message: allowed 
      ? undefined 
      : `El plan Gratis permite solo ${limit} servicio. Pasate a Premium para servicios ilimitados.`,
  };
}

/**
 * Verifica el límite de clientes
 */
export function checkClientsLimit(
  subscription: Subscription | null,
  currentCount: number
): LimitCheckResult {
  const effectivePlan = getEffectivePlanId(subscription);
  const limits = getPlanLimits(effectivePlan);
  const limit = limits.maxClients;
  
  if (limit === -1) {
    return {
      allowed: true,
      current: currentCount,
      limit: -1,
      upgradeRequired: false,
    };
  }
  
  // Si el límite es 0, no tiene acceso a la feature
  if (limit === 0) {
    return {
      allowed: false,
      current: currentCount,
      limit: 0,
      upgradeRequired: true,
      message: 'La gestión de clientes está disponible en el plan Premium.',
    };
  }
  
  const allowed = currentCount < limit;
  
  return {
    allowed,
    current: currentCount,
    limit,
    upgradeRequired: !allowed,
    message: allowed 
      ? undefined 
      : `Has alcanzado el límite de ${limit} clientes.`,
  };
}

/**
 * Verifica el límite de turnos por mes
 */
export function checkAppointmentsLimit(
  subscription: Subscription | null,
  currentMonthCount: number
): LimitCheckResult {
  const effectivePlan = getEffectivePlanId(subscription);
  const limits = getPlanLimits(effectivePlan);
  const limit = limits.maxAppointmentsPerMonth;
  
  if (limit === -1) {
    return {
      allowed: true,
      current: currentMonthCount,
      limit: -1,
      upgradeRequired: false,
    };
  }
  
  const allowed = currentMonthCount < limit;
  
  return {
    allowed,
    current: currentMonthCount,
    limit,
    upgradeRequired: !allowed,
    message: allowed 
      ? undefined 
      : `Has alcanzado el límite de ${limit} turnos este mes. Pasate a Premium para turnos ilimitados.`,
  };
}

/**
 * Verifica el límite de turnos por día
 */
export function checkDailyAppointmentsLimit(
  subscription: Subscription | null,
  currentDayCount: number
): LimitCheckResult {
  const effectivePlan = getEffectivePlanId(subscription);
  const limits = getPlanLimits(effectivePlan);
  const limit = limits.maxAppointmentsPerDay;
  
  if (limit === -1) {
    return {
      allowed: true,
      current: currentDayCount,
      limit: -1,
      upgradeRequired: false,
    };
  }
  
  const allowed = currentDayCount < limit;
  
  return {
    allowed,
    current: currentDayCount,
    limit,
    upgradeRequired: !allowed,
    message: allowed 
      ? undefined 
      : `Se alcanzó el límite de ${limit} turnos para este día. Pasate a Premium para turnos ilimitados.`,
  };
}

/**
 * Calcula cuántos turnos quedan disponibles para un día específico
 */
export function getRemainingDailySlots(
  subscription: Subscription | null,
  currentDayCount: number
): { remaining: number; isUnlimited: boolean } {
  const effectivePlan = getEffectivePlanId(subscription);
  const limits = getPlanLimits(effectivePlan);
  const limit = limits.maxAppointmentsPerDay;
  
  if (limit === -1) {
    return { remaining: -1, isUnlimited: true };
  }
  
  return { 
    remaining: Math.max(0, limit - currentDayCount), 
    isUnlimited: false 
  };
}

/**
 * Helper genérico para verificar cualquier límite
 */
export function checkLimit(
  subscription: Subscription | null,
  type: 'products' | 'services' | 'clients' | 'appointments' | 'daily_appointments',
  currentCount: number
): LimitCheckResult {
  switch (type) {
    case 'products':
      return checkProductsLimit(subscription, currentCount);
    case 'services':
      return checkServicesLimit(subscription, currentCount);
    case 'clients':
      return checkClientsLimit(subscription, currentCount);
    case 'appointments':
      return checkAppointmentsLimit(subscription, currentCount);
    case 'daily_appointments':
      return checkDailyAppointmentsLimit(subscription, currentCount);
    default:
      return {
        allowed: true,
        current: currentCount,
        limit: -1,
        upgradeRequired: false,
      };
  }
}

/**
 * Obtiene un resumen del estado de la suscripción para mostrar en la UI
 */
export function getSubscriptionSummary(subscription: Subscription | null) {
  const effectivePlan = getEffectivePlanId(subscription);
  const plan = getPlan(effectivePlan);
  const trialActive = isTrialActive(subscription);
  const trialDays = getTrialDaysRemaining(subscription);
  const isPremium = hasActivePremium(subscription);
  
  return {
    planId: effectivePlan,
    planName: plan.name,
    isPremium,
    isTrialActive: trialActive,
    trialDaysRemaining: trialDays,
    status: subscription?.status || 'free',
    limits: plan.limits,
  };
}

/**
 * Mensajes de paywall según el contexto
 */
export const PAYWALL_MESSAGES = {
  clients_management: {
    title: 'Gestión de Clientes',
    description: 'Guardá automáticamente los datos de tus clientes, accedé a su historial de turnos y notas personalizadas.',
    cta: 'Desbloquear con Premium',
  },
  notifications: {
    title: 'Notificaciones Automáticas',
    description: 'Enviá recordatorios automáticos por WhatsApp y email. Reducí los turnos perdidos hasta un 70%.',
    cta: 'Activar Notificaciones',
  },
  multiple_services: {
    title: 'Servicios Ilimitados',
    description: 'Agregá todos los servicios que ofrezcas: cortes, coloración, tratamientos, y más.',
    cta: 'Agregar Más Servicios',
  },
  unlimited_products: {
    title: 'Productos Ilimitados',
    description: 'Publicá todo tu catálogo sin restricciones de cantidad.',
    cta: 'Publicar Sin Límites',
  },
  advanced_stats: {
    title: 'Estadísticas Avanzadas',
    description: 'Conocé a fondo tu negocio: ingresos, clientes frecuentes, horarios más demandados.',
    cta: 'Ver Estadísticas',
  },
  priority_support: {
    title: 'Soporte Prioritario',
    description: 'Atención preferencial por WhatsApp con respuesta en menos de 2 horas.',
    cta: 'Obtener Soporte VIP',
  },
  custom_branding: {
    title: 'Personalización Avanzada',
    description: 'Personalizá tu tienda con colores, logo y dominio propio.',
    cta: 'Personalizar Tienda',
  },
  export_data: {
    title: 'Exportar Datos',
    description: 'Descargá tus datos de clientes, turnos y ventas en Excel o CSV.',
    cta: 'Exportar Datos',
  },
  google_calendar: {
    title: 'Google Calendar',
    description: 'Sincronizá automáticamente tus turnos con Google Calendar. Nunca más te pierdas una cita.',
    cta: 'Activar Google Calendar',
  },
} as const;













