// =============================================================================
// Scheduler de Jobs de Notificaciones
// Maneja recordatorios programados y campañas masivas
// =============================================================================

import { supabase } from '../supabase';
import { getNotificationService } from './index';
import { getSegmentationService } from './segmentation';
import { NOTIFICATIONS_CONFIG } from '../../config/notifications';
import type { AppointmentForNotification, ScheduledNotificationJob } from './types';
import type { NotificationChannel } from '../../config/notifications';

/**
 * Scheduler de notificaciones
 */
export class NotificationScheduler {
  
  /**
   * Programa recordatorio para un turno
   */
  async scheduleAppointmentReminder(appointmentId: string): Promise<string | null> {
    // Obtener datos del turno
    const { data: appointment, error } = await supabase
      .from('appointments')
      .select(`
        id,
        store_id,
        client_id,
        client_name,
        client_email,
        client_phone,
        service_name,
        service_price,
        date,
        time,
        status,
        public_token,
        stores:store_id (
          name
        )
      `)
      .eq('id', appointmentId)
      .single();
    
    if (error || !appointment) {
      console.error('[Scheduler] Error fetching appointment:', error);
      return null;
    }
    
    // Calcular fecha/hora del recordatorio
    const appointmentDate = new Date(`${appointment.date}T${appointment.time}`);
    const reminderDate = new Date(appointmentDate);
    reminderDate.setHours(
      reminderDate.getHours() - NOTIFICATIONS_CONFIG.reminderHoursBefore
    );
    
    // Si el recordatorio ya pasó, no programar
    if (reminderDate < new Date()) {
      console.log('[Scheduler] Reminder time already passed, skipping');
      return null;
    }
    
    // Crear job programado
    const { data: job, error: jobError } = await supabase
      .from('scheduled_notification_jobs')
      .insert({
        type: 'reminder',
        status: 'pending',
        store_id: appointment.store_id,
        appointment_id: appointmentId,
        scheduled_for: reminderDate.toISOString(),
        metadata: {
          client_name: appointment.client_name,
          service_name: appointment.service_name,
        },
      })
      .select('id')
      .single();
    
    if (jobError) {
      console.error('[Scheduler] Error creating reminder job:', jobError);
      return null;
    }
    
    console.log(`[Scheduler] Reminder scheduled for appointment ${appointmentId} at ${reminderDate.toISOString()}`);
    return job.id;
  }
  
  /**
   * Cancela recordatorios pendientes de un turno
   */
  async cancelAppointmentReminders(appointmentId: string): Promise<void> {
    const { error } = await supabase
      .from('scheduled_notification_jobs')
      .update({ status: 'cancelled' })
      .eq('appointment_id', appointmentId)
      .eq('status', 'pending');
    
    if (error) {
      console.error('[Scheduler] Error cancelling reminders:', error);
    }
  }
  
  /**
   * Programa campaña masiva
   */
  async scheduleMassiveCampaign(params: {
    storeId: string;
    name: string;
    message: string;
    channel: NotificationChannel;
    filters: {
      tagIds?: string[];
      inactiveDays?: number;
    };
    scheduledFor?: Date;
    subject?: string; // Para email
    createdBy?: string;
  }): Promise<string | null> {
    const segmentation = getSegmentationService();
    
    // Obtener clientes según filtros
    const recipients = await segmentation.getClients({
      storeId: params.storeId,
      tagIds: params.filters.tagIds,
      inactiveDays: params.filters.inactiveDays,
      hasPhone: params.channel === 'whatsapp',
      hasEmail: params.channel === 'email',
      isActive: true,
    });
    
    if (recipients.length === 0) {
      console.log('[Scheduler] No recipients for campaign');
      return null;
    }
    
    // Estimar costo
    const notificationService = getNotificationService();
    const costEstimate = notificationService.estimateCampaignCost(
      recipients.length,
      params.channel,
      'marketing'
    );
    
    // Crear campaña
    const { data: campaign, error: campaignError } = await supabase
      .from('notification_campaigns')
      .insert({
        store_id: params.storeId,
        name: params.name,
        type: params.filters.inactiveDays ? 'inactivity' : 
              params.filters.tagIds?.length ? 'tag_based' : 'custom',
        channel: params.channel,
        segmentation_filters: params.filters,
        message_template: params.message,
        subject: params.subject,
        status: params.scheduledFor ? 'scheduled' : 'draft',
        scheduled_for: params.scheduledFor?.toISOString(),
        total_recipients: recipients.length,
        estimated_cost: costEstimate.estimatedCost,
        cost_currency: costEstimate.currency,
        created_by: params.createdBy,
      })
      .select('id')
      .single();
    
    if (campaignError) {
      console.error('[Scheduler] Error creating campaign:', campaignError);
      return null;
    }
    
    // Si está programada, crear job
    if (params.scheduledFor) {
      await supabase.from('scheduled_notification_jobs').insert({
        type: 'campaign',
        status: 'pending',
        store_id: params.storeId,
        campaign_id: campaign.id,
        scheduled_for: params.scheduledFor.toISOString(),
        total_notifications: recipients.length,
      });
    }
    
    console.log(`[Scheduler] Campaign ${campaign.id} created with ${recipients.length} recipients`);
    return campaign.id;
  }
  
  /**
   * Ejecuta campaña masiva
   */
  async executeCampaign(campaignId: string): Promise<{
    success: boolean;
    sent: number;
    failed: number;
    error?: string;
  }> {
    // Obtener campaña
    const { data: campaign, error } = await supabase
      .from('notification_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();
    
    if (error || !campaign) {
      return { success: false, sent: 0, failed: 0, error: 'Campaign not found' };
    }
    
    // Marcar como ejecutándose
    await supabase
      .from('notification_campaigns')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .eq('id', campaignId);
    
    // Obtener destinatarios según filtros
    const segmentation = getSegmentationService();
    const recipients = await segmentation.getClients({
      storeId: campaign.store_id,
      ...(campaign.segmentation_filters as any),
      hasPhone: campaign.channel === 'whatsapp',
      hasEmail: campaign.channel === 'email',
      isActive: true,
    });
    
    // Enviar mensajes
    const notificationService = getNotificationService();
    const result = await notificationService.sendMassiveCampaign(
      recipients,
      campaign.message_template,
      campaign.channel,
      {
        campaignId,
        subject: campaign.subject,
        delayBetweenMs: 100,
      }
    );
    
    // Calcular costo real
    const actualCost = result.results
      .filter(r => r.success && r.cost)
      .reduce((sum, r) => sum + (r.cost?.amount || 0), 0);
    
    // Actualizar campaña con resultados
    await supabase
      .from('notification_campaigns')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        sent_count: result.sent,
        delivered_count: result.sent, // Se actualizará con webhooks
        failed_count: result.failed,
        actual_cost: actualCost,
      })
      .eq('id', campaignId);
    
    return {
      success: true,
      sent: result.sent,
      failed: result.failed,
    };
  }
  
  /**
   * Cancela campaña programada
   */
  async cancelCampaign(campaignId: string): Promise<boolean> {
    const { error } = await supabase
      .from('notification_campaigns')
      .update({ status: 'cancelled' })
      .eq('id', campaignId)
      .in('status', ['draft', 'scheduled']);
    
    if (error) {
      console.error('[Scheduler] Error cancelling campaign:', error);
      return false;
    }
    
    // Cancelar job asociado
    await supabase
      .from('scheduled_notification_jobs')
      .update({ status: 'cancelled' })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');
    
    return true;
  }
  
  /**
   * Procesa jobs pendientes (llamar desde cron)
   */
  async processScheduledJobs(): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    // Obtener jobs pendientes que ya deben ejecutarse
    const { data: jobs, error } = await supabase
      .from('scheduled_notification_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .limit(50);
    
    if (error || !jobs || jobs.length === 0) {
      return { processed: 0, successful: 0, failed: 0 };
    }
    
    let successful = 0;
    let failed = 0;
    
    for (const job of jobs) {
      // Marcar como ejecutándose
      await supabase
        .from('scheduled_notification_jobs')
        .update({
          status: 'running',
          started_at: new Date().toISOString(),
        })
        .eq('id', job.id);
      
      try {
        let result: { success: boolean; sent?: number; failed?: number };
        
        switch (job.type) {
          case 'reminder':
            result = await this.executeReminderJob(job);
            break;
          case 'campaign':
            result = await this.executeCampaign(job.campaign_id);
            break;
          default:
            result = { success: false };
        }
        
        // Actualizar job con resultado
        await supabase
          .from('scheduled_notification_jobs')
          .update({
            status: result.success ? 'completed' : 'failed',
            completed_at: new Date().toISOString(),
            success_count: result.sent || (result.success ? 1 : 0),
            fail_count: result.failed || (result.success ? 0 : 1),
          })
          .eq('id', job.id);
        
        if (result.success) {
          successful++;
        } else {
          failed++;
        }
      } catch (err) {
        console.error(`[Scheduler] Error processing job ${job.id}:`, err);
        
        await supabase
          .from('scheduled_notification_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            fail_count: 1,
          })
          .eq('id', job.id);
        
        failed++;
      }
    }
    
    return {
      processed: jobs.length,
      successful,
      failed,
    };
  }
  
  /**
   * Ejecuta job de recordatorio de turno
   */
  private async executeReminderJob(job: any): Promise<{ success: boolean }> {
    // Obtener datos del turno
    const { data: appointment, error } = await supabase
      .from('appointments')
      .select(`
        id,
        store_id,
        client_id,
        client_name,
        client_email,
        client_phone,
        service_name,
        service_price,
        date,
        time,
        status,
        public_token,
        stores:store_id (
          name
        )
      `)
      .eq('id', job.appointment_id)
      .single();
    
    if (error || !appointment) {
      console.error('[Scheduler] Appointment not found:', job.appointment_id);
      return { success: false };
    }
    
    // Solo enviar si el turno sigue pendiente o confirmado
    if (appointment.status === 'cancelled') {
      console.log('[Scheduler] Appointment cancelled, skipping reminder');
      return { success: true }; // No es un error, simplemente no enviamos
    }
    
    const appointmentData: AppointmentForNotification = {
      id: appointment.id,
      storeId: appointment.store_id,
      storeName: (appointment.stores as any)?.name || 'Tu negocio',
      clientId: appointment.client_id,
      clientName: appointment.client_name,
      clientEmail: appointment.client_email || undefined,
      clientPhone: appointment.client_phone || undefined,
      serviceName: appointment.service_name,
      servicePrice: appointment.service_price || 0,
      date: appointment.date,
      time: appointment.time,
      status: appointment.status,
      publicToken: appointment.public_token || undefined,
    };
    
    const notificationService = getNotificationService();
    const result = await notificationService.sendAppointmentReminder(appointmentData);
    
    return { success: result.success };
  }
  
  /**
   * Obtiene campañas de una tienda
   */
  async getCampaigns(storeId: string, limit: number = 20): Promise<any[]> {
    const { data, error } = await supabase
      .from('notification_campaigns')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('[Scheduler] Error fetching campaigns:', error);
      return [];
    }
    
    return data || [];
  }
  
  /**
   * Obtiene jobs programados de una tienda
   */
  async getScheduledJobs(storeId: string, limit: number = 20): Promise<any[]> {
    const { data, error } = await supabase
      .from('scheduled_notification_jobs')
      .select('*')
      .eq('store_id', storeId)
      .order('scheduled_for', { ascending: true })
      .limit(limit);
    
    if (error) {
      console.error('[Scheduler] Error fetching scheduled jobs:', error);
      return [];
    }
    
    return data || [];
  }
}

/**
 * Instancia singleton del scheduler
 */
let schedulerInstance: NotificationScheduler | null = null;

/**
 * Obtiene la instancia del scheduler
 */
export function getNotificationScheduler(): NotificationScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new NotificationScheduler();
  }
  return schedulerInstance;
}





