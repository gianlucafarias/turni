import type { APIRoute } from 'astro'
import { supabase } from '../../../lib/supabase'

export const GET: APIRoute = async ({ url }) => {
  try {
    const token = url.searchParams.get('token')

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token requerido' }),
        { status: 400 }
      )
    }

    // Buscar cliente por booking_token
    const { data: client, error } = await supabase
      .from('clients')
      .select('id, first_name, last_name, email, phone, location, booking_token')
      .eq('booking_token', token)
      .single()

    if (error || !client) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 404 }
      )
    }

    return new Response(
      JSON.stringify(client),
      { status: 200 }
    )

  } catch (error: any) {
    console.error('Error obteniendo cliente:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Error al obtener cliente',
        details: error.message 
      }),
      { status: 500 }
    )
  }
}
