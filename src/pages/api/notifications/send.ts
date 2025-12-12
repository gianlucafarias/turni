// =============================================================================
// API para envío manual de notificaciones
// =============================================================================

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getNotificationService } from '../../../lib/notifications';
import type { AppointmentForNotification, NotificationRecipient } from '../../../lib/notifications/types';

/**
 * POST: Envía una notificación manual
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { type, appointment_id, client_id, store_id, channel } = body;
    
    const notificationService = getNotificationService();
    
    // Notificación de turno
    if (type === 'appointment_reminder' || type === 'appointment_confirmed') {
      if (!appointment_id) {
        return new Response(JSON.stringify({ error: 'appointment_id required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
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
        .eq('id', appointment_id)
        .single();
      
      if (error || !appointment) {
        return new Response(JSON.stringify({ error: 'Appointment not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
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
      
      let result;
      if (type === 'appointment_reminder') {
        result = await notificationService.sendAppointmentReminder(appointmentData);
      } else {
        result = await notificationService.sendAppointmentConfirmed(appointmentData);
      }
      
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Notificación de inactividad a cliente específico
    if (type === 'inactivity_reminder') {
      if (!client_id || !store_id) {
        return new Response(JSON.stringify({
          error: 'client_id and store_id required',
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Obtener datos del cliente y tienda
      const [clientResult, storeResult] = await Promise.all([
        supabase
          .from('clients')
          .select('id, first_name, last_name, email, phone, store_id')
          .eq('id', client_id)
          .single(),
        supabase
          .from('stores')
          .select('name')
          .eq('id', store_id)
          .single(),
      ]);
      
      if (clientResult.error || !clientResult.data) {
        return new Response(JSON.stringify({ error: 'Client not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      const recipient: NotificationRecipient = {
        id: clientResult.data.id,
        firstName: clientResult.data.first_name,
        lastName: clientResult.data.last_name || undefined,
        email: clientResult.data.email || undefined,
        phone: clientResult.data.phone || undefined,
        storeId: clientResult.data.store_id,
      };
      
      const storeName = storeResult.data?.name || 'Tu negocio';
      
      const result = await notificationService.sendInactivityReminder(
        recipient,
        storeName,
        channel || undefined
      );
      
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({ error: 'Invalid notification type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Send Notification API] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal server error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};





