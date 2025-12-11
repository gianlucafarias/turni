// =============================================================================
// API para cambiar el plan de una tienda (solo admin)
// =============================================================================

import type { APIRoute } from 'astro';
import { supabaseAdmin, supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Verificar autenticación
    const accessToken = cookies.get('sb-access-token')?.value;
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: { user } } = await supabase.auth.getUser(accessToken);
    if (!user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verificar que es admin
    const { data: adminStore } = await supabaseAdmin
      .from('stores')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();

    if (!adminStore?.is_admin) {
      return new Response(JSON.stringify({ error: 'No tienes permisos de admin' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Obtener datos
    const { storeId, planId } = await request.json();

    if (!storeId || !planId) {
      return new Response(JSON.stringify({ error: 'Datos incompletos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validar plan
    const validPlans = ['free', 'trial', 'premium', 'premium_annual'];
    if (!validPlans.includes(planId)) {
      return new Response(JSON.stringify({ error: 'Plan no válido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Actualizar suscripción
    const now = new Date();
    const periodEnd = new Date(now);
    
    if (planId === 'premium' || planId === 'premium_annual') {
      if (planId === 'premium_annual') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        plan_id: planId,
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: (planId === 'premium' || planId === 'premium_annual') 
          ? periodEnd.toISOString() 
          : null,
        updated_at: now.toISOString(),
      })
      .eq('store_id', storeId);

    if (updateError) {
      console.error('Error updating subscription:', updateError);
      return new Response(JSON.stringify({ error: 'Error al actualizar' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Registrar en log de admin
    await supabaseAdmin.from('admin_logs').insert({
      admin_id: user.id,
      action: 'change_plan',
      entity_type: 'subscription',
      entity_id: storeId,
      details: { new_plan: planId },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};



