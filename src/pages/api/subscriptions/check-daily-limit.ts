import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

/**
 * Endpoint para verificar disponibilidad de turnos en un día específico
 * Usado por el BookingWidget antes de mostrar horarios disponibles
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const storeId = url.searchParams.get('store_id');
    const date = url.searchParams.get('date'); // Formato: YYYY-MM-DD

    if (!storeId || !date) {
      return new Response(JSON.stringify({ 
        error: 'Faltan parámetros: store_id y date son requeridos' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Llamar a la función de PostgreSQL que verifica disponibilidad
    const { data, error } = await supabase
      .rpc('check_appointment_availability', { 
        p_store_id: storeId, 
        p_date: date 
      });

    if (error) {
      console.error('Error verificando disponibilidad:', error);
      return new Response(JSON.stringify({ 
        error: 'Error verificando disponibilidad',
        details: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error en check-daily-limit:', error);
    return new Response(JSON.stringify({ 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
