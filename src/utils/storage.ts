import { supabase } from '../lib/supabase'
import { compressImage } from './imageHandling'

/**
 * Sube una imagen a Supabase Storage
 * @param file - Archivo de imagen a subir
 * @param path - Ruta donde guardar (ej: 'stores/logo.jpg')
 * @param bucket - Bucket de storage (default: 'public')
 * @returns URL pública de la imagen subida
 */
export async function uploadImageToStorage(
  file: File,
  path: string,
  bucket: string = 'public'
): Promise<string> {
  try {
    // Comprimir imagen antes de subir
    const compressedBlob = await compressImage(file)
    const compressedFile = new File([compressedBlob], file.name, { type: file.type })

    // Subir a Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, compressedFile, {
        cacheControl: '3600',
        upsert: true
      })

    if (error) throw error

    // Obtener URL pública
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path)

    return publicUrl
  } catch (error) {
    console.error('Error subiendo imagen:', error)
    throw new Error('Error al subir la imagen. Por favor, intenta nuevamente.')
  }
}

/**
 * Elimina una imagen de Supabase Storage
 * @param url - URL completa de la imagen o path relativo
 * @param bucket - Bucket de storage (default: 'public')
 */
export async function deleteImageFromStorage(
  url: string,
  bucket: string = 'public'
): Promise<void> {
  try {
    let imagePath = url

    // Si es una URL completa, extraer el path
    if (url.includes('/storage/v1/object/public/')) {
      // Formato: https://xxx.supabase.co/storage/v1/object/public/bucket/path
      const parts = url.split('/storage/v1/object/public/')
      if (parts.length > 1) {
        // Remover el nombre del bucket del path
        const pathWithBucket = parts[1]
        imagePath = pathWithBucket.split('/').slice(1).join('/')
      }
    } else if (url.includes('/storage/v1/object/sign/')) {
      // URL firmada, extraer el path de otra manera
      const match = url.match(/\/storage\/v1\/object\/sign\/[^/]+\/([^?]+)/)
      if (match && match[1]) {
        imagePath = match[1]
      }
    }

    if (!imagePath) {
      console.warn('No se pudo extraer el path de la URL:', url)
      return
    }

    const { error } = await supabase.storage
      .from(bucket)
      .remove([imagePath])

    if (error) throw error
  } catch (error) {
    console.error('Error eliminando imagen:', error)
    // No lanzar error, solo loguear (puede que la imagen ya no exista)
  }
}

/**
 * Genera un path único para una imagen
 * @param storeId - ID de la tienda
 * @param type - Tipo de imagen (logo, banner, gallery, etc.)
 * @param filename - Nombre original del archivo
 * @returns Path único para la imagen
 */
export function generateImagePath(storeId: string, type: string, filename: string): string {
  const timestamp = Date.now()
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  return `stores/${storeId}/${type}_${timestamp}_${sanitizedFilename}`
}

