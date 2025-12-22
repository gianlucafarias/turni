// =============================================================================
// API para iniciar el flujo OAuth de Google Calendar
// =============================================================================

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

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
      .select('id')
      .eq('id', storeId)
      .eq('user_id', user.id)
      .single();

    if (storeError || !store) {
      return new Response(JSON.stringify({ error: 'Tienda no encontrada o no autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // TODO: Configurar estas variables de entorno en tu servidor
    // GOOGLE_CLIENT_ID=tu-client-id
    // GOOGLE_CLIENT_SECRET=tu-client-secret
    // GOOGLE_REDIRECT_URI=https://tu-dominio.com/api/google-calendar/callback
    
    const clientId = import.meta.env.GOOGLE_CLIENT_ID;
    const redirectUri = import.meta.env.GOOGLE_REDIRECT_URI || `${new URL(request.url).origin}/api/google-calendar/callback`;
    
    if (!clientId) {
      console.error('GOOGLE_CLIENT_ID no está configurado');
      return new Response(JSON.stringify({ error: 'Configuración de Google Calendar no disponible' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Log para debug (remover en producción)
    console.log('Redirect URI que se está usando:', redirectUri);
    console.log('Request origin:', new URL(request.url).origin);

    // Generar state para seguridad (incluir storeId)
    const state = Buffer.from(JSON.stringify({ storeId, userId: user.id })).toString('base64');

    // Construir URL de autorización de Google
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ].join(' ');

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('access_type', 'offline'); // Necesario para obtener refresh_token
    authUrl.searchParams.set('prompt', 'consent'); // Forzar consent para obtener refresh_token
    authUrl.searchParams.set('state', state);

    // Log para debug
    console.log('URL de autorización completa:', authUrl.toString());

    return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error en /api/google-calendar/auth:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

