// =============================================================================
// API para subir imágenes a Cloudflare R2
// =============================================================================

import type { APIRoute } from 'astro'
import { supabase } from '../../../lib/supabase'
import { uploadImageToR2, generateR2ImagePath } from '../../../utils/r2Storage'

/**
 * POST: Sube una imagen a Cloudflare R2
 * 
 * Body (multipart/form-data):
 * - file: Archivo de imagen
 * - storeId: ID de la tienda
 * - type: Tipo de imagen (logo, banner, gallery)
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Verificar autenticación (cookie o Authorization: Bearer)
    const authHeader = request.headers.get('authorization')
    const bearerToken = authHeader?.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7)
      : null
    
    // Buscar token en cookies (diferentes formatos posibles)
    const cookieToken = cookies.get('sb-access-token')?.value || 
                       cookies.get('auth-token')?.value ||
                       cookies.get('sb-auth-token')?.value
    
    const accessToken = bearerToken || cookieToken
    
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Obtener usuario desde el token
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Verificar que el usuario tenga una tienda
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!store) {
      return new Response(JSON.stringify({ error: 'Tienda no encontrada' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Obtener datos del formulario
    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    if (!file) {
      return new Response(JSON.stringify({ error: 'No se proporcionó archivo' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!type || !['logo', 'banner', 'gallery'].includes(type)) {
      return new Response(JSON.stringify({ error: 'Tipo de imagen inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Validar tipo de archivo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return new Response(JSON.stringify({ error: 'Tipo de archivo no soportado. Usa JPG, PNG o WEBP' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Validar tamaño (5MB máximo)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return new Response(JSON.stringify({ error: `La imagen es muy grande. Tamaño máximo: ${Math.round(maxSize / 1024 / 1024)}MB` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Generar path único
    const path = generateR2ImagePath(store.id, type, file.name)

    // Subir a R2
    const publicUrl = await uploadImageToR2(file, path)

    return new Response(JSON.stringify({ url: publicUrl, path }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('[Upload API] Error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Error al subir la imagen',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * DELETE: Elimina una imagen de Cloudflare R2
 * 
 * Body (JSON):
 * - path: Path de la imagen a eliminar
 */
export const DELETE: APIRoute = async ({ request, cookies }) => {
  try {
    // Verificar autenticación (cookie o Authorization: Bearer)
    const authHeader = request.headers.get('authorization')
    const bearerToken = authHeader?.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7)
      : null
    
    // Buscar token en cookies (diferentes formatos posibles)
    const cookieToken = cookies.get('sb-access-token')?.value || 
                       cookies.get('auth-token')?.value ||
                       cookies.get('sb-auth-token')?.value
    
    const accessToken = bearerToken || cookieToken
    
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Obtener usuario desde el token
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await request.json()
    const { path } = body

    if (!path) {
      return new Response(JSON.stringify({ error: 'Path no proporcionado' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Verificar que la imagen pertenece a una tienda del usuario
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!store) {
      return new Response(JSON.stringify({ error: 'Tienda no encontrada' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Verificar que el path pertenece a la tienda del usuario
    // El path puede ser una URL completa o un path relativo
    const pathToCheck = path.includes('stores/') ? path : path.split('/').slice(-3).join('/')
    if (!pathToCheck.includes(`stores/${store.id}/`)) {
      return new Response(JSON.stringify({ error: 'No autorizado para eliminar esta imagen' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { deleteImageFromR2 } = await import('../../../utils/r2Storage')
    await deleteImageFromR2(path)

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('[Delete API] Error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Error al eliminar la imagen',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

