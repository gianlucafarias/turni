// =============================================================================
// Cliente de WhatsApp Cloud API para notificaciones
// Documentación: https://developers.facebook.com/docs/whatsapp/cloud-api
// =============================================================================

import {
  WHATSAPP_PRICING,
  WHATSAPP_TEMPLATES,
  NOTIFICATIONS_CONFIG,
  type WhatsAppTemplateId,
} from '../../config/notifications';
import type {
  SendNotificationResult,
  NotificationStatus,
  WhatsAppMessageCategory,
  NotificationRecipient,
  AppointmentForNotification,
} from './types';

/**
 * Configuración del cliente WhatsApp
 */
interface WhatsAppClientConfig {
  apiToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  apiVersion?: string;
}

/**
 * Payload para enviar mensaje de plantilla
 */
interface SendTemplatePayload {
  to: string;
  templateName: string;
  languageCode: string;
  components: Array<{
    type: 'body' | 'header' | 'button';
    parameters: Array<{
      type: 'text' | 'image' | 'document';
      text?: string;
      image?: { link: string };
    }>;
  }>;
}

/**
 * Respuesta de la API de WhatsApp
 */
interface WhatsAppAPIResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

/**
 * Error de la API de WhatsApp
 */
interface WhatsAppAPIError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
  };
}

/**
 * Cliente de WhatsApp Cloud API
 */
export class WhatsAppClient {
  private config: WhatsAppClientConfig;
  private baseUrl: string;
  
  constructor(config?: Partial<WhatsAppClientConfig>) {
    this.config = {
      apiToken: config?.apiToken || import.meta.env.WHATSAPP_API_TOKEN || '',
      phoneNumberId: config?.phoneNumberId || import.meta.env.WHATSAPP_PHONE_NUMBER_ID || '',
      businessAccountId: config?.businessAccountId || import.meta.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
      apiVersion: config?.apiVersion || 'v21.0',
    };
    
    this.baseUrl = `https://graph.facebook.com/${this.config.apiVersion}`;
  }
  
  /**
   * Verifica si el cliente está configurado correctamente
   */
  isConfigured(): boolean {
    return !!(
      this.config.apiToken &&
      this.config.phoneNumberId &&
      this.config.businessAccountId
    );
  }
  
  /**
   * Formatea número de teléfono para WhatsApp (sin +, solo dígitos)
   */
  private formatPhoneNumber(phone: string): string {
    // Remover espacios, guiones, paréntesis y el +
    let formatted = phone.replace(/[\s\-\(\)\+]/g, '');
    
    // Si empieza con 0, asumir Argentina y agregar código de país
    if (formatted.startsWith('0')) {
      formatted = '54' + formatted.substring(1);
    }
    
    // Si no tiene código de país, agregar Argentina
    if (!formatted.startsWith('54') && formatted.length <= 10) {
      formatted = '54' + formatted;
    }
    
    // Para Argentina, agregar 9 después del código de país si no está
    // WhatsApp Argentina: 549XXXXXXXXXX (sin el 15, con el 9)
    if (formatted.startsWith('54') && !formatted.startsWith('549')) {
      formatted = '549' + formatted.substring(2);
    }
    
    return formatted;
  }
  
  /**
   * Envía un mensaje de plantilla
   */
  async sendTemplate(payload: SendTemplatePayload): Promise<SendNotificationResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        status: 'failed',
        channel: 'whatsapp',
        timestamp: new Date(),
        error: {
          code: 'NOT_CONFIGURED',
          message: 'WhatsApp client not configured. Check environment variables.',
          retryable: false,
        },
      };
    }
    
    const formattedPhone = this.formatPhoneNumber(payload.to);
    
    const requestBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'template',
      template: {
        name: payload.templateName,
        language: {
          code: payload.languageCode,
        },
        components: payload.components,
      },
    };
    
    try {
      const response = await fetch(
        `${this.baseUrl}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json() as WhatsAppAPIError;
        const isRateLimited = errorData.error.code === 130429;
        
        return {
          success: false,
          status: 'failed',
          channel: 'whatsapp',
          timestamp: new Date(),
          error: {
            code: String(errorData.error.code),
            message: errorData.error.message,
            retryable: isRateLimited || response.status >= 500,
          },
        };
      }
      
      const data = await response.json() as WhatsAppAPIResponse;
      
      return {
        success: true,
        messageId: data.messages[0]?.id,
        status: 'sent',
        channel: 'whatsapp',
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        channel: 'whatsapp',
        timestamp: new Date(),
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          retryable: true,
        },
      };
    }
  }
  
  /**
   * Envía recordatorio de turno del día
   */
  async sendAppointmentReminder(
    appointment: AppointmentForNotification
  ): Promise<SendNotificationResult> {
    if (!appointment.clientPhone) {
      return {
        success: false,
        status: 'failed',
        channel: 'whatsapp',
        timestamp: new Date(),
        error: {
          code: 'NO_PHONE',
          message: 'Client does not have a phone number',
          retryable: false,
        },
      };
    }
    
    const template = WHATSAPP_TEMPLATES.appointmentReminder;
    
    // Formatear fecha para mostrar
    const dateObj = new Date(appointment.date + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    
    return this.sendTemplate({
      to: appointment.clientPhone,
      templateName: template.name,
      languageCode: template.language,
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: appointment.clientName },
            { type: 'text', text: appointment.serviceName },
            { type: 'text', text: formattedDate },
            { type: 'text', text: appointment.time },
            { type: 'text', text: appointment.storeName },
          ],
        },
      ],
    });
  }
  
  /**
   * Envía confirmación de turno
   */
  async sendAppointmentConfirmed(
    appointment: AppointmentForNotification
  ): Promise<SendNotificationResult> {
    if (!appointment.clientPhone) {
      return {
        success: false,
        status: 'failed',
        channel: 'whatsapp',
        timestamp: new Date(),
        error: {
          code: 'NO_PHONE',
          message: 'Client does not have a phone number',
          retryable: false,
        },
      };
    }
    
    const template = WHATSAPP_TEMPLATES.appointmentConfirmed;
    
    const dateObj = new Date(appointment.date + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    
    return this.sendTemplate({
      to: appointment.clientPhone,
      templateName: template.name,
      languageCode: template.language,
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: appointment.clientName },
            { type: 'text', text: appointment.serviceName },
            { type: 'text', text: formattedDate },
            { type: 'text', text: appointment.time },
            { type: 'text', text: appointment.storeName },
          ],
        },
      ],
    });
  }
  
  /**
   * Envía notificación de cambio de estado
   */
  async sendAppointmentStatusChange(
    appointment: AppointmentForNotification,
    newStatus: string
  ): Promise<SendNotificationResult> {
    if (!appointment.clientPhone) {
      return {
        success: false,
        status: 'failed',
        channel: 'whatsapp',
        timestamp: new Date(),
        error: {
          code: 'NO_PHONE',
          message: 'Client does not have a phone number',
          retryable: false,
        },
      };
    }
    
    const template = WHATSAPP_TEMPLATES.appointmentStatusChange;
    
    const dateObj = new Date(appointment.date + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
    });
    
    // Traducir estado
    const statusTranslations: Record<string, string> = {
      pending: 'Pendiente',
      confirmed: 'Confirmado',
      cancelled: 'Cancelado',
    };
    
    return this.sendTemplate({
      to: appointment.clientPhone,
      templateName: template.name,
      languageCode: template.language,
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: appointment.clientName },
            { type: 'text', text: appointment.serviceName },
            { type: 'text', text: formattedDate },
            { type: 'text', text: statusTranslations[newStatus] || newStatus },
          ],
        },
      ],
    });
  }
  
  /**
   * Envía recordatorio por inactividad (marketing)
   */
  async sendInactivityReminder(
    recipient: NotificationRecipient,
    storeName: string
  ): Promise<SendNotificationResult> {
    if (!recipient.phone) {
      return {
        success: false,
        status: 'failed',
        channel: 'whatsapp',
        timestamp: new Date(),
        error: {
          code: 'NO_PHONE',
          message: 'Client does not have a phone number',
          retryable: false,
        },
      };
    }
    
    const template = WHATSAPP_TEMPLATES.inactivityReminder;
    
    const result = await this.sendTemplate({
      to: recipient.phone,
      templateName: template.name,
      languageCode: template.language,
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: recipient.firstName },
            { type: 'text', text: storeName },
          ],
        },
      ],
    });
    
    // Agregar info de costo para marketing
    if (result.success) {
      result.cost = {
        amount: WHATSAPP_PRICING.rates.marketing,
        currency: WHATSAPP_PRICING.currency,
        category: 'marketing',
      };
    }
    
    return result;
  }
  
  /**
   * Envía mensaje de campaña masiva (marketing)
   */
  async sendMassiveCampaign(
    recipient: NotificationRecipient,
    message: string
  ): Promise<SendNotificationResult> {
    if (!recipient.phone) {
      return {
        success: false,
        status: 'failed',
        channel: 'whatsapp',
        timestamp: new Date(),
        error: {
          code: 'NO_PHONE',
          message: 'Client does not have a phone number',
          retryable: false,
        },
      };
    }
    
    const template = WHATSAPP_TEMPLATES.massiveCampaign;
    
    const result = await this.sendTemplate({
      to: recipient.phone,
      templateName: template.name,
      languageCode: template.language,
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: message },
          ],
        },
      ],
    });
    
    if (result.success) {
      result.cost = {
        amount: WHATSAPP_PRICING.rates.marketing,
        currency: WHATSAPP_PRICING.currency,
        category: 'marketing',
      };
    }
    
    return result;
  }
  
  /**
   * Obtiene el costo estimado de un mensaje según categoría
   */
  getMessageCost(category: WhatsAppMessageCategory): number {
    return WHATSAPP_PRICING.rates[category] || 0;
  }
  
  /**
   * Calcula el costo de una campaña masiva
   */
  estimateCampaignCost(recipientCount: number, category: WhatsAppMessageCategory): {
    totalCost: number;
    costPerMessage: number;
    currency: string;
  } {
    const costPerMessage = this.getMessageCost(category);
    return {
      totalCost: Number((recipientCount * costPerMessage).toFixed(4)),
      costPerMessage,
      currency: WHATSAPP_PRICING.currency,
    };
  }
}

/**
 * Instancia singleton del cliente
 */
let whatsappClientInstance: WhatsAppClient | null = null;

/**
 * Obtiene la instancia del cliente WhatsApp
 */
export function getWhatsAppClient(): WhatsAppClient {
  if (!whatsappClientInstance) {
    whatsappClientInstance = new WhatsAppClient();
  }
  return whatsappClientInstance;
}

/**
 * Helper para verificar si WhatsApp está configurado
 */
export function isWhatsAppConfigured(): boolean {
  return getWhatsAppClient().isConfigured();
}

