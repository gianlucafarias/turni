// =============================================================================
// Tipos para el sistema de notificaciones
// =============================================================================

import type { WhatsAppTemplateId, EmailTemplateId, NotificationChannel } from '../../config/notifications';

/**
 * Estado de un mensaje/notificación
 */
export type NotificationStatus = 
  | 'pending'     // Pendiente de envío
  | 'queued'      // En cola para envío
  | 'sent'        // Enviado al proveedor
  | 'delivered'   // Entregado al destinatario
  | 'read'        // Leído por destinatario (WhatsApp)
  | 'failed'      // Falló el envío
  | 'rejected';   // Rechazado por el proveedor

/**
 * Tipo de notificación según propósito
 */
export type NotificationType =
  | 'appointment_reminder'      // Recordatorio de turno
  | 'appointment_confirmed'     // Confirmación de turno
  | 'appointment_cancelled'     // Cancelación de turno
  | 'appointment_status_change' // Cambio de estado
  | 'inactivity_reminder'       // Recordatorio por inactividad
  | 'massive_campaign';         // Campaña masiva

/**
 * Categoría de mensaje WhatsApp (afecta pricing)
 */
export type WhatsAppMessageCategory = 'marketing' | 'utility' | 'authentication' | 'service';

/**
 * Datos de un cliente para notificaciones
 */
export interface NotificationRecipient {
  id: string;                   // ID del cliente
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;               // Número con código de país (+54...)
  storeId: string;
  optInWhatsApp?: boolean;      // Aceptó recibir WhatsApp
  optInEmail?: boolean;         // Aceptó recibir email
}

/**
 * Datos de un turno para notificaciones
 */
export interface AppointmentForNotification {
  id: string;
  storeId: string;
  storeName: string;
  clientId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  serviceName: string;
  servicePrice: number;
  date: string;                 // YYYY-MM-DD
  time: string;                 // HH:mm
  status: 'pending' | 'confirmed' | 'cancelled';
}

/**
 * Payload para enviar una notificación
 */
export interface SendNotificationPayload {
  type: NotificationType;
  channel: NotificationChannel;
  recipient: NotificationRecipient;
  templateId?: WhatsAppTemplateId | EmailTemplateId;
  variables: Record<string, string>;
  metadata?: Record<string, any>;
  
  // Para campañas masivas
  customMessage?: string;
  
  // Scheduling
  sendAt?: Date;                // Programar envío
  idempotencyKey?: string;      // Evitar duplicados
}

/**
 * Resultado de envío de notificación
 */
export interface SendNotificationResult {
  success: boolean;
  messageId?: string;           // ID del proveedor
  status: NotificationStatus;
  channel: NotificationChannel;
  timestamp: Date;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  cost?: {
    amount: number;
    currency: string;
    category?: WhatsAppMessageCategory;
  };
}

/**
 * Log de notificación para persistencia
 */
export interface NotificationLog {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Referencias
  storeId: string;
  clientId?: string;
  appointmentId?: string;
  
  // Tipo y canal
  type: NotificationType;
  channel: NotificationChannel;
  
  // Estado
  status: NotificationStatus;
  statusHistory: Array<{
    status: NotificationStatus;
    timestamp: Date;
    details?: string;
  }>;
  
  // IDs externos
  externalMessageId?: string;   // ID de WhatsApp/Email provider
  
  // Contenido (para auditoría)
  templateId?: string;
  variables?: Record<string, string>;
  
  // Costos
  costAmount?: number;
  costCurrency?: string;
  messageCategory?: WhatsAppMessageCategory;
  
  // Errores
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  
  // Metadata
  metadata?: Record<string, any>;
}

/**
 * Webhook de WhatsApp Cloud API
 */
export interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: Array<{
    id: string;
    changes: Array<{
      field: 'messages';
      value: {
        messaging_product: 'whatsapp';
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        statuses?: Array<{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
          conversation?: {
            id: string;
            origin: {
              type: 'utility' | 'marketing' | 'authentication' | 'service';
            };
            expiration_timestamp?: string;
          };
          pricing?: {
            billable: boolean;
            pricing_model: 'CBP' | 'NBP'; // Conversation vs per-message
            category: WhatsAppMessageCategory;
          };
          errors?: Array<{
            code: number;
            title: string;
            message: string;
            error_data?: {
              details: string;
            };
          }>;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
        }>;
      };
    }>;
  }>;
}

/**
 * Filtros para segmentación de clientes
 */
export interface ClientSegmentationFilter {
  storeId: string;
  
  // Por etiquetas
  tagIds?: string[];
  tagMatchMode?: 'any' | 'all';  // any = OR, all = AND
  
  // Por inactividad
  inactiveDays?: number;         // Clientes sin turnos en X días
  
  // Por estado
  isActive?: boolean;
  
  // Por canal disponible
  hasPhone?: boolean;
  hasEmail?: boolean;
  
  // Opt-in
  optInWhatsApp?: boolean;
  optInEmail?: boolean;
  
  // Límite
  limit?: number;
}

/**
 * Resultado de campaña masiva
 */
export interface MassiveCampaignResult {
  campaignId: string;
  totalRecipients: number;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  estimatedCost: number;
  currency: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'cancelled' | 'failed';
}

/**
 * Job de notificación programado
 */
export interface ScheduledNotificationJob {
  id: string;
  type: 'reminder' | 'status_change' | 'inactivity' | 'campaign';
  status: 'pending' | 'running' | 'completed' | 'failed';
  
  // Datos del job
  storeId?: string;
  appointmentId?: string;
  campaignId?: string;
  filters?: ClientSegmentationFilter;
  
  // Scheduling
  scheduledFor: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  // Resultados
  totalNotifications?: number;
  successCount?: number;
  failCount?: number;
  
  // Metadata
  createdAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Configuración de opt-in/opt-out del cliente
 */
export interface ClientNotificationPreferences {
  clientId: string;
  storeId: string;
  
  // Canales
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  
  // Tipos de notificación
  appointmentReminders: boolean;
  appointmentUpdates: boolean;
  marketingMessages: boolean;
  
  // Historial de cambios
  updatedAt: Date;
  optOutReason?: string;
}

