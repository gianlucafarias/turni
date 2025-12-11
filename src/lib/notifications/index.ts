// =============================================================================
// Sistema de Notificaciones - Módulo principal
// Unifica WhatsApp y Email con fallback y logging
// =============================================================================

import { supabase } from '../supabase';
import { WhatsAppClient, getWhatsAppClient, isWhatsAppConfigured } from './whatsapp';
import { EmailClient, getEmailClient, isEmailConfigured } from './email';
import { NOTIFICATIONS_CONFIG, WHATSAPP_PRICING } from '../../config/notifications';
import type {
  SendNotificationResult,
  NotificationRecipient,
  AppointmentForNotification,
  NotificationLog,
  NotificationType,
  NotificationStatus,
} from './types';
import type { NotificationChannel } from '../../config/notifications';

// Re-exportar todo
export * from './types';
export * from './whatsapp';
export * from './email';

/**
 * Servicio unificado de notificaciones
 */
export class NotificationService {
  private whatsapp: WhatsAppClient;
  private email: EmailClient;
  
  constructor() {
    this.whatsapp = getWhatsAppClient();
    this.email = getEmailClient();
  }
  
  /**
   * Verifica qué canales están disponibles
   */
  getAvailableChannels(): NotificationChannel[] {
    const channels: NotificationChannel[] = [];
    if (isWhatsAppConfigured()) channels.push('whatsapp');
    if (isEmailConfigured()) channels.push('email');
    return channels;
  }
  
  /**
   * Envía recordatorio de turno (WhatsApp preferido, email fallback)
   */
  async sendAppointmentReminder(
    appointment: AppointmentForNotification
  ): Promise<SendNotificationResult> {
    const preferredChannel = NOTIFICATIONS_CONFIG.preferredChannel;
    
    // Intentar canal preferido primero
    let result: SendNotificationResult;
    
    if (preferredChannel === 'whatsapp' && appointment.clientPhone && isWhatsAppConfigured()) {
      result = await this.whatsapp.sendAppointmentReminder(appointment);
      
      // Si falla, intentar con email
      if (!result.success && appointment.clientEmail && isEmailConfigured()) {
        console.log('[NotificationService] WhatsApp failed, trying email fallback');
        result = await this.email.sendAppointmentReminder(appointment);
      }
    } else if (appointment.clientEmail && isEmailConfigured()) {
      result = await this.email.sendAppointmentReminder(appointment);
      
      // Si falla y hay teléfono, intentar WhatsApp
      if (!result.success && appointment.clientPhone && isWhatsAppConfigured()) {
        console.log('[NotificationService] Email failed, trying WhatsApp fallback');
        result = await this.whatsapp.sendAppointmentReminder(appointment);
      }
    } else {
      return {
        success: false,
        status: 'failed',
        channel: preferredChannel,
        timestamp: new Date(),
        error: {
          code: 'NO_CONTACT',
          message: 'Client has no valid contact method',
          retryable: false,
        },
      };
    }
    
    // Loguear resultado
    await this.logNotification({
      storeId: appointment.storeId,
      clientId: appointment.clientId,
      appointmentId: appointment.id,
      type: 'appointment_reminder',
      channel: result.channel,
      status: result.status,
      externalMessageId: result.messageId,
      cost: result.cost,
      error: result.error,
    });
    
    return result;
  }
  
  /**
   * Envía confirmación de turno
   */
  async sendAppointmentConfirmed(
    appointment: AppointmentForNotification
  ): Promise<SendNotificationResult> {
    let result: SendNotificationResult;
    
    // Enviar por ambos canales si están disponibles
    const results: SendNotificationResult[] = [];
    
    if (appointment.clientPhone && isWhatsAppConfigured()) {
      const waResult = await this.whatsapp.sendAppointmentConfirmed(appointment);
      results.push(waResult);
      await this.logNotification({
        storeId: appointment.storeId,
        clientId: appointment.clientId,
        appointmentId: appointment.id,
        type: 'appointment_confirmed',
        channel: 'whatsapp',
        status: waResult.status,
        externalMessageId: waResult.messageId,
        cost: waResult.cost,
        error: waResult.error,
      });
    }
    
    if (appointment.clientEmail && isEmailConfigured()) {
      const emailResult = await this.email.sendAppointmentConfirmed(appointment);
      results.push(emailResult);
      await this.logNotification({
        storeId: appointment.storeId,
        clientId: appointment.clientId,
        appointmentId: appointment.id,
        type: 'appointment_confirmed',
        channel: 'email',
        status: emailResult.status,
        externalMessageId: emailResult.messageId,
        cost: emailResult.cost,
        error: emailResult.error,
      });
    }
    
    // Retornar el primer éxito o el último error
    result = results.find(r => r.success) || results[results.length - 1] || {
      success: false,
      status: 'failed' as NotificationStatus,
      channel: 'whatsapp' as NotificationChannel,
      timestamp: new Date(),
      error: {
        code: 'NO_CONTACT',
        message: 'No contact method available',
        retryable: false,
      },
    };
    
    return result;
  }
  
  /**
   * Envía notificación de cambio de estado
   */
  async sendAppointmentStatusChange(
    appointment: AppointmentForNotification,
    newStatus: string
  ): Promise<SendNotificationResult> {
    let result: SendNotificationResult;
    
    if (appointment.clientPhone && isWhatsAppConfigured()) {
      result = await this.whatsapp.sendAppointmentStatusChange(appointment, newStatus);
    } else if (appointment.clientEmail && isEmailConfigured()) {
      // Email de cambio de estado (simplificado)
      result = await this.email.sendAppointmentConfirmed(appointment); // Reutilizar plantilla
    } else {
      return {
        success: false,
        status: 'failed',
        channel: 'whatsapp',
        timestamp: new Date(),
        error: {
          code: 'NO_CONTACT',
          message: 'No contact method available',
          retryable: false,
        },
      };
    }
    
    await this.logNotification({
      storeId: appointment.storeId,
      clientId: appointment.clientId,
      appointmentId: appointment.id,
      type: 'appointment_status_change',
      channel: result.channel,
      status: result.status,
      externalMessageId: result.messageId,
      cost: result.cost,
      error: result.error,
      variables: { newStatus },
    });
    
    return result;
  }
  
  /**
   * Envía recordatorio por inactividad
   */
  async sendInactivityReminder(
    recipient: NotificationRecipient,
    storeName: string,
    channel?: NotificationChannel
  ): Promise<SendNotificationResult> {
    const targetChannel = channel || NOTIFICATIONS_CONFIG.preferredChannel;
    let result: SendNotificationResult;
    
    if (targetChannel === 'whatsapp' && recipient.phone && isWhatsAppConfigured()) {
      result = await this.whatsapp.sendInactivityReminder(recipient, storeName);
    } else if (recipient.email && isEmailConfigured()) {
      result = await this.email.sendInactivityReminder(recipient, storeName);
    } else {
      return {
        success: false,
        status: 'failed',
        channel: targetChannel,
        timestamp: new Date(),
        error: {
          code: 'NO_CONTACT',
          message: 'No contact method available for selected channel',
          retryable: false,
        },
      };
    }
    
    await this.logNotification({
      storeId: recipient.storeId,
      clientId: recipient.id,
      type: 'inactivity_reminder',
      channel: result.channel,
      status: result.status,
      externalMessageId: result.messageId,
      cost: result.cost,
      error: result.error,
    });
    
    return result;
  }
  
  /**
   * Envía campaña masiva
   */
  async sendMassiveCampaign(
    recipients: NotificationRecipient[],
    message: string,
    channel: NotificationChannel,
    options?: {
      campaignId?: string;
      subject?: string; // Para email
      delayBetweenMs?: number;
    }
  ): Promise<{
    total: number;
    sent: number;
    failed: number;
    results: SendNotificationResult[];
  }> {
    const results: SendNotificationResult[] = [];
    let sent = 0;
    let failed = 0;
    
    const delay = options?.delayBetweenMs || 100;
    
    for (const recipient of recipients) {
      let result: SendNotificationResult;
      
      if (channel === 'whatsapp' && recipient.phone && isWhatsAppConfigured()) {
        result = await this.whatsapp.sendMassiveCampaign(recipient, message);
      } else if (channel === 'email' && recipient.email && isEmailConfigured()) {
        result = await this.email.sendMassiveCampaign(
          recipient,
          options?.subject || 'Mensaje importante',
          `<div style="font-family: sans-serif; padding: 20px;">${message}</div>`
        );
      } else {
        result = {
          success: false,
          status: 'failed',
          channel,
          timestamp: new Date(),
          error: {
            code: 'NO_CONTACT',
            message: `No ${channel} contact for recipient`,
            retryable: false,
          },
        };
      }
      
      results.push(result);
      
      if (result.success) {
        sent++;
      } else {
        failed++;
      }
      
      // Loguear cada envío
      await this.logNotification({
        storeId: recipient.storeId,
        clientId: recipient.id,
        type: 'massive_campaign',
        channel: result.channel,
        status: result.status,
        externalMessageId: result.messageId,
        cost: result.cost,
        error: result.error,
        metadata: { campaignId: options?.campaignId },
      });
      
      // Delay entre envíos
      if (delay > 0 && recipients.indexOf(recipient) < recipients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return {
      total: recipients.length,
      sent,
      failed,
      results,
    };
  }
  
  /**
   * Obtiene métricas de notificaciones
   */
  async getMetrics(
    storeId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    total_sent: number;
    total_delivered: number;
    total_read: number;
    total_failed: number;
    delivery_rate: number;
    read_rate: number;
    total_cost: number;
  }> {
    const { data, error } = await supabase.rpc('get_notification_metrics', {
      p_store_id: storeId,
      p_start_date: startDate?.toISOString().split('T')[0],
      p_end_date: endDate?.toISOString().split('T')[0],
    });
    
    if (error) {
      console.error('[NotificationService] Error getting metrics:', error);
      return {
        total_sent: 0,
        total_delivered: 0,
        total_read: 0,
        total_failed: 0,
        delivery_rate: 0,
        read_rate: 0,
        total_cost: 0,
      };
    }
    
    return data?.[0] || {
      total_sent: 0,
      total_delivered: 0,
      total_read: 0,
      total_failed: 0,
      delivery_rate: 0,
      read_rate: 0,
      total_cost: 0,
    };
  }
  
  /**
   * Estima el costo de una campaña
   */
  estimateCampaignCost(
    recipientCount: number,
    channel: NotificationChannel,
    messageCategory: 'marketing' | 'utility' = 'marketing'
  ): {
    estimatedCost: number;
    currency: string;
    perMessage: number;
  } {
    if (channel === 'whatsapp') {
      const perMessage = WHATSAPP_PRICING.rates[messageCategory];
      return {
        estimatedCost: Number((recipientCount * perMessage).toFixed(4)),
        currency: 'USD',
        perMessage,
      };
    } else {
      // Email es mucho más barato
      const perMessage = 0.0001; // $0.10 per 1000
      return {
        estimatedCost: Number((recipientCount * perMessage).toFixed(4)),
        currency: 'USD',
        perMessage,
      };
    }
  }
  
  /**
   * Guarda log de notificación en la base de datos
   */
  private async logNotification(params: {
    storeId: string;
    clientId?: string;
    appointmentId?: string;
    type: NotificationType;
    channel: NotificationChannel;
    status: NotificationStatus;
    externalMessageId?: string;
    templateId?: string;
    variables?: Record<string, any>;
    cost?: {
      amount: number;
      currency: string;
      category?: string;
    };
    error?: {
      code: string;
      message: string;
    };
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const { error } = await supabase.from('notification_logs').insert({
        store_id: params.storeId,
        client_id: params.clientId || null,
        appointment_id: params.appointmentId || null,
        type: params.type,
        channel: params.channel,
        status: params.status,
        external_message_id: params.externalMessageId || null,
        template_id: params.templateId || null,
        variables: params.variables || null,
        cost_amount: params.cost?.amount || null,
        cost_currency: params.cost?.currency || 'USD',
        message_category: params.cost?.category || null,
        error_code: params.error?.code || null,
        error_message: params.error?.message || null,
        metadata: params.metadata || null,
        status_history: [{
          status: params.status,
          timestamp: new Date().toISOString(),
        }],
      });
      
      if (error) {
        console.error('[NotificationService] Error logging notification:', error);
      }
    } catch (err) {
      console.error('[NotificationService] Error logging notification:', err);
    }
  }
}

/**
 * Instancia singleton del servicio
 */
let notificationServiceInstance: NotificationService | null = null;

/**
 * Obtiene la instancia del servicio de notificaciones
 */
export function getNotificationService(): NotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService();
  }
  return notificationServiceInstance;
}



