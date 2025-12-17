// =============================================================================
// Webhook de WhatsApp Cloud API
// Recibe notificaciones de estado de mensajes y mensajes entrantes
// Documentación: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
// =============================================================================

import type { APIRoute } from 'astro';
import type { WhatsAppWebhookPayload, NotificationStatus } from '../../../lib/notifications/types';
import { supabase } from '../../../lib/supabase';

/**
 * GET: Verificación del webhook (requerido por Meta)
 */
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  
  // Token de verificación configurado en Meta Business Suite
  const verifyToken = import.meta.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WhatsApp Webhook] Verification successful');
    return new Response(challenge, { status: 200 });
  }
  
  console.log('[WhatsApp Webhook] Verification failed', { mode, token });
  return new Response('Forbidden', { status: 403 });
};

/**
 * POST: Recibe notificaciones de WhatsApp
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.json() as WhatsAppWebhookPayload;
    
    // Verificar que sea de WhatsApp Business
    if (payload.object !== 'whatsapp_business_account') {
      return new Response('OK', { status: 200 });
    }
    
    // Procesar cada entry
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') continue;
        
        const { value } = change;
        
        // Procesar actualizaciones de estado de mensajes
        if (value.statuses) {
          for (const status of value.statuses) {
            await processMessageStatus(status);
          }
        }
        
        // Procesar mensajes entrantes (opcional: para respuestas)
        if (value.messages) {
          for (const message of value.messages) {
            await processIncomingMessage(message, value.metadata);
          }
        }
      }
    }
    
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('[WhatsApp Webhook] Error processing webhook:', error);
    // Siempre devolver 200 para evitar reintentos de Meta
    return new Response('OK', { status: 200 });
  }
};

/**
 * Procesa actualización de estado de mensaje
 */
async function processMessageStatus(status: {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    origin: { type: string };
    expiration_timestamp?: string;
  };
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
  errors?: Array<{
    code: number;
    title: string;
    message: string;
  }>;
}) {
  const messageId = status.id;
  const newStatus = mapWhatsAppStatus(status.status);
  const timestamp = new Date(parseInt(status.timestamp) * 1000);
  
  console.log(`[WhatsApp Webhook] Status update: ${messageId} -> ${newStatus}`);
  
  // Actualizar log de notificación en la base de datos
  const updateData: Record<string, any> = {
    status: newStatus,
    updated_at: timestamp.toISOString(),
  };
  
  // Agregar info de pricing si está disponible
  if (status.pricing) {
    updateData.cost_currency = 'USD';
    updateData.message_category = status.pricing.category;
    // El costo real se obtiene del rate card
  }
  
  // Agregar error si falló
  if (status.errors && status.errors.length > 0) {
    updateData.error_code = String(status.errors[0].code);
    updateData.error_message = status.errors[0].message;
  }
  
  // Actualizar en notification_logs
  const { error } = await supabase
    .from('notification_logs')
    .update(updateData)
    .eq('external_message_id', messageId);
  
  if (error) {
    console.error('[WhatsApp Webhook] Error updating notification log:', error);
  }
  
  // También actualizar el historial de estados (jsonb append)
  const statusHistoryEntry = {
    status: newStatus,
    timestamp: timestamp.toISOString(),
    details: status.errors?.[0]?.message || undefined,
  };
  
  await supabase.rpc('append_notification_status_history', {
    p_message_id: messageId,
    p_status_entry: statusHistoryEntry,
  });
}

/**
 * Procesa mensaje entrante (para respuestas de clientes)
 */
async function processIncomingMessage(
  message: {
    from: string;
    id: string;
    timestamp: string;
    type: string;
    text?: { body: string };
  },
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  }
) {
  console.log(`[WhatsApp Webhook] Incoming message from ${message.from}: ${message.text?.body || '[no text]'}`);
  
  // Guardar mensaje entrante para posible seguimiento
  // Esto puede usarse para detectar palabras clave como "CANCELAR" o "CONFIRMAR"
  
  if (message.type === 'text' && message.text?.body) {
    const body = message.text.body.toLowerCase().trim();
    
    // Procesar comandos comunes
    if (body === 'stop' || body === 'cancelar' || body === 'baja') {
      await handleOptOut(message.from);
    } else if (body === 'confirmar' || body === 'si' || body === 'sí') {
      await handleAppointmentConfirmation(message.from);
    }
  }
}

/**
 * Mapea estado de WhatsApp a nuestro sistema
 */
function mapWhatsAppStatus(waStatus: string): NotificationStatus {
  switch (waStatus) {
    case 'sent':
      return 'sent';
    case 'delivered':
      return 'delivered';
    case 'read':
      return 'read';
    case 'failed':
      return 'failed';
    default:
      return 'pending';
  }
}

/**
 * Maneja opt-out de cliente
 */
async function handleOptOut(phoneNumber: string) {
  // Buscar cliente por teléfono y marcar opt-out
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, store_id')
    .eq('phone', phoneNumber);
  
  if (!error && clients && clients.length > 0) {
    // Actualizar preferencias de notificación (si existe la tabla)
    for (const client of clients) {
      await supabase
        .from('client_notification_preferences')
        .upsert({
          client_id: client.id,
          store_id: client.store_id,
          whatsapp_enabled: false,
          updated_at: new Date().toISOString(),
          opt_out_reason: 'User requested via WhatsApp',
        }, {
          onConflict: 'client_id,store_id',
        });
    }
    
    console.log(`[WhatsApp Webhook] Client opted out: ${phoneNumber}`);
  }
}

/**
 * Maneja confirmación de turno via WhatsApp
 */
async function handleAppointmentConfirmation(phoneNumber: string) {
  // Buscar turnos pendientes del cliente para hoy o mañana
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('id, client_phone, status')
    .eq('client_phone', phoneNumber)
    .eq('status', 'pending')
    .gte('date', today.toISOString().split('T')[0])
    .lte('date', tomorrow.toISOString().split('T')[0])
    .limit(1);
  
  if (!error && appointments && appointments.length > 0) {
    // Confirmar el turno
    const { error: updateError } = await supabase
      .from('appointments')
      .update({ status: 'confirmed' })
      .eq('id', appointments[0].id);
    
    if (!updateError) {
      console.log(`[WhatsApp Webhook] Appointment confirmed via WhatsApp: ${appointments[0].id}`);
    }
  }
}






