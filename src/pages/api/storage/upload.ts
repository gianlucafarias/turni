import type { APIRoute } from 'astro'
import { supabase } from '../../../lib/supabase'
import { uploadImageToR2, deleteImageFromR2, generateR2ImagePath } from '../../../utils/r2Storage'

export const POST: APIRoute = async ({ request }) => {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Verificar token con Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Obtener FormData
    const formData = await request.formData()
    const file = formData.get('file') as File
    const storeId = formData.get('storeId') as string
    const type = formData.get('type') as string

    if (!file || !storeId || !type) {
      return new Response(
        JSON.stringify({ error: 'Faltan parámetros requeridos: file, storeId, type' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Verificar que el usuario sea dueño de la tienda
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, user_id')
      .eq('id', storeId)
      .single()

    if (storeError || !store) {
      return new Response(
        JSON.stringify({ error: 'Tienda no encontrada' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (store.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'No tienes permiso para subir imágenes a esta tienda' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Validar tipo de archivo
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: 'Tipo de archivo no válido. Solo se permiten PNG, JPG y WEBP' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Validar tamaño (5MB máximo)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return new Response(
        JSON.stringify({ error: 'El archivo es muy grande. Tamaño máximo: 5MB' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Generar path único
    const imagePath = generateR2ImagePath(storeId, type, file.name)

    // Subir a R2
    const imageUrl = await uploadImageToR2(file, imagePath)

    return new Response(
      JSON.stringify({ url: imageUrl }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error en upload:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Error al subir la imagen' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export const DELETE: APIRoute = async ({ request }) => {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Verificar token con Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Obtener body
    const body = await request.json()
    const path = body.path as string

    if (!path) {
      return new Response(
        JSON.stringify({ error: 'Falta el parámetro path' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Eliminar de R2
    await deleteImageFromR2(path)

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error en delete:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Error al eliminar la imagen' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
