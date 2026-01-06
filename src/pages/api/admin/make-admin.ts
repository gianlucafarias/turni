// =============================================================================
// API para convertir a un usuario en admin (solo funciona si no hay admins)
// O si ya hay un admin, solo un admin puede agregar otros admins
// =============================================================================

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { user_id, secret_key } = await request.json();
    
    // El secret key es una medida de seguridad básica
    // Solo funciona si coincide con el env var o si no hay admins
    const expectedSecret = import.meta.env.ADMIN_SECRET_KEY || 'tiendita-admin-2024';
    
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id requerido' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Verificar cuántos admins hay
    const { count: adminCount } = await supabaseAdmin
      .from('stores')
      .select('*', { count: 'exact', head: true })
      .eq('is_admin', true);
    
    // Si hay admins, solo se puede agregar con el secret correcto
    if ((adminCount ?? 0) > 0 && secret_key !== expectedSecret) {
      return new Response(JSON.stringify({ 
        error: 'Ya hay administradores. Contactá a un admin existente o usá el secret key correcto.' 
      }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Actualizar al usuario como admin
    const { data, error } = await supabaseAdmin
      .from('stores')
      .update({ is_admin: true })
      .eq('user_id', user_id)
      .select()
      .single();
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: `Usuario ${data.name} ahora es administrador`,
      store: data
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Error interno' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
