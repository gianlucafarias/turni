import type { APIRoute } from 'astro'
import { supabase } from '../../../lib/supabase'

export const POST: APIRoute = async ({ request }) => {
  try {
    // Verificar sesión
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401 }
      )
    }

    // Obtener datos del request
    const { schedules } = await request.json()

    if (!schedules?.length) {
      return new Response(
        JSON.stringify({ error: 'No se recibieron horarios' }),
        { status: 400 }
      )
    }

    // Verificar que el usuario es dueño de la tienda
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('id', schedules[0].store_id)
      .single()

    if (!store) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401 }
      )
    }

    // Eliminar horarios existentes
    const { error: deleteError } = await supabase
      .from('schedules')
      .delete()
      .eq('store_id', store.id)

    if (deleteError) {
      throw deleteError
    }

    // Insertar nuevos horarios
    const { error: insertError } = await supabase
      .from('schedules')
      .insert(schedules)

    if (insertError) {
      throw insertError
    }

    return new Response(
      JSON.stringify({ message: 'Horarios actualizados correctamente' }),
      { status: 200 }
    )

  } catch (error) {
    console.error('Error al actualizar horarios:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Error al actualizar horarios',
        details: error instanceof Error ? error.message : 'Error desconocido'
      }),
      { status: 500 }
    )
  }
} 