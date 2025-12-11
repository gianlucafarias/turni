// =============================================================================
// Adapter de Email para notificaciones (SES baseline)
// Documentación: https://docs.aws.amazon.com/ses/latest/dg/send-email.html
// =============================================================================

import { EMAIL_PRICING, EMAIL_TEMPLATES, type EmailTemplateId } from '../../config/notifications';
import type {
  SendNotificationResult,
  NotificationRecipient,
  AppointmentForNotification,
} from './types';

/**
 * Configuración del cliente de email
 */
interface EmailClientConfig {
  provider: 'ses' | 'sendgrid' | 'resend' | 'mailgun';
  fromAddress: string;
  fromName?: string;
  
  // SES específico
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsRegion?: string;
  
  // SendGrid específico
  sendgridApiKey?: string;
  
  // Resend específico
  resendApiKey?: string;
}

/**
 * Payload para enviar email
 */
interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: Record<string, string>;
}

/**
 * Cliente de Email con soporte multi-proveedor
 */
export class EmailClient {
  private config: EmailClientConfig;
  
  constructor(config?: Partial<EmailClientConfig>) {
    this.config = {
      provider: (config?.provider || import.meta.env.EMAIL_PROVIDER || 'ses') as EmailClientConfig['provider'],
      fromAddress: config?.fromAddress || import.meta.env.EMAIL_FROM_ADDRESS || '',
      fromName: config?.fromName || import.meta.env.EMAIL_FROM_NAME || 'Tiendita',
      awsAccessKeyId: config?.awsAccessKeyId || import.meta.env.AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: config?.awsSecretAccessKey || import.meta.env.AWS_SECRET_ACCESS_KEY,
      awsRegion: config?.awsRegion || import.meta.env.AWS_REGION || 'us-east-1',
      sendgridApiKey: config?.sendgridApiKey || import.meta.env.SENDGRID_API_KEY,
      resendApiKey: config?.resendApiKey || import.meta.env.RESEND_API_KEY,
    };
  }
  
  /**
   * Verifica si el cliente está configurado
   */
  isConfigured(): boolean {
    if (!this.config.fromAddress) return false;
    
    switch (this.config.provider) {
      case 'ses':
        return !!(this.config.awsAccessKeyId && this.config.awsSecretAccessKey);
      case 'sendgrid':
        return !!this.config.sendgridApiKey;
      case 'resend':
        return !!this.config.resendApiKey;
      default:
        return false;
    }
  }
  
  /**
   * Envía un email usando el proveedor configurado
   */
  async send(payload: SendEmailPayload): Promise<SendNotificationResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        status: 'failed',
        channel: 'email',
        timestamp: new Date(),
        error: {
          code: 'NOT_CONFIGURED',
          message: 'Email client not configured. Check environment variables.',
          retryable: false,
        },
      };
    }
    
    switch (this.config.provider) {
      case 'ses':
        return this.sendViaSES(payload);
      case 'sendgrid':
        return this.sendViaSendGrid(payload);
      case 'resend':
        return this.sendViaResend(payload);
      default:
        return {
          success: false,
          status: 'failed',
          channel: 'email',
          timestamp: new Date(),
          error: {
            code: 'INVALID_PROVIDER',
            message: `Unknown email provider: ${this.config.provider}`,
            retryable: false,
          },
        };
    }
  }
  
  /**
   * Envía email via Amazon SES (v2 API)
   */
  private async sendViaSES(payload: SendEmailPayload): Promise<SendNotificationResult> {
    try {
      // Usar SES v2 HTTP API directamente para evitar dependencia de SDK
      const endpoint = `https://email.${this.config.awsRegion}.amazonaws.com/v2/email/outbound-emails`;
      
      const body = {
        Content: {
          Simple: {
            Subject: { Data: payload.subject, Charset: 'UTF-8' },
            Body: {
              Html: { Data: payload.html, Charset: 'UTF-8' },
              ...(payload.text && { Text: { Data: payload.text, Charset: 'UTF-8' } }),
            },
          },
        },
        Destination: {
          ToAddresses: [payload.to],
        },
        FromEmailAddress: this.config.fromName 
          ? `${this.config.fromName} <${this.config.fromAddress}>`
          : this.config.fromAddress,
        ...(payload.replyTo && { ReplyToAddresses: [payload.replyTo] }),
      };
      
      // Crear signature AWS v4 (simplificado - en producción usar @aws-sdk/client-ses)
      const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
      const date = timestamp.slice(0, 8);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Amz-Date': timestamp,
          // NOTA: En producción, usar AWS SDK para proper signing
          // Esta implementación es simplificada y requiere el SDK
        },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          status: 'failed',
          channel: 'email',
          timestamp: new Date(),
          error: {
            code: 'SES_ERROR',
            message: error,
            retryable: response.status >= 500,
          },
        };
      }
      
      const result = await response.json();
      
      return {
        success: true,
        messageId: result.MessageId,
        status: 'sent',
        channel: 'email',
        timestamp: new Date(),
        cost: {
          amount: EMAIL_PRICING.perThousandEmails / 1000,
          currency: EMAIL_PRICING.currency,
        },
      };
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        channel: 'email',
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
   * Envía email via SendGrid
   */
  private async sendViaSendGrid(payload: SendEmailPayload): Promise<SendNotificationResult> {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: payload.to }] }],
          from: {
            email: this.config.fromAddress,
            name: this.config.fromName,
          },
          subject: payload.subject,
          content: [
            { type: 'text/html', value: payload.html },
            ...(payload.text ? [{ type: 'text/plain', value: payload.text }] : []),
          ],
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          status: 'failed',
          channel: 'email',
          timestamp: new Date(),
          error: {
            code: 'SENDGRID_ERROR',
            message: error,
            retryable: response.status >= 500 || response.status === 429,
          },
        };
      }
      
      const messageId = response.headers.get('X-Message-Id') || undefined;
      
      return {
        success: true,
        messageId,
        status: 'sent',
        channel: 'email',
        timestamp: new Date(),
        cost: {
          amount: EMAIL_PRICING.perThousandEmails / 1000,
          currency: EMAIL_PRICING.currency,
        },
      };
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        channel: 'email',
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
   * Envía email via Resend
   */
  private async sendViaResend(payload: SendEmailPayload): Promise<SendNotificationResult> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.config.fromName 
            ? `${this.config.fromName} <${this.config.fromAddress}>`
            : this.config.fromAddress,
          to: [payload.to],
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          status: 'failed',
          channel: 'email',
          timestamp: new Date(),
          error: {
            code: 'RESEND_ERROR',
            message: error.message || JSON.stringify(error),
            retryable: response.status >= 500 || response.status === 429,
          },
        };
      }
      
      const result = await response.json();
      
      return {
        success: true,
        messageId: result.id,
        status: 'sent',
        channel: 'email',
        timestamp: new Date(),
        cost: {
          amount: EMAIL_PRICING.perThousandEmails / 1000,
          currency: EMAIL_PRICING.currency,
        },
      };
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        channel: 'email',
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
   * Genera HTML para recordatorio de turno
   */
  private generateAppointmentReminderHTML(appointment: AppointmentForNotification): string {
    const dateObj = new Date(appointment.date + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recordatorio de turno</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
          .appointment-card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .detail { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
          .detail:last-child { border-bottom: none; }
          .label { color: #64748b; }
          .value { font-weight: 600; color: #1e293b; }
          .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
          .cta { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0;">📅 Recordatorio de Turno</h1>
          <p style="margin: 10px 0 0; opacity: 0.9;">¡Tu cita es hoy!</p>
        </div>
        <div class="content">
          <p>Hola <strong>${appointment.clientName}</strong>,</p>
          <p>Te recordamos que tenés un turno agendado para hoy:</p>
          
          <div class="appointment-card">
            <div class="detail">
              <span class="label">📍 Local</span>
              <span class="value">${appointment.storeName}</span>
            </div>
            <div class="detail">
              <span class="label">✂️ Servicio</span>
              <span class="value">${appointment.serviceName}</span>
            </div>
            <div class="detail">
              <span class="label">📆 Fecha</span>
              <span class="value">${formattedDate}</span>
            </div>
            <div class="detail">
              <span class="label">🕐 Hora</span>
              <span class="value">${appointment.time} hs</span>
            </div>
            ${appointment.servicePrice > 0 ? `
            <div class="detail">
              <span class="label">💰 Precio</span>
              <span class="value">$${appointment.servicePrice.toLocaleString('es-AR')}</span>
            </div>
            ` : ''}
          </div>
          
          <p style="text-align: center; color: #64748b;">¡Te esperamos!</p>
        </div>
        <div class="footer">
          <p>Este email fue enviado automáticamente desde ${appointment.storeName}</p>
        </div>
      </body>
      </html>
    `;
  }
  
  /**
   * Genera HTML para confirmación de turno
   */
  private generateAppointmentConfirmedHTML(appointment: AppointmentForNotification): string {
    const dateObj = new Date(appointment.date + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Turno Confirmado</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
          .appointment-card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .detail { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
          .detail:last-child { border-bottom: none; }
          .label { color: #64748b; }
          .value { font-weight: 600; color: #1e293b; }
          .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
          .badge { display: inline-block; background: #dcfce7; color: #166534; padding: 6px 12px; border-radius: 20px; font-size: 14px; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0;">✅ Turno Confirmado</h1>
          <p style="margin: 10px 0 0; opacity: 0.9;">¡Gracias por elegirnos!</p>
        </div>
        <div class="content">
          <p>Hola <strong>${appointment.clientName}</strong>,</p>
          <p>Tu turno ha sido confirmado exitosamente:</p>
          
          <div class="appointment-card">
            <div style="text-align: center; margin-bottom: 15px;">
              <span class="badge">✓ Confirmado</span>
            </div>
            <div class="detail">
              <span class="label">📍 Local</span>
              <span class="value">${appointment.storeName}</span>
            </div>
            <div class="detail">
              <span class="label">✂️ Servicio</span>
              <span class="value">${appointment.serviceName}</span>
            </div>
            <div class="detail">
              <span class="label">📆 Fecha</span>
              <span class="value">${formattedDate}</span>
            </div>
            <div class="detail">
              <span class="label">🕐 Hora</span>
              <span class="value">${appointment.time} hs</span>
            </div>
          </div>
          
          <p style="color: #64748b; font-size: 14px;">
            Te enviaremos un recordatorio el día de tu turno.
          </p>
        </div>
        <div class="footer">
          <p>Este email fue enviado automáticamente desde ${appointment.storeName}</p>
        </div>
      </body>
      </html>
    `;
  }
  
  /**
   * Genera HTML para inactividad
   */
  private generateInactivityReminderHTML(
    recipientName: string,
    storeName: string
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Te extrañamos</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; text-align: center; }
          .cta { display: inline-block; background: #f59e0b; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }
          .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0;">👋 ¡Te extrañamos!</h1>
        </div>
        <div class="content">
          <p style="font-size: 18px;">Hola <strong>${recipientName}</strong>,</p>
          <p>Hace tiempo que no te vemos por <strong>${storeName}</strong>.</p>
          <p>¿Te gustaría agendar un nuevo turno?</p>
          <p style="color: #64748b; margin-top: 30px;">¡Te esperamos pronto!</p>
        </div>
        <div class="footer">
          <p>Este email fue enviado desde ${storeName}</p>
          <p style="font-size: 12px;">Si no deseás recibir más emails, podés darte de baja respondiendo a este mensaje.</p>
        </div>
      </body>
      </html>
    `;
  }
  
  /**
   * Envía recordatorio de turno por email
   */
  async sendAppointmentReminder(
    appointment: AppointmentForNotification
  ): Promise<SendNotificationResult> {
    if (!appointment.clientEmail) {
      return {
        success: false,
        status: 'failed',
        channel: 'email',
        timestamp: new Date(),
        error: {
          code: 'NO_EMAIL',
          message: 'Client does not have an email address',
          retryable: false,
        },
      };
    }
    
    const subject = EMAIL_TEMPLATES.appointmentReminder.subject
      .replace('{{storeName}}', appointment.storeName);
    
    return this.send({
      to: appointment.clientEmail,
      subject,
      html: this.generateAppointmentReminderHTML(appointment),
      tags: {
        type: 'appointment_reminder',
        store_id: appointment.storeId,
        appointment_id: appointment.id,
      },
    });
  }
  
  /**
   * Envía confirmación de turno por email
   */
  async sendAppointmentConfirmed(
    appointment: AppointmentForNotification
  ): Promise<SendNotificationResult> {
    if (!appointment.clientEmail) {
      return {
        success: false,
        status: 'failed',
        channel: 'email',
        timestamp: new Date(),
        error: {
          code: 'NO_EMAIL',
          message: 'Client does not have an email address',
          retryable: false,
        },
      };
    }
    
    const subject = EMAIL_TEMPLATES.appointmentConfirmed.subject
      .replace('{{storeName}}', appointment.storeName);
    
    return this.send({
      to: appointment.clientEmail,
      subject,
      html: this.generateAppointmentConfirmedHTML(appointment),
      tags: {
        type: 'appointment_confirmed',
        store_id: appointment.storeId,
        appointment_id: appointment.id,
      },
    });
  }
  
  /**
   * Envía recordatorio por inactividad
   */
  async sendInactivityReminder(
    recipient: NotificationRecipient,
    storeName: string
  ): Promise<SendNotificationResult> {
    if (!recipient.email) {
      return {
        success: false,
        status: 'failed',
        channel: 'email',
        timestamp: new Date(),
        error: {
          code: 'NO_EMAIL',
          message: 'Client does not have an email address',
          retryable: false,
        },
      };
    }
    
    const subject = EMAIL_TEMPLATES.inactivityReminder.subject
      .replace('{{storeName}}', storeName);
    
    return this.send({
      to: recipient.email,
      subject,
      html: this.generateInactivityReminderHTML(recipient.firstName, storeName),
      tags: {
        type: 'inactivity_reminder',
        store_id: recipient.storeId,
        client_id: recipient.id,
      },
    });
  }
  
  /**
   * Envía campaña masiva por email
   */
  async sendMassiveCampaign(
    recipient: NotificationRecipient,
    subject: string,
    htmlContent: string
  ): Promise<SendNotificationResult> {
    if (!recipient.email) {
      return {
        success: false,
        status: 'failed',
        channel: 'email',
        timestamp: new Date(),
        error: {
          code: 'NO_EMAIL',
          message: 'Client does not have an email address',
          retryable: false,
        },
      };
    }
    
    return this.send({
      to: recipient.email,
      subject,
      html: htmlContent,
      tags: {
        type: 'massive_campaign',
        store_id: recipient.storeId,
        client_id: recipient.id,
      },
    });
  }
  
  /**
   * Envía emails en batch (respetando límites)
   */
  async sendBatch(
    payloads: SendEmailPayload[],
    delayBetweenMs: number = 100
  ): Promise<SendNotificationResult[]> {
    const results: SendNotificationResult[] = [];
    
    for (const payload of payloads) {
      const result = await this.send(payload);
      results.push(result);
      
      // Delay entre envíos para respetar rate limits
      if (delayBetweenMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenMs));
      }
    }
    
    return results;
  }
}

/**
 * Instancia singleton del cliente
 */
let emailClientInstance: EmailClient | null = null;

/**
 * Obtiene la instancia del cliente de email
 */
export function getEmailClient(): EmailClient {
  if (!emailClientInstance) {
    emailClientInstance = new EmailClient();
  }
  return emailClientInstance;
}

/**
 * Helper para verificar si el email está configurado
 */
export function isEmailConfigured(): boolean {
  return getEmailClient().isConfigured();
}



