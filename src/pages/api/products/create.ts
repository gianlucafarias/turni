import type { APIRoute } from 'astro'
import { supabase } from '../../../lib/supabase'

export const POST: APIRoute = async ({ request }) => {
  try {
    // Verificar sesión
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }), 
        { 
          status: 401,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    }

    // Obtener datos del formulario
    const formData = await request.formData()
    const store_id = formData.get('store_id')?.toString()
    const name = formData.get('name')?.toString()
    const description = formData.get('description')?.toString()
    const price = Number(formData.get('price'))
    const stock = Number(formData.get('stock'))
    const category_id = formData.get('category_id')?.toString()
    const image_url = formData.get('image_url')?.toString()
    const active = formData.get('active') === 'on'

    // Validar datos requeridos
    if (!store_id || !name || isNaN(price) || isNaN(stock)) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos requeridos' }), 
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    }

    // Verificar que el usuario es dueño de la tienda
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id')
      .eq('id', store_id)
      .eq('user_id', session.user.id)
      .single()

    if (storeError || !store) {
      return new Response(
        JSON.stringify({ error: 'No autorizado para esta tienda' }), 
        { 
          status: 401,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    }

    // Crear el producto
    const { data: product, error } = await supabase
      .from('products')
      .insert([{
        store_id,
        name,
        description,
        price,
        stock,
        category_id: category_id || null,
        image_url: image_url || null,
        active
      }])
      .select()
      .single()

    if (error) {
      console.error('Error al crear producto:', error)
      return new Response(
        JSON.stringify({ error: 'Error al crear el producto' }), 
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    }

    // Retornar éxito
    return new Response(
      JSON.stringify({ success: true, product }), 
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    console.error('Error al crear producto:', error)
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }), 
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
  }
} 