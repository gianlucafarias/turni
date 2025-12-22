// =============================================================================
// API para gestionar configuración del sitio (solo admin)
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

export const PATCH: APIRoute = async ({ request, cookies }) => {
  const user = await verifyAdmin(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { type, data, plan } = body;

    // Obtener configuración actual
    const { data: config } = await supabaseAdmin
      .from('site_config')
      .select('*')
      .eq('id', 'main')
      .single();

    let updateData: any = { updated_at: new Date().toISOString(), updated_by: user.id };

    if (type === 'pricing') {
      updateData.pricing = { ...config?.pricing, ...data };
    } else if (type === 'plan_config') {
      const currentPlanConfig = config?.plan_config || {};
      updateData.plan_config = {
        ...currentPlanConfig,
        [plan]: { ...currentPlanConfig[plan], ...data }
      };
    } else if (type === 'general') {
      Object.assign(updateData, data);
    }

    const { error } = await supabaseAdmin
      .from('site_config')
      .update(updateData)
      .eq('id', 'main');

    if (error) throw error;

    // Log
    await supabaseAdmin.from('admin_logs').insert({
      admin_id: user.id,
      action: 'update_config',
      entity_type: 'config',
      details: { type, data },
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













