// =============================================================================
// API para cambiar el plan de una tienda (solo admin)
// =============================================================================

import type { APIRoute } from 'astro';
import { supabaseAdmin, supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Verificar autenticación (header Authorization o cookie)
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7)
      : null;
    
    const cookieToken = cookies.get('sb-access-token')?.value;
    const accessToken = bearerToken || cookieToken;
    
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

    // Verificar si existe la suscripción
    const { data: existingSubscription, error: checkError } = await supabaseAdmin
      .from('subscriptions')
      .select('id, plan_id, store_id')
      .eq('store_id', storeId)
      .maybeSingle();

    console.log('Verificando suscripción para store:', storeId);
    console.log('Suscripción existente:', existingSubscription);
    console.log('Error al verificar:', checkError);

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking subscription:', checkError);
      return new Response(JSON.stringify({ error: 'Error al verificar suscripción: ' + checkError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();
    const periodEnd = new Date(now);
    
    if (planId === 'premium' || planId === 'premium_annual') {
      if (planId === 'premium_annual') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }
    }

    // Si existe, actualizar; si no, crear
    if (existingSubscription) {
      console.log('Actualizando suscripción existente:', existingSubscription.id, 'de', existingSubscription.plan_id, 'a', planId);
      const { data: updated, error: updateError } = await supabaseAdmin
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
        .eq('store_id', storeId)
        .select('id, plan_id, store_id, status');

      if (updateError) {
        console.error('Error updating subscription:', updateError);
        return new Response(JSON.stringify({ error: 'Error al actualizar: ' + updateError.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      console.log('Suscripción actualizada exitosamente:', updated);
      
      // Verificar que realmente se actualizó
      const { data: verify } = await supabaseAdmin
        .from('subscriptions')
        .select('plan_id')
        .eq('store_id', storeId)
        .single();
      console.log('Verificación post-actualización:', verify);
    } else {
      // Crear suscripción si no existe
      console.log('Creando nueva suscripción para store:', storeId, 'con plan:', planId);
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('subscriptions')
        .insert({
          store_id: storeId,
          plan_id: planId,
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: (planId === 'premium' || planId === 'premium_annual') 
            ? periodEnd.toISOString() 
            : null,
        })
        .select('id, plan_id, store_id, status');

      if (insertError) {
        console.error('Error creating subscription:', insertError);
        return new Response(JSON.stringify({ error: 'Error al crear suscripción: ' + insertError.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      console.log('Suscripción creada exitosamente:', inserted);
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





