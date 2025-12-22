// =============================================================================
// Tipos para el sistema de suscripciones
// =============================================================================

/**
 * Identificadores de planes disponibles
 */
export type PlanId = 'free' | 'trial' | 'premium' | 'premium_annual';

/**
 * Estado de la suscripción
 */
export type SubscriptionStatus = 
  | 'active'      // Suscripción activa y pagada
  | 'trial'       // En período de prueba
  | 'past_due'    // Pago pendiente/vencido
  | 'cancelled'   // Cancelada por el usuario
  | 'expired'     // Expiró el trial o la suscripción
  | 'paused';     // Pausada temporalmente

/**
 * Características premium que pueden estar bloqueadas
 */
export type PremiumFeature = 
  | 'clients_management'     // Gestión de clientes en turnos
  | 'notifications'          // Notificaciones automáticas (WhatsApp/email)
  | 'multiple_services'      // Más de 1 servicio
  | 'unlimited_products'     // Más de X productos
  | 'advanced_stats'         // Estadísticas avanzadas
  | 'priority_support'       // Soporte prioritario
  | 'custom_branding'        // Personalización avanzada
  | 'export_data';           // Exportar datos

/**
 * Límites por plan
 */
export interface PlanLimits {
  maxProducts: number;          // -1 = ilimitado
  maxServices: number;          // -1 = ilimitado
  maxAppointmentsPerMonth: number; // -1 = ilimitado
  maxClients: number;           // -1 = ilimitado
  features: PremiumFeature[];   // Features habilitadas
}

/**
 * Definición de un plan
 */
export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  priceMonthly: number;        // Precio en ARS (0 para free/trial)
  priceAnnual?: number;        // Precio anual con descuento
  trialDays?: number;          // Días de prueba (solo para trial)
  limits: PlanLimits;
  highlighted?: boolean;       // Destacado en la UI
  badge?: string;              // Badge especial ("Popular", "Mejor valor", etc.)
}

/**
 * Suscripción de una tienda
 */
export interface Subscription {
  id: string;
  store_id: string;
  plan_id: PlanId;
  status: SubscriptionStatus;
  
  // Fechas importantes
  created_at: string;
  updated_at: string;
  trial_ends_at?: string;      // Cuándo termina el trial
  current_period_start?: string;
  current_period_end?: string;
  cancelled_at?: string;
  
  // Integración con Mercado Pago
  mp_subscription_id?: string;  // ID de suscripción en MP
  mp_preapproval_id?: string;   // ID de preapproval en MP
  mp_payer_id?: string;         // ID del pagador en MP
  
  // Metadata
  cancel_reason?: string;
  metadata?: Record<string, any>;
}

/**
 * Historial de pagos
 */
export interface SubscriptionPayment {
  id: string;
  subscription_id: string;
  store_id: string;
  
  amount: number;
  currency: string;
  status: 'pending' | 'approved' | 'rejected' | 'refunded';
  
  // Mercado Pago
  mp_payment_id?: string;
  mp_status?: string;
  mp_status_detail?: string;
  
  paid_at?: string;
  created_at: string;
}

/**
 * Resultado de verificación de límite
 */
export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  upgradeRequired: boolean;
  message?: string;
}

/**
 * Resultado de verificación de feature
 */
export interface FeatureCheckResult {
  allowed: boolean;
  feature: PremiumFeature;
  upgradeRequired: boolean;
  message?: string;
}

/**
 * Contexto de suscripción para la UI
 */
export interface SubscriptionContext {
  subscription: Subscription | null;
  plan: Plan;
  isTrialActive: boolean;
  trialDaysRemaining: number;
  isPremium: boolean;
  canAccessFeature: (feature: PremiumFeature) => boolean;
  checkLimit: (type: 'products' | 'services' | 'clients') => LimitCheckResult;
}

/**
 * Payload para crear suscripción con MP
 */
export interface CreateSubscriptionPayload {
  store_id: string;
  plan_id: PlanId;
  payer_email: string;
  return_url: string;
}

/**
 * Respuesta de webhook de MP
 */
export interface MPWebhookPayload {
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













