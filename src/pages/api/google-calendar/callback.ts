// =============================================================================
// API para manejar el callback de OAuth de Google Calendar
// =============================================================================

import type { APIRoute } from 'astro';
import { supabase, supabaseAdmin } from '../../../lib/supabase';

async function handleCallback(request: Request, code: string, state: string) {
  try {
    if (!code || !state) {
      return new Response(JSON.stringify({ error: 'Faltan parámetros requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Decodificar state
    let decodedState;
    try {
      decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (e) {
      return new Response(JSON.stringify({ error: 'State inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const storeId = decodedState.storeId;
    if (!storeId) {
      return new Response(JSON.stringify({ error: 'storeId no encontrado en state' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // TODO: Configurar estas variables de entorno
    const clientId = import.meta.env.GOOGLE_CLIENT_ID;
    const clientSecret = import.meta.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = import.meta.env.GOOGLE_REDIRECT_URI || `${new URL(request.url).origin}/api/google-calendar/callback`;

    if (!clientId || !clientSecret) {
      console.error('GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET no están configurados');
      return new Response(JSON.stringify({ error: 'Configuración de Google Calendar no disponible' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Intercambiar código por tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Error intercambiando código por tokens:', errorData);
      return new Response(JSON.stringify({ error: 'Error al obtener tokens de Google' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    if (!access_token || !refresh_token) {
      return new Response(JSON.stringify({ error: 'No se recibieron tokens válidos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Guardar tokens en la base de datos (encriptados)
    // Crear o actualizar registro en una tabla google_calendar_tokens
    const expiresAt = new Date(Date.now() + (expires_in * 1000));

    // Verificar si ya existe un registro
    const { data: existingToken } = await supabase
      .from('google_calendar_tokens')
      .select('id')
      .eq('store_id', storeId)
      .single();

    const tokenData = {
      store_id: storeId,
      access_token, // En producción, encriptar esto
      refresh_token, // En producción, encriptar esto
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existingToken) {
      // Actualizar usando supabaseAdmin porque no hay sesión de usuario
      const { error: tokenUpdateError } = await supabaseAdmin
        .from('google_calendar_tokens')
        .update(tokenData)
        .eq('store_id', storeId);
      
      if (tokenUpdateError) {
        console.error('Error actualizando tokens:', tokenUpdateError);
        throw tokenUpdateError;
      }
    } else {
      // Crear usando supabaseAdmin porque no hay sesión de usuario
      const { error: tokenInsertError } = await supabaseAdmin
        .from('google_calendar_tokens')
        .insert(tokenData);
      
      if (tokenInsertError) {
        console.error('Error insertando tokens:', tokenInsertError);
        throw tokenInsertError;
      }
    }

    // Actualizar flag en stores usando supabaseAdmin porque no hay sesión de usuario en el callback
    const { error: updateError, data: updateData } = await supabaseAdmin
      .from('stores')
      .update({ google_calendar_connected: true })
      .eq('id', storeId)
      .select('id, google_calendar_connected')
      .single();
    
    if (updateError) {
      console.error('Error actualizando google_calendar_connected:', updateError);
      throw updateError;
    }
    
    console.log('Successfully updated google_calendar_connected to true for store:', storeId, 'Result:', updateData);

    return { success: true, storeId };
  } catch (error) {
    console.error('Error en handleCallback:', error);
    throw error;
  }
}

// GET handler - Google redirige aquí con code y state en la URL
export const GET: APIRoute = async ({ request, url }) => {
  try {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      // Redirigir a la página de configuración con error
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/dashboard/store?google_calendar_error=missing_params',
        },
      });
    }

    
    // Redirigir a la página de configuración con éxito
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/dashboard/store?google_calendar_success=true',
      },
    });
  } catch (error) {
    console.error('Error en GET /api/google-calendar/callback:', error);
    // Redirigir con error
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/dashboard/store?google_calendar_error=server_error',
      },
    });
  }
};

// POST handler - Para llamadas desde el frontend (backup)
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { code, state } = body;

    const result = await handleCallback(request, code, state);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error en POST /api/google-calendar/callback:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

