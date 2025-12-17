// =============================================================================
// Endpoint de debug para probar notificaciones de WhatsApp
// =============================================================================

import type { APIRoute } from 'astro';
import { getWhatsAppClient } from '../../../lib/notifications/whatsapp';
import { getNotificationService } from '../../../lib/notifications';

/**
 * GET: Verifica configuración y envía un mensaje de prueba
 */
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const testPhone = url.searchParams.get('phone');
  const appointmentId = url.searchParams.get('appointment_id');
  
  const whatsapp = getWhatsAppClient();
  
  // Verificar configuración
  const configStatus = {
    isConfigured: whatsapp.isConfigured(),
    hasApiToken: !!import.meta.env.WHATSAPP_API_TOKEN,
    hasPhoneNumberId: !!import.meta.env.WHATSAPP_PHONE_NUMBER_ID,
    hasBusinessAccountId: !!import.meta.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    apiToken: import.meta.env.WHATSAPP_API_TOKEN?.substring(0, 20) + '...' || 'NO SET',
    phoneNumberId: import.meta.env.WHATSAPP_PHONE_NUMBER_ID || 'NO SET',
    businessAccountId: import.meta.env.WHATSAPP_BUSINESS_ACCOUNT_ID || 'NO SET',
  };
  
  // Si no hay teléfono o appointment_id, solo retornar estado
  if (!testPhone && !appointmentId) {
    return new Response(JSON.stringify({
      status: 'ready',
      config: configStatus,
      usage: 'Add ?phone=5491123456789 or ?appointment_id=xxx to test',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // Si hay appointment_id, obtener datos del turno
  if (appointmentId) {
    const { supabase } = await import('../../../lib/supabase');
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
      return new Response(JSON.stringify({
        error: 'Appointment not found',
        details: error,
        config: configStatus,
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const appointmentData = {
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
    
    return new Response(JSON.stringify({
      config: configStatus,
      appointment: appointmentData,
      result,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // Test con teléfono directo (solo formateo)
  if (testPhone) {
    // @ts-ignore - acceder al método privado para debug
    const formatted = whatsapp['formatPhoneNumber'](testPhone);
    
    return new Response(JSON.stringify({
      config: configStatus,
      phone: {
        original: testPhone,
        formatted,
      },
      note: 'Para enviar un mensaje real, usa ?appointment_id=xxx',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  return new Response(JSON.stringify({ error: 'Invalid parameters' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
};

