// =============================================================================
// API para sincronización bidireccional automática
// Exporta turnos existentes a Google Calendar e importa eventos de Google Calendar
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
    const { storeId, daysAhead = 90 } = body;

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

    if (storeError || !store || !store.google_calendar_connected) {
      return new Response(JSON.stringify({ error: 'Tienda no encontrada o Google Calendar no conectado' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Obtener tokens
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

    const timeZone = 'America/Argentina/Buenos_Aires';
    let exported = 0;
    let imported = 0;

    // =============================================================================
    // PASO 1: Exportar turnos existentes a Google Calendar
    // =============================================================================
    // IMPORTANTE: Excluir los que fueron importados de Google Calendar para evitar duplicados
    const { data: appointmentsToExport, error: appointmentsError } = await supabaseAdmin
      .from('appointments')
      .select('*')
      .eq('store_id', storeId)
      .is('google_calendar_event_id', null) // Solo los que no tienen evento en Google Calendar
      .eq('imported_from_google_calendar', false) // No sincronizar los que fueron importados
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (!appointmentsError && appointmentsToExport) {
      for (const appointment of appointmentsToExport) {
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
            
            // Actualizar el turno con el ID del evento
            await supabaseAdmin
              .from('appointments')
              .update({ google_calendar_event_id: createdEvent.id })
              .eq('id', appointment.id);
            
            exported++;
          }
        } catch (error) {
          console.error(`Error exportando turno ${appointment.id}:`, error);
        }
      }
    }

    // =============================================================================
    // PASO 2: Importar eventos de Google Calendar
    // =============================================================================
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

    if (response.ok) {
      const data = await response.json();
      const events = data.items || [];

      // Obtener todos los google_calendar_event_id existentes para evitar duplicados
      const { data: existingAppointments } = await supabaseAdmin
        .from('appointments')
        .select('google_calendar_event_id')
        .eq('store_id', storeId)
        .not('google_calendar_event_id', 'is', null);

      const existingEventIds = new Set(
        (existingAppointments || []).map(apt => apt.google_calendar_event_id)
      );

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

          await supabaseAdmin
            .from('appointments')
            .insert(appointmentData);

          imported++;
        } catch (error) {
          console.error(`Error importando evento ${event.id}:`, error);
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      exported, 
      imported,
      message: `Se exportaron ${exported} turnos a Google Calendar y se importaron ${imported} eventos.`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error en /api/google-calendar/sync-bidirectional:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

