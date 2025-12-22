// =============================================================================
// API para sincronizar turnos existentes con Google Calendar
// =============================================================================

import type { APIRoute } from 'astro';
import { supabase, supabaseAdmin } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7)
      : null;
    const accessToken = bearerToken || cookies.get('sb-access-token')?.value;
    
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Obtener usuario actual
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parsear body
    const body = await request.json();
    const { storeId } = body;

    if (!storeId) {
      return new Response(JSON.stringify({ error: 'storeId es requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verificar que el usuario es dueño de la tienda
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, google_calendar_connected')
      .eq('id', storeId)
      .eq('user_id', user.id)
      .single();

    if (storeError) {
      console.error('Error obteniendo store:', storeError);
      return new Response(JSON.stringify({ error: 'Error obteniendo tienda: ' + storeError.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!store) {
      return new Response(JSON.stringify({ error: 'Tienda no encontrada' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!store.google_calendar_connected) {
      return new Response(JSON.stringify({ error: 'Google Calendar no está conectado para esta tienda' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Obtener todos los turnos que no tienen google_calendar_event_id
    // IMPORTANTE: Excluir los que fueron importados de Google Calendar para evitar duplicados
    const { data: appointments, error: appointmentsError } = await supabaseAdmin
      .from('appointments')
      .select('*')
      .eq('store_id', storeId)
      .is('google_calendar_event_id', null)
      .eq('imported_from_google_calendar', false) // No sincronizar los que fueron importados
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (appointmentsError) {
      return new Response(JSON.stringify({ error: 'Error obteniendo turnos' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!appointments || appointments.length === 0) {
      return new Response(JSON.stringify({ success: true, synced: 0, message: 'No hay turnos para sincronizar' }), {
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
    let accessTokenGoogle = tokenData.access_token;
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    const isExpired = expiresAt.getTime() <= now.getTime() + 60000;

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
      accessTokenGoogle = newTokens.access_token;
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

    // Sincronizar cada turno
    let synced = 0;
    const timeZone = 'America/Argentina/Buenos_Aires';

    for (const appointment of appointments) {
      try {
        // Construir fecha/hora de inicio y fin
        const startDateTime = appointment.start_time 
          ? new Date(appointment.start_time)
          : new Date(`${appointment.date}T${appointment.time}`);
        
        const endDateTime = appointment.end_time
          ? new Date(appointment.end_time)
          : new Date(startDateTime.getTime() + (appointment.duration * 60000));

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

        // Crear evento en Google Calendar
        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessTokenGoogle}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });

        if (response.ok) {
          const createdEvent = await response.json();
          
          // Actualizar el turno con el ID del evento usando supabaseAdmin
          await supabaseAdmin
            .from('appointments')
            .update({ google_calendar_event_id: createdEvent.id })
            .eq('id', appointment.id);
          
          synced++;
        } else {
          console.error(`Error sincronizando turno ${appointment.id}:`, await response.text());
        }
      } catch (error) {
        console.error(`Error procesando turno ${appointment.id}:`, error);
      }
    }

    return new Response(JSON.stringify({ success: true, synced }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error en /api/google-calendar/sync-existing:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

