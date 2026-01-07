// =============================================================================
// API para importar eventos de Google Calendar y crear turnos
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
    const { storeId, daysAhead = 30 } = body;

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

    // Obtener eventos de Google Calendar
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + (daysAhead * 24 * 60 * 60 * 1000)).toISOString();

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessTokenGoogle}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Error obteniendo eventos de Google Calendar:', errorData);
      return new Response(JSON.stringify({ error: 'Error obteniendo eventos de Google Calendar' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const events = data.items || [];

      // Filtrar eventos que ya existen (por google_calendar_event_id)
      // Usar supabaseAdmin para evitar problemas de RLS
      const { data: existingAppointments } = await supabaseAdmin
        .from('appointments')
        .select('google_calendar_event_id')
        .eq('store_id', storeId)
        .not('google_calendar_event_id', 'is', null);

    const existingEventIds = new Set(
      (existingAppointments || []).map(apt => apt.google_calendar_event_id)
    );

    // Crear turnos para eventos nuevos
    let imported = 0;

    for (const event of events) {
      // Saltar si ya existe
      if (existingEventIds.has(event.id)) {
        continue;
      }

      // Saltar eventos todo el día o sin fecha/hora
      if (!event.start?.dateTime) {
        continue;
      }

      try {
        const startDate = new Date(event.start.dateTime);
        const endDate = event.end?.dateTime ? new Date(event.end.dateTime) : new Date(startDate.getTime() + 30 * 60000);
        const duration = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

        // Extraer nombre del cliente del summary o attendees
        let clientName = event.summary || 'Turno';
        let clientEmail = '';

        // Si el summary tiene formato "Servicio - Cliente", extraer cliente
        if (clientName.includes(' - ')) {
          const parts = clientName.split(' - ');
          if (parts.length > 1) {
            clientName = parts[parts.length - 1];
          }
        }

        // Buscar email en attendees
        if (event.attendees && event.attendees.length > 0) {
          const attendee = event.attendees.find((a: any) => a.email && !a.organizer);
          if (attendee) {
            clientEmail = attendee.email;
            // Si no hay nombre claro, usar el email como nombre
            if (clientName === 'Turno' || clientName === event.summary) {
              clientName = attendee.email.split('@')[0];
            }
          }
        }

        // Crear turno
        const appointmentData = {
          store_id: storeId,
          date: startDate.toISOString().split('T')[0],
          time: `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`,
          duration: duration > 0 ? duration : 30,
          client_name: clientName,
          client_email: clientEmail || '',
          client_phone: '',
          service_name: event.summary || 'Turno',
          service_price: 0,
          status: 'pending',
          notes: event.description || '',
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          google_calendar_event_id: event.id,
          imported_from_google_calendar: true, // Marcar como importado para evitar notificaciones
        };

        // Usar supabaseAdmin para insertar porque necesitamos acceso sin restricciones RLS
        await supabaseAdmin
          .from('appointments')
          .insert(appointmentData);

        imported++;
      } catch (error) {
        console.error(`Error importando evento ${event.id}:`, error);
      }
    }

    return new Response(JSON.stringify({ success: true, imported, total: events.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error en /api/google-calendar/import-events:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

