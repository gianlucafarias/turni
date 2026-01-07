import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import type { Database } from '../../../lib/db/schema';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Función para decodificar el JWT y obtener el user_id
function getUserIdFromToken(token: string): string | null {
  try {
    // Los JWTs tienen formato: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    // Decodificar el payload (segunda parte)
    // Usar Buffer para Node.js o atob para navegador
    let payloadStr: string;
    if (typeof Buffer !== 'undefined') {
      // Entorno Node.js
      payloadStr = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    } else {
      // Entorno navegador
      payloadStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    }
    
    const payload = JSON.parse(payloadStr);
    return payload.sub || payload.user_id || null;
  } catch (error) {
    console.error('Error al decodificar token:', error);
    return null;
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('Iniciando creación de tienda...');
    
    const body = await request.json();
    const { name, user_id, store_type } = body;

    console.log('Datos recibidos:', { name, user_id, store_type });

    if (!name || !user_id || !store_type) {
      console.error('Faltan campos requeridos:', { name, user_id, store_type });
      return new Response(
        JSON.stringify({
          error: 'Faltan campos requeridos',
          details: { name, user_id, store_type }
        }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Obtener el token de autorización del header
    const authHeader = request.headers.get('Authorization');
    let supabaseClient;
    let userId: string | null = null;

    // Si viene un token en el header, crear cliente con ese token
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      console.log('Token recibido en header, creando cliente con token');
      userId = getUserIdFromToken(token);
      console.log('User ID extraído del token:', userId);
      
      // Crear cliente con el token para autenticar correctamente
      supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
    } else {
      // Intentar obtener la sesión usando el cliente compartido
      console.log('No hay token en header, intentando obtener sesión...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Error al obtener sesión:', sessionError);
      }

      if (session) {
        userId = session.user.id;
        console.log('User ID obtenido de sesión:', userId);
        // Crear cliente con el token de la sesión
        supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        });
      } else {
        // Si no hay sesión, usar el cliente compartido (puede funcionar con cookies)
        console.log('No hay sesión, usando cliente compartido');
        supabaseClient = supabase;
      }
    }

    // Verificar que tenemos un cliente válido
    if (!supabaseClient) {
      console.error('No se pudo crear cliente de Supabase');
      return new Response(
        JSON.stringify({
          error: 'No autorizado',
          details: 'Se requiere autenticación para crear una tienda'
        }),
        { 
          status: 401,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Si no hay userId del token/sesión, usar el del body (caso de registro reciente)
    if (!userId) {
      userId = user_id;
      console.log('Usando user_id del body:', userId);
    }

    // Verificar que el usuario autenticado coincide con el user_id proporcionado
    if (userId && userId !== user_id) {
      console.error('Usuario no autorizado:', { sessionUserId: userId, providedUserId: user_id });
      return new Response(
        JSON.stringify({
          error: 'No autorizado',
          details: 'El usuario autenticado no coincide con el user_id proporcionado'
        }),
        { 
          status: 401,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Usar el userId verificado
    const finalUserId = userId || user_id;
    console.log('Usuario verificado:', finalUserId);

    // Crear la tienda usando el cliente con autenticación correcta
    const { data: store, error: storeError } = await supabaseClient
      .from('stores')
      .insert({
        name,
        user_id: finalUserId,
        store_type,
        plan: 'free',
        products_count: 0,
      })
      .select()
      .single();

    if (storeError) {
      console.error('Error al crear la tienda:', storeError);
      return new Response(
        JSON.stringify({
          error: 'Error al crear la tienda',
          details: storeError
        }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    console.log('Tienda creada exitosamente:', store);

    return new Response(
      JSON.stringify(store),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Error inesperado:', error);
    return new Response(
      JSON.stringify({
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}; 