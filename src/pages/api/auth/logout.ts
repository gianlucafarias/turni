import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/login'
      }
    });
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    return new Response(
      JSON.stringify({ error: 'Error al cerrar sesión' }), 
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}; 