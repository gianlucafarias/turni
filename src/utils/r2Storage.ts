import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Cliente S3 configurado para Cloudflare R2
// R2 es compatible con S3 API, así que usamos el SDK de AWS
function getR2Client() {
  const accountId = import.meta.env.CLOUDFLARE_ACCOUNT_ID
  const accessKeyId = import.meta.env.CLOUDFLARE_R2_ACCESS_KEY_ID
  const secretAccessKey = import.meta.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Cloudflare R2 credentials not configured. Please check your environment variables.')
  }

  return new S3Client({
    region: 'auto', // Cloudflare R2 usa 'auto' como región
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })
}

/**
 * Sube una imagen a Cloudflare R2
 * @param file - Archivo de imagen a subir
 * @param path - Ruta donde guardar (ej: 'stores/logo.jpg')
 * @returns URL pública de la imagen subida
 */
export async function uploadImageToR2(
  file: File,
  path: string
): Promise<string> {
  try {
    const bucket = import.meta.env.CLOUDFLARE_R2_BUCKET_NAME
    const publicUrl = import.meta.env.CLOUDFLARE_R2_PUBLIC_URL

    if (!bucket) {
      throw new Error('CLOUDFLARE_R2_BUCKET_NAME not configured')
    }

    // La compresión ya se hace en el cliente antes de enviar
    // Solo subimos el archivo directamente
    const client = getR2Client()

    // Subir a R2
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: path,
      Body: uint8Array,
      ContentType: file.type,
      CacheControl: 'public, max-age=31536000', // Cache por 1 año
    })

    await client.send(command)

    // Retornar URL pública
    if (publicUrl) {
      // Si hay URL pública configurada, usarla
      return `${publicUrl}/${path}`
    } else {
      // Si no, generar signed URL (válida por 1 año)
      const getCommand = new GetObjectCommand({
        Bucket: bucket,
        Key: path,
      })
      return await getSignedUrl(client, getCommand, { expiresIn: 31536000 }) // 1 año
    }
  } catch (error) {
    console.error('Error subiendo imagen a R2:', error)
    throw new Error('Error al subir la imagen. Por favor, intenta nuevamente.')
  }
}

/**
 * Elimina una imagen de Cloudflare R2
 * @param path - Ruta de la imagen a eliminar (puede ser URL completa o path relativo)
 */
export async function deleteImageFromR2(path: string): Promise<void> {
  try {
    const bucket = import.meta.env.CLOUDFLARE_R2_BUCKET_NAME
    if (!bucket) {
      console.warn('CLOUDFLARE_R2_BUCKET_NAME not configured, skipping delete')
      return
    }

    // Extraer el path del URL si es necesario
    let imagePath = path
    if (path.includes('/')) {
      // Si es una URL, extraer el path
      const urlParts = path.split('/')
      // Buscar el path después del dominio
      const publicUrl = import.meta.env.CLOUDFLARE_R2_PUBLIC_URL
      if (publicUrl && path.startsWith(publicUrl)) {
        imagePath = path.replace(publicUrl + '/', '')
      } else {
        // Intentar extraer el path de otras formas de URL
        const r2Index = urlParts.findIndex(part => part.includes('r2.dev') || part.includes('cloudflarestorage.com'))
        if (r2Index !== -1 && r2Index < urlParts.length - 1) {
          imagePath = urlParts.slice(r2Index + 1).join('/')
        }
      }
    }

    const client = getR2Client()

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: imagePath,
    })

    await client.send(command)
  } catch (error) {
    console.error('Error eliminando imagen de R2:', error)
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
export function generateR2ImagePath(storeId: string, type: string, filename: string): string {
  const timestamp = Date.now()
  const extension = filename.split('.').pop()
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  return `stores/${storeId}/${type}_${timestamp}_${sanitizedFilename}`
}

