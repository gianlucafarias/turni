// =============================================================================
// Configuración de notificaciones WhatsApp + Email
// Costos basados en tarifas oficiales de Meta y proveedores de email
// =============================================================================

/**
 * Tarifas de WhatsApp Business API para Argentina (LATAM)
 * Modelo: Por mensaje (desde julio 2025)
 * Fuente: https://developers.facebook.com/docs/whatsapp/pricing
 * 
 * NOTA: Actualizar periódicamente según rate card oficial de Meta
 */
export const WHATSAPP_PRICING = {
  // Región/país base
  region: 'argentina',
  currency: 'USD',
  
  // Tarifas por categoría de mensaje (USD por mensaje)
  // Valores referenciales LATAM 2025 - ajustar con CSV oficial
  rates: {
    // Marketing: promociones, lanzamientos, ofertas
    marketing: 0.0250,
    
    // Utility: confirmaciones, recordatorios, actualizaciones de pedido
    // Gratis dentro de ventana de 24h de servicio
    utility: 0.0080,
    
    // Authentication: OTP, verificación
    authentication: 0.0085,
    
    // Service: mensajes dentro de conversación iniciada por usuario (GRATIS)
    service: 0,
  },
  
  // Tiers de volumen (utility/authentication tienen descuentos por volumen)
  volumeTiers: {
    utility: [
      { from: 0, to: 250000, discount: 0 },
      { from: 250001, to: 1000000, discount: 0.15 },
      { from: 1000001, to: Infinity, discount: 0.25 },
    ],
    authentication: [
      { from: 0, to: 250000, discount: 0 },
      { from: 250001, to: 1000000, discount: 0.15 },
      { from: 1000001, to: Infinity, discount: 0.25 },
    ],
  },
  
  // Límites de rate
  rateLimits: {
    // Mensajes por segundo (tier inicial, aumenta con quality rating)
    messagesPerSecond: 80,
    // Máximo de destinatarios por día (tier 1)
    recipientsPerDay: 1000,
  },
} as const;

/**
 * Tarifas de email (Amazon SES baseline)
 * Fuente: https://aws.amazon.com/ses/pricing/
 */
export const EMAIL_PRICING = {
  provider: 'ses', // ses | sendgrid | resend | mailgun
  currency: 'USD',
  
  // Costo por 1000 emails enviados
  perThousandEmails: 0.10,
  
  // Costo por GB de datos salientes (attachments, etc.)
  dataOutPerGB: 0.12,
  
  // Free tier (si se usa desde EC2)
  freeTierMonthly: 62000,
  
  // Límites
  limits: {
    maxRecipientsPerCall: 50,
    maxMessageSizeKB: 10240, // 10MB
  },
} as const;

/**
 * Configuración de plantillas de WhatsApp
 * Estas plantillas deben ser creadas y aprobadas en Meta Business Suite
 */
export const WHATSAPP_TEMPLATES = {
  // Recordatorio del día del turno
  appointmentReminder: {
    name: 'appointment_reminder',
    category: 'utility' as const,
    language: 'es_AR',
    // Variables: {{1}}=nombre, {{2}}=servicio, {{3}}=fecha, {{4}}=hora, {{5}}=negocio
    components: [
      {
        type: 'body',
        text: 'Hola {{1}}, te recordamos tu turno de {{2}} para hoy {{3}} a las {{4}} en {{5}}. ¡Te esperamos!',
      },
    ],
  },
  
  // Confirmación de turno
  appointmentConfirmed: {
    name: 'appointment_confirmed',
    category: 'utility' as const,
    language: 'es_AR',
    components: [
      {
        type: 'body',
        text: 'Hola {{1}}, tu turno de {{2}} fue confirmado para el {{3}} a las {{4}} en {{5}}. Gracias por elegirnos.',
      },
    ],
  },
  
  // Cambio de estado de turno
  appointmentStatusChange: {
    name: 'appointment_status_change',
    category: 'utility' as const,
    language: 'es_AR',
    components: [
      {
        type: 'body',
        text: 'Hola {{1}}, tu turno de {{2}} del {{3}} cambió a estado: {{4}}. Si tenés dudas, contactanos.',
      },
    ],
  },
  
  // Recordatorio de inactividad (marketing)
  inactivityReminder: {
    name: 'inactivity_reminder',
    category: 'marketing' as const,
    language: 'es_AR',
    components: [
      {
        type: 'body',
        text: 'Hola {{1}}, hace tiempo que no te vemos por {{2}}. ¿Te gustaría agendar un turno? Te esperamos.',
      },
    ],
  },
  
  // Campaña masiva (marketing)
  massiveCampaign: {
    name: 'massive_campaign',
    category: 'marketing' as const,
    language: 'es_AR',
    components: [
      {
        type: 'body',
        text: '{{1}}', // Mensaje personalizable
      },
    ],
  },
} as const;

/**
 * Plantillas de email
 */
export const EMAIL_TEMPLATES = {
  appointmentReminder: {
    subject: 'Recordatorio: Tu turno es hoy en {{storeName}}',
    template: 'appointment-reminder',
  },
  appointmentConfirmed: {
    subject: 'Turno confirmado en {{storeName}}',
    template: 'appointment-confirmed',
  },
  appointmentCancelled: {
    subject: 'Tu turno fue cancelado',
    template: 'appointment-cancelled',
  },
  inactivityReminder: {
    subject: 'Te extrañamos en {{storeName}}',
    template: 'inactivity-reminder',
  },
} as const;

/**
 * Configuración general de notificaciones
 */
export const NOTIFICATIONS_CONFIG = {
  // Hora del día para enviar recordatorios (UTC)
  reminderHourUTC: 10, // 7:00 AM Argentina
  
  // Días de anticipación para recordatorio
  reminderDaysBefore: 1,
  
  // Horas antes del turno para recordatorio del día
  reminderHoursBefore: 3,
  
  // Días de inactividad para considerar cliente "dormido"
  inactivityDays: 30,
  
  // Máximo de reintentos por mensaje fallido
  maxRetries: 3,
  
  // Delay entre reintentos (ms)
  retryDelayMs: 5000,
  
  // Canales disponibles
  channels: ['whatsapp', 'email'] as const,
  
  // Canal preferido (fallback al otro si falla)
  preferredChannel: 'whatsapp' as const,
  
  // Ventana de servicio de WhatsApp (horas)
  serviceWindowHours: 24,
} as const;

/**
 * Variables de entorno requeridas
 */
export const REQUIRED_ENV_VARS = {
  whatsapp: [
    'WHATSAPP_API_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'WHATSAPP_BUSINESS_ACCOUNT_ID',
    'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
  ],
  email: [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'EMAIL_FROM_ADDRESS',
  ],
} as const;

/**
 * Estima el costo mensual de notificaciones
 */
export function estimateMonthlyNotificationCost(params: {
  whatsappMessages: {
    marketing: number;
    utility: number;
    authentication: number;
  };
  emailCount: number;
}): {
  whatsapp: number;
  email: number;
  total: number;
  breakdown: Record<string, number>;
} {
  const { whatsappMessages, emailCount } = params;
  
  // Calcular costos de WhatsApp
  const waMarketing = whatsappMessages.marketing * WHATSAPP_PRICING.rates.marketing;
  const waUtility = whatsappMessages.utility * WHATSAPP_PRICING.rates.utility;
  const waAuth = whatsappMessages.authentication * WHATSAPP_PRICING.rates.authentication;
  const whatsappTotal = waMarketing + waUtility + waAuth;
  
  // Calcular costos de email (descontando free tier)
  const billableEmails = Math.max(0, emailCount - EMAIL_PRICING.freeTierMonthly);
  const emailTotal = (billableEmails / 1000) * EMAIL_PRICING.perThousandEmails;
  
  return {
    whatsapp: Number(whatsappTotal.toFixed(4)),
    email: Number(emailTotal.toFixed(4)),
    total: Number((whatsappTotal + emailTotal).toFixed(4)),
    breakdown: {
      whatsapp_marketing: Number(waMarketing.toFixed(4)),
      whatsapp_utility: Number(waUtility.toFixed(4)),
      whatsapp_authentication: Number(waAuth.toFixed(4)),
      email: Number(emailTotal.toFixed(4)),
    },
  };
}

export type WhatsAppTemplateId = keyof typeof WHATSAPP_TEMPLATES;
export type EmailTemplateId = keyof typeof EMAIL_TEMPLATES;
export type NotificationChannel = typeof NOTIFICATIONS_CONFIG.channels[number];

