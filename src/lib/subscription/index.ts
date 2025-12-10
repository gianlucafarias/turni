// =============================================================================
// Exportaciones del módulo de suscripciones
// =============================================================================

// Planes y configuración
export {
  PRICING,
  FREE_LIMITS,
  TRIAL_LIMITS,
  PREMIUM_LIMITS,
  PLANS,
  getPlan,
  getPlanLimits,
  planHasFeature,
  isPaidPlan,
  hasPremiumAccess,
  FEATURE_DESCRIPTIONS,
  PLAN_COMPARISON,
} from './plans';

// Verificación de límites
export {
  getEffectivePlanId,
  isTrialActive,
  getTrialDaysRemaining,
  hasActivePremium,
  canAccessFeature,
  checkProductsLimit,
  checkServicesLimit,
  checkClientsLimit,
  checkAppointmentsLimit,
  checkLimit,
  getSubscriptionSummary,
  PAYWALL_MESSAGES,
} from './limits';

// Lifecycle y métricas
export {
  processExpiredSubscriptions,
  sendTrialReminders,
  downgradeToFree,
  upgradePlan,
  markAsPastDue,
  getSubscriptionMetrics,
  getSubscriptionHistory,
  formatPrice,
} from './lifecycle';

// Re-exportar tipos
export type {
  PlanId,
  SubscriptionStatus,
  PremiumFeature,
  PlanLimits,
  Plan,
  Subscription,
  SubscriptionPayment,
  LimitCheckResult,
  FeatureCheckResult,
  SubscriptionContext,
  CreateSubscriptionPayload,
  MPWebhookPayload,
} from '../../types/subscription';

