import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    // Verificar autenticación
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { 
      id, 
      name, 
      description, 
      whatsapp_url, 
      location,
      banner_image_url,
      profile_image_url
    } = body;

    // Verificar propiedad de la tienda
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (!store) {
      return new Response(JSON.stringify({ error: 'Tienda no encontrada' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Actualizar tienda
    const { error: updateError } = await supabase
      .from('stores')
      .update({
        name,
        description,
        whatsapp_url,
        location,
        banner_image_url,
        profile_image_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating store:', updateError);
      throw updateError;
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Tienda actualizada correctamente'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in store update:', error);
    return new Response(JSON.stringify({ 
      error: 'Error al actualizar la tienda',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}; 