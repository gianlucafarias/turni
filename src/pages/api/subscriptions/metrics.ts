// =============================================================================
// API para obtener métricas de suscripciones (Admin)
// =============================================================================

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getSubscriptionMetrics } from '../../../lib/subscription';

export const GET: APIRoute = async ({ cookies }) => {
  try {
    // Verificar autenticación
    const accessToken = cookies.get('sb-access-token')?.value;
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

    // TODO: Verificar si el usuario es admin
    // Por ahora, permitimos a cualquier usuario autenticado ver métricas básicas
    // En producción, deberías verificar si user.id está en una lista de admins
    // o si tiene un rol de admin en la metadata

    const metrics = await getSubscriptionMetrics();

    return new Response(JSON.stringify({
      success: true,
      metrics,
      generatedAt: new Date().toISOString(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error getting metrics:', error);
    return new Response(JSON.stringify({ 
      error: 'Error al obtener métricas',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};





