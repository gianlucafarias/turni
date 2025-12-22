// =============================================================================
// API para gestionar cupones (solo admin)
// =============================================================================

import type { APIRoute } from 'astro';
import { supabaseAdmin, supabase } from '../../../lib/supabase';

// Verificar admin
async function verifyAdmin(cookies: any) {
  const accessToken = cookies.get('sb-access-token')?.value;
  if (!accessToken) return null;

  const { data: { user } } = await supabase.auth.getUser(accessToken);
  if (!user) return null;

  const { data: adminStore } = await supabaseAdmin
    .from('stores')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();

  if (!adminStore?.is_admin) return null;
  return user;
}

// Crear cupón
export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await verifyAdmin(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const data = await request.json();

    // Validar código único
    const { data: existing } = await supabaseAdmin
      .from('coupons')
      .select('id')
      .eq('code', data.code.toUpperCase())
      .single();

    if (existing) {
      return new Response(JSON.stringify({ error: 'El código ya existe' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Crear cupón
    const { error } = await supabaseAdmin
      .from('coupons')
      .insert({
        code: data.code.toUpperCase(),
        description: data.description || null,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        max_uses: data.max_uses || null,
        max_uses_per_user: data.max_uses_per_user || 1,
        valid_from: data.valid_from || new Date().toISOString(),
        valid_until: data.valid_until || null,
        created_by: user.id,
      });

    if (error) throw error;

    // Log
    await supabaseAdmin.from('admin_logs').insert({
      admin_id: user.id,
      action: 'create_coupon',
      entity_type: 'coupon',
      details: { code: data.code },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Actualizar cupón
export const PATCH: APIRoute = async ({ request, cookies }) => {
  const user = await verifyAdmin(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { id, active } = await request.json();

    const { error } = await supabaseAdmin
      .from('coupons')
      .update({ active })
      .eq('id', id);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Eliminar cupón
export const DELETE: APIRoute = async ({ request, cookies }) => {
  const user = await verifyAdmin(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { id } = await request.json();

    const { error } = await supabaseAdmin
      .from('coupons')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};













