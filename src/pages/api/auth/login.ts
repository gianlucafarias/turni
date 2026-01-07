import type { APIRoute } from 'astro'
import { supabase } from '../../../lib/supabase'

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData()
    const email = formData.get('email')?.toString()
    const password = formData.get('password')?.toString()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email y contraseña son requeridos' }), 
        { status: 400 }
      )
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }), 
        { status: 401 }
      )
    }

    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/dashboard/products'
      }
    })

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }), 
      { status: 500 }
    )
  }
} 