// =============================================================================
// API para crear un evento en Google Calendar cuando se crea un turno
// =============================================================================

import type { APIRoute } from 'astro';
import { supabase, supabaseAdmin } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Verificar autenticación (opcional, ya que también puede ser llamado desde BookingWidget)
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7)
      : null;
    const accessToken = bearerToken || cookies.get('sb-access-token')?.value;

    // Parsear body
    const body = await request.json();
    const { appointmentId, storeId } = body;

    if (!appointmentId || !storeId) {
      return new Response(JSON.stringify({ error: 'appointmentId y storeId son requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Obtener el turno
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .eq('store_id', storeId)
      .single();

    if (appointmentError || !appointment) {
      return new Response(JSON.stringify({ error: 'Turno no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verificar si la tienda tiene Google Calendar conectado
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, google_calendar_connected')
      .eq('id', storeId)
      .single();

    if (storeError || !store || !store.google_calendar_connected) {
      return new Response(JSON.stringify({ success: false, message: 'Google Calendar no conectado' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Obtener tokens usando supabaseAdmin porque necesitamos acceso sin restricciones RLS
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('google_calendar_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('store_id', storeId)
      .single();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ error: 'Tokens no encontrados' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verificar y renovar token si es necesario
    let accessToken = tokenData.access_token;
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    const isExpired = expiresAt.getTime() <= now.getTime() + 60000; // 1 minuto de margen

    if (isExpired) {
      const clientId = import.meta.env.GOOGLE_CLIENT_ID;
      const clientSecret = import.meta.env.GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return new Response(JSON.stringify({ error: 'Configuración de Google Calendar no disponible' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: tokenData.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        return new Response(JSON.stringify({ error: 'Error renovando token' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const newTokens = await refreshResponse.json();
      accessToken = newTokens.access_token;
      const newExpiresAt = new Date(Date.now() + (newTokens.expires_in * 1000));

      await supabaseAdmin
        .from('google_calendar_tokens')
        .update({
          access_token: newTokens.access_token,
          expires_at: newExpiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('store_id', storeId);
    }

    // Construir fecha/hora de inicio y fin
    const startDateTime = appointment.start_time 
      ? new Date(appointment.start_time)
      : new Date(`${appointment.date}T${appointment.time}`);
    
    const endDateTime = appointment.end_time
      ? new Date(appointment.end_time)
      : new Date(startDateTime.getTime() + (appointment.duration * 60000));

    const timeZone = 'America/Argentina/Buenos_Aires'; // TODO: Obtener de configuración de la tienda

    // Construir evento
    const event: any = {
      summary: `${appointment.service_name || 'Turno'} - ${appointment.client_name}`,
      description: appointment.notes || undefined,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone,
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone,
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 día antes
          { method: 'popup', minutes: 30 }, // 30 minutos antes
        ],
      },
    };

    // Agregar cliente como asistente si tiene email
    if (appointment.client_email) {
      event.attendees = [
        {
          email: appointment.client_email,
        },
      ];
    }

    // Crear evento en Google Calendar
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Error creando evento en Google Calendar:', errorData);
      return new Response(JSON.stringify({ error: 'Error creando evento en Google Calendar' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const createdEvent = await response.json();

    // Actualizar el turno con el ID del evento de Google Calendar
    await supabase
      .from('appointments')
      .update({ google_calendar_event_id: createdEvent.id })
      .eq('id', appointmentId);

    return new Response(JSON.stringify({ success: true, eventId: createdEvent.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error en /api/google-calendar/create-event:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

