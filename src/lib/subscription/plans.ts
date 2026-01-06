// =============================================================================
// Definición de planes de suscripción
// =============================================================================

import type { Plan, PlanId, PlanLimits, PremiumFeature } from '../../types/subscription';
import { getPricing, DEFAULT_PRICING, type PricingConfig } from './pricing';

/**
 * Configuración de precios en ARS (valores por defecto)
 * NOTA: Usar getPricing() para obtener valores dinámicos desde la DB
 * Estos valores se usan como fallback y para compatibilidad con código existente
 */
export const PRICING = {
  // Plan Premium mensual
  PREMIUM_MONTHLY: DEFAULT_PRICING.premium_monthly,
  
  // Plan Premium anual (2 meses gratis = 16% descuento)
  PREMIUM_ANNUAL: DEFAULT_PRICING.premium_annual,
  
  // Días de trial (7 días de prueba con todas las funciones premium)
  TRIAL_DAYS: DEFAULT_PRICING.trial_days ?? 7,
  
  // Límite de turnos por día en plan free
  FREE_DAILY_APPOINTMENTS: DEFAULT_PRICING.free_daily_appointments ?? 5,
  
  // Grace period después de fallo de pago (días)
  GRACE_PERIOD_DAYS: DEFAULT_PRICING.grace_period_days ?? 3,
} as const;

/**
 * Límites del plan FREE
 */
export const FREE_LIMITS: PlanLimits = {
  maxProducts: 5,
  maxServices: 1,
  maxAppointmentsPerMonth: -1, // Ilimitado por mes
  maxAppointmentsPerDay: PRICING.FREE_DAILY_APPOINTMENTS, // 5 turnos por día
  maxClients: 0, // Sin acceso a clientes
  features: [], // Sin features premium
};

/**
 * Límites del plan TRIAL (igual que premium)
 */
export const TRIAL_LIMITS: PlanLimits = {
  maxProducts: -1, // Ilimitado
  maxServices: -1,
  maxAppointmentsPerMonth: -1,
  maxAppointmentsPerDay: -1, // Ilimitado
  maxClients: -1,
  features: [
    'clients_management',
    'notifications',
    'multiple_services',
    'unlimited_products',
    'advanced_stats',
    'priority_support',
    'custom_branding',
    'export_data',
    'google_calendar',
    'multiple_branches',
  ],
};

/**
 * Límites del plan PREMIUM
 */
export const PREMIUM_LIMITS: PlanLimits = {
  maxProducts: -1,
  maxServices: -1,
  maxAppointmentsPerMonth: -1,
  maxAppointmentsPerDay: -1, // Ilimitado
  maxClients: -1,
  features: [
    'clients_management',
    'notifications',
    'multiple_services',
    'unlimited_products',
    'advanced_stats',
    'priority_support',
    'custom_branding',
    'export_data',
    'google_calendar',
    'multiple_branches',
  ],
};

/**
 * Todos los planes disponibles
 */
export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Gratis',
    description: 'Perfecto para empezar y probar la plataforma',
    priceMonthly: 0,
    limits: FREE_LIMITS,
  },
  
  trial: {
    id: 'trial',
    name: 'Prueba Premium',
    description: 'Acceso completo por tiempo limitado',
    priceMonthly: 0,
    trialDays: PRICING.TRIAL_DAYS,
    limits: TRIAL_LIMITS,
    badge: '7 días gratis',
  },
  
  premium: {
    id: 'premium',
    name: 'Premium',
    description: 'Todo lo que necesitás para tu negocio',
    priceMonthly: PRICING.PREMIUM_MONTHLY,
    limits: PREMIUM_LIMITS,
    highlighted: true,
    badge: 'Más popular',
  },
  
  premium_annual: {
    id: 'premium_annual',
    name: 'Premium Anual',
    description: 'Ahorrá 2 meses pagando anual',
    priceMonthly: Math.round(PRICING.PREMIUM_ANNUAL / 12),
    priceAnnual: PRICING.PREMIUM_ANNUAL,
    limits: PREMIUM_LIMITS,
    badge: '2 meses gratis',
  },
};

/**
 * Obtiene un plan por su ID
 */
export function getPlan(planId: PlanId): Plan {
  return PLANS[planId] || PLANS.free;
}

/**
 * Obtiene los límites de un plan
 */
export function getPlanLimits(planId: PlanId): PlanLimits {
  return getPlan(planId).limits;
}

/**
 * Verifica si un plan tiene acceso a una feature
 */
export function planHasFeature(planId: PlanId, feature: PremiumFeature): boolean {
  const plan = getPlan(planId);
  return plan.limits.features.includes(feature);
}

/**
 * Verifica si un plan es de pago
 */
export function isPaidPlan(planId: PlanId): boolean {
  return planId === 'premium' || planId === 'premium_annual';
}

/**
 * Verifica si un plan tiene acceso premium (trial o pago)
 */
export function hasPremiumAccess(planId: PlanId): boolean {
  return planId === 'trial' || isPaidPlan(planId);
}

/**
 * Lista de features con sus descripciones para la UI
 */
export const FEATURE_DESCRIPTIONS: Record<PremiumFeature, { name: string; description: string }> = {
  clients_management: {
    name: 'Gestión de Clientes',
    description: 'Guardá automáticamente los datos de tus clientes y accedé a su historial',
  },
  notifications: {
    name: 'Notificaciones Automáticas',
    description: 'Enviá recordatorios por WhatsApp y email a tus clientes',
  },
  multiple_services: {
    name: 'Servicios Ilimitados',
    description: 'Agregá todos los servicios que ofrezcas',
  },
  unlimited_products: {
    name: 'Productos Ilimitados',
    description: 'Publicá todos los productos que quieras',
  },
  advanced_stats: {
    name: 'Estadísticas Avanzadas',
    description: 'Métricas detalladas de tu negocio',
  },
  priority_support: {
    name: 'Soporte Prioritario',
    description: 'Atención preferencial por WhatsApp',
  },
  custom_branding: {
    name: 'Personalización Avanzada',
    description: 'Personalizá colores, logo y más',
  },
  export_data: {
    name: 'Exportar Datos',
    description: 'Descargá tus datos en Excel o CSV',
  },
  google_calendar: {
    name: 'Google Calendar',
    description: 'Sincronizá tus turnos automáticamente con Google Calendar',
  },
  multiple_branches: {
    name: 'Múltiples Sucursales',
    description: 'Gestioná múltiples ubicaciones para tu negocio',
  },
};

/**
 * Comparativa de planes para la página de pricing
 */
export const PLAN_COMPARISON = [
  {
    category: 'Productos',
    features: [
      { name: 'Cantidad de productos', free: '5', premium: 'Ilimitados' },
      { name: 'Fotos por producto', free: '3', premium: 'Ilimitadas' },
      { name: 'Categorías', free: '✓', premium: '✓' },
    ],
  },
  {
    category: 'Turnos',
    features: [
      { name: 'Cantidad de servicios', free: '1', premium: 'Ilimitados' },
      { name: 'Turnos por día', free: '5', premium: 'Ilimitados' },
      { name: 'Gestión de clientes', free: '✗', premium: '✓' },
      { name: 'Notificaciones WhatsApp', free: '✗', premium: '✓' },
      { name: 'Sincronización Google Calendar', free: '✗', premium: '✓' },
    ],
  },
  {
    category: 'Extras',
    features: [
      { name: 'Estadísticas avanzadas', free: '✗', premium: '✓' },
      { name: 'Exportar datos', free: '✗', premium: '✓' },
      { name: 'Soporte prioritario', free: '✗', premium: '✓' },
      { name: 'Personalización avanzada', free: '✗', premium: '✓' },
    ],
  },
];

/**
 * Obtiene los planes con precios dinámicos desde la base de datos
 * Esta función es async y debe usarse en contextos server-side
 */
export async function getPlansWithDynamicPricing(): Promise<{
  plans: Record<PlanId, Plan>;
  pricing: PricingConfig;
}> {
  const pricing = await getPricing();
  
  const dynamicPlans: Record<PlanId, Plan> = {
    free: {
      id: 'free',
      name: 'Gratis',
      description: 'Perfecto para empezar y probar la plataforma',
      priceMonthly: 0,
      limits: FREE_LIMITS,
    },
    
    trial: {
      id: 'trial',
      name: 'Prueba Premium',
      description: 'Acceso completo por tiempo limitado',
      priceMonthly: 0,
      trialDays: pricing.trial_days ?? PRICING.TRIAL_DAYS,
      limits: TRIAL_LIMITS,
      badge: `${pricing.trial_days ?? PRICING.TRIAL_DAYS} días gratis`,
    },
    
    premium: {
      id: 'premium',
      name: 'Premium',
      description: 'Todo lo que necesitás para tu negocio',
      priceMonthly: pricing.premium_monthly,
      limits: PREMIUM_LIMITS,
      highlighted: true,
      badge: 'Más popular',
    },
    
    premium_annual: {
      id: 'premium_annual',
      name: 'Premium Anual',
      description: 'Ahorrá 2 meses pagando anual',
      priceMonthly: Math.round(pricing.premium_annual / 12),
      priceAnnual: pricing.premium_annual,
      limits: PREMIUM_LIMITS,
      badge: '2 meses gratis',
    },
  };

  return { plans: dynamicPlans, pricing };
}

