import type { APIRoute } from 'astro'
import { supabase } from '../../../lib/supabase'

export const POST: APIRoute = async ({ request }) => {
  try {
    const { token, first_name, last_name, email, phone, location } = await request.json()

    if (!token || !first_name) {
      return new Response(
        JSON.stringify({ error: 'Token y nombre son requeridos' }),
        { status: 400 }
      )
    }

    // Buscar cliente por edit_token
    const { data: client, error: findError } = await supabase
      .from('clients')
      .select('id, store_id')
      .eq('edit_token', token)
      .single()

    if (findError || !client) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 404 }
      )
    }

    // Actualizar cliente (solo campos permitidos)
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        first_name,
        last_name: last_name || null,
        email: email || null,
        phone: phone || null,
        location: location || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', client.id)

    if (updateError) {
      // Si hay conflicto de email o teléfono único, informar
      if (updateError.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'Ya existe otro cliente con ese email o teléfono' }),
          { status: 409 }
        )
      }
      throw updateError
    }

    return new Response(
      JSON.stringify({ message: 'Cliente actualizado correctamente' }),
      { status: 200 }
    )

  } catch (error: any) {
    console.error('Error actualizando cliente:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Error al actualizar cliente',
        details: error.message 
      }),
      { status: 500 }
    )
  }
}
