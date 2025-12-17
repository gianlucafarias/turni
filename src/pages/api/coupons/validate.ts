// =============================================================================
// API para validar un cupón (público, para usar en registro)
// =============================================================================

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { code, planId, amount } = await request.json();

    if (!code) {
      return new Response(JSON.stringify({ error: 'Código de cupón requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Usar la función de validación de Supabase
    const { data, error } = await supabase.rpc('validate_coupon', {
      p_code: code.toUpperCase(),
      p_user_id: null, // En registro aún no hay usuario
      p_plan_id: planId || null,
      p_amount: amount || 0
    });

    if (error) {
      console.error('Error validando cupón:', error);
      return new Response(JSON.stringify({ error: 'Error al validar el cupón' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};


