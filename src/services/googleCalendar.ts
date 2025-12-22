// =============================================================================
// Servicio para sincronizar turnos con Google Calendar
// =============================================================================

import { supabase } from '../lib/supabase';

interface GoogleCalendarEvent {
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees?: Array<{
    email: string;
  }>;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: string;
      minutes: number;
    }>;
  };
}

interface Appointment {
  id: string;
  store_id: string;
  client_name: string;
  client_email: string;
  date: string;
  time: string;
  duration: number;
  service_name?: string;
  notes?: string;
  start_time?: string;
  end_time?: string;
}

/**
 * Obtiene un access token válido (renovando si es necesario)
 */
async function getValidAccessToken(storeId: string): Promise<string | null> {
  try {
    // Obtener tokens de la base de datos
    const { data: tokenData, error } = await supabase
      .from('google_calendar_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('store_id', storeId)
      .single();

    if (error || !tokenData) {
      console.error('No se encontraron tokens para la tienda:', storeId);
      return null;
    }

    // Verificar si el token está expirado
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    const isExpired = expiresAt.getTime() <= now.getTime() + 60000; // 1 minuto de margen

    if (!isExpired) {
      return tokenData.access_token;
    }

    // Renovar token
    const clientId = import.meta.env.GOOGLE_CLIENT_ID;
    const clientSecret = import.meta.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET no configurados');
      return null;
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
      console.error('Error renovando token:', await refreshResponse.text());
      return null;
    }

    const newTokens = await refreshResponse.json();
    const newExpiresAt = new Date(Date.now() + (newTokens.expires_in * 1000));

    // Actualizar tokens en la base de datos
    await supabase
      .from('google_calendar_tokens')
      .update({
        access_token: newTokens.access_token,
        expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('store_id', storeId);

    return newTokens.access_token;
  } catch (error) {
    console.error('Error obteniendo access token:', error);
    return null;
  }
}

/**
 * Crea un evento en Google Calendar
 */
export async function createGoogleCalendarEvent(
  appointment: Appointment
): Promise<string | null> {
  try {
    // Verificar si la tienda tiene Google Calendar conectado
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, google_calendar_connected')
      .eq('id', appointment.store_id)
      .single();

    if (storeError || !store || !store.google_calendar_connected) {
      return null; // No está conectado, no hacer nada
    }

    // Obtener access token válido
    const accessToken = await getValidAccessToken(appointment.store_id);
    if (!accessToken) {
      console.error('No se pudo obtener access token');
      return null;
    }

    // Construir fecha/hora de inicio y fin
    const startDateTime = appointment.start_time 
      ? new Date(appointment.start_time)
      : new Date(`${appointment.date}T${appointment.time}`);
    
    const endDateTime = appointment.end_time
      ? new Date(appointment.end_time)
      : new Date(startDateTime.getTime() + (appointment.duration * 60000));

    // Obtener timezone de la tienda (por defecto usar UTC)
    const timeZone = 'America/Argentina/Buenos_Aires'; // TODO: Obtener de configuración de la tienda

    // Construir evento
    const event: GoogleCalendarEvent = {
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
      return null;
    }

    const createdEvent = await response.json();
    return createdEvent.id;
  } catch (error) {
    console.error('Error en createGoogleCalendarEvent:', error);
    return null;
  }
}

/**
 * Actualiza un evento en Google Calendar
 */
export async function updateGoogleCalendarEvent(
  appointment: Appointment,
  googleEventId: string
): Promise<boolean> {
  try {
    // Verificar si la tienda tiene Google Calendar conectado
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, google_calendar_connected')
      .eq('id', appointment.store_id)
      .single();

    if (storeError || !store || !store.google_calendar_connected) {
      return false;
    }

    // Obtener access token válido
    const accessToken = await getValidAccessToken(appointment.store_id);
    if (!accessToken) {
      return false;
    }

    // Construir fecha/hora de inicio y fin
    const startDateTime = appointment.start_time 
      ? new Date(appointment.start_time)
      : new Date(`${appointment.date}T${appointment.time}`);
    
    const endDateTime = appointment.end_time
      ? new Date(appointment.end_time)
      : new Date(startDateTime.getTime() + (appointment.duration * 60000));

    const timeZone = 'America/Argentina/Buenos_Aires';

    // Construir evento actualizado
    const event: GoogleCalendarEvent = {
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
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 },
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

    // Actualizar evento en Google Calendar
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Error en updateGoogleCalendarEvent:', error);
    return false;
  }
}

/**
 * Elimina un evento de Google Calendar
 */
export async function deleteGoogleCalendarEvent(
  storeId: string,
  googleEventId: string
): Promise<boolean> {
  try {
    // Verificar si la tienda tiene Google Calendar conectado
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, google_calendar_connected')
      .eq('id', storeId)
      .single();

    if (storeError || !store || !store.google_calendar_connected) {
      return false;
    }

    // Obtener access token válido
    const accessToken = await getValidAccessToken(storeId);
    if (!accessToken) {
      return false;
    }

    // Eliminar evento de Google Calendar
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Error en deleteGoogleCalendarEvent:', error);
    return false;
  }
}




