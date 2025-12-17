// =============================================================================
// API para gestión de campañas masivas de notificaciones
// =============================================================================

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getNotificationScheduler } from '../../../lib/notifications/scheduler';
import { getSegmentationService } from '../../../lib/notifications/segmentation';
import { getNotificationService } from '../../../lib/notifications';
import type { NotificationChannel } from '../../../config/notifications';

/**
 * GET: Obtiene campañas de la tienda
 */
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const storeId = url.searchParams.get('store_id');
  
  if (!storeId) {
    return new Response(JSON.stringify({ error: 'store_id required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  try {
    const scheduler = getNotificationScheduler();
    const campaigns = await scheduler.getCampaigns(storeId);
    
    return new Response(JSON.stringify({ campaigns }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Campaigns API] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/**
 * POST: Crea o ejecuta una campaña
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      action,
      store_id,
      campaign_id,
      name,
      message,
      channel,
      subject,
      filters,
      scheduled_for,
      execute_now,
    } = body;
    
    // Acción: Ejecutar campaña existente
    if (action === 'execute' && campaign_id) {
      const scheduler = getNotificationScheduler();
      const result = await scheduler.executeCampaign(campaign_id);
      
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Acción: Cancelar campaña
    if (action === 'cancel' && campaign_id) {
      const scheduler = getNotificationScheduler();
      const success = await scheduler.cancelCampaign(campaign_id);
      
      return new Response(JSON.stringify({ success }), {
        status: success ? 200 : 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Acción: Preview (cuenta destinatarios)
    if (action === 'preview' && store_id && filters) {
      const segmentation = getSegmentationService();
      const recipients = await segmentation.getClients({
        storeId: store_id,
        ...filters,
        hasPhone: channel === 'whatsapp',
        hasEmail: channel === 'email',
        isActive: true,
      });
      
      const notificationService = getNotificationService();
      const costEstimate = notificationService.estimateCampaignCost(
        recipients.length,
        channel || 'whatsapp',
        'marketing'
      );
      
      return new Response(JSON.stringify({
        recipient_count: recipients.length,
        ...costEstimate,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Crear nueva campaña
    if (!store_id || !name || !message || !channel) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: store_id, name, message, channel',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const scheduler = getNotificationScheduler();
    const campaignId = await scheduler.scheduleMassiveCampaign({
      storeId: store_id,
      name,
      message,
      channel: channel as NotificationChannel,
      filters: filters || {},
      scheduledFor: scheduled_for ? new Date(scheduled_for) : undefined,
      subject,
    });
    
    if (!campaignId) {
      return new Response(JSON.stringify({
        error: 'Failed to create campaign (no recipients found)',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Si se solicita ejecución inmediata
    if (execute_now) {
      const result = await scheduler.executeCampaign(campaignId);
      return new Response(JSON.stringify({
        campaign_id: campaignId,
        ...result,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      campaign_id: campaignId,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Campaigns API] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal server error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};






