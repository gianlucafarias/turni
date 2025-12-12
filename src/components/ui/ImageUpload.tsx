import { useState, useRef, useEffect } from 'react'
import { readImageAsDataURL, compressImage } from '../../utils/imageHandling'
import { validateImage } from '../../utils/validation'
import { supabase } from '../../lib/supabase'

interface ImageUploadProps {
  currentImageUrl?: string
  onImageUploaded: (url: string) => void
  storeId: string
  type: 'logo' | 'banner' | 'gallery'
  aspectRatio?: 'square' | 'banner' | 'auto'
  maxSize?: number
  label?: string
  description?: string
  maxWidth?: string // Tamaño máximo para el contenedor (ej: 'w-28', 'max-w-md')
  resetAfterUpload?: boolean // Si es true, resetea el componente después de subir
}

export default function ImageUpload({
  currentImageUrl,
  onImageUploaded,
  storeId,
  type,
  aspectRatio = 'auto',
  maxSize = 5 * 1024 * 1024, // 5MB por defecto
  label,
  description,
  maxWidth,
  resetAfterUpload = false
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sincronizar preview con currentImageUrl cuando cambie externamente
  useEffect(() => {
    setPreview(currentImageUrl || null)
  }, [currentImageUrl])

  const handleFileSelect = async (file: File) => {
    setError(null)

    // Validar archivo
    const validation = validateImage(file)
    if (!validation.isValid) {
      setError(validation.error || 'Archivo inválido')
      return
    }

    // Validar tamaño
    if (file.size > maxSize) {
      setError(`La imagen es muy grande. Tamaño máximo: ${Math.round(maxSize / 1024 / 1024)}MB`)
      return
    }

    try {
      setUploading(true)

      // Comprimir imagen en el cliente antes de subir
      const compressedBlob = await compressImage(file)
      const compressedFile = new File([compressedBlob], file.name, { type: file.type })

      // Mostrar vista previa
      const previewUrl = await readImageAsDataURL(compressedFile)
      setPreview(previewUrl)

      // Obtener token de autenticación
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('No estás autenticado. Por favor, inicia sesión.')
        setPreview(currentImageUrl || null)
        return
      }

      // Subir a R2 vía API (ya comprimida)
      const formData = new FormData()
      formData.append('file', compressedFile)
      formData.append('storeId', storeId)
      formData.append('type', type)

      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al subir la imagen')
      }

      const { url } = await response.json()

      // Eliminar imagen anterior si existe
      if (currentImageUrl) {
        try {
          // Intentar eliminar la imagen anterior (no esperamos respuesta)
          fetch('/api/storage/upload', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: currentImageUrl }),
          }).catch(() => {
            // Ignorar errores al eliminar imagen anterior
          })
        } catch (e) {
          // Ignorar errores
        }
      }

      // Notificar al componente padre
      onImageUploaded(url)
      
      // Si resetAfterUpload es true, resetear el componente inmediatamente
      if (resetAfterUpload) {
        setPreview(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error al subir la imagen')
      setPreview(currentImageUrl || null)
    } finally {
      setUploading(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleRemove = async () => {
    // Eliminar del storage si existe
    if (currentImageUrl) {
      try {
        // Obtener token de autenticación
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await fetch('/api/storage/upload', {
            method: 'DELETE',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ path: currentImageUrl }),
          })
        }
      } catch (e) {
        // Ignorar errores al eliminar
      }
    }
    
    setPreview(null)
    onImageUploaded('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case 'square':
        return 'aspect-square'
      case 'banner':
        return 'aspect-[3/1]'
      default:
        return ''
    }
  }

  // Determinar clases de tamaño según el tipo
  const getSizeClasses = () => {
    if (maxWidth) {
      return maxWidth
    }
    // Tamaños por defecto según el tipo
    if (type === 'logo') {
      return 'w-28 h-28' // Tamaño pequeño para logo
    }
    if (type === 'banner') {
      return 'w-full aspect-[3/1]'
    }
    if (type === 'gallery') {
      return 'aspect-square'
    }
    return ''
  }

  return (
    <div className={`space-y-3 ${maxWidth ? maxWidth : ''}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl transition-all flex-shrink-0
          ${dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-gray-50'}
          ${type === 'logo' ? 'w-28 h-28' : type === 'banner' ? 'w-full aspect-[3/1]' : type === 'gallery' ? 'aspect-square max-w-xs' : aspectRatio === 'square' ? 'aspect-square' : aspectRatio === 'banner' ? 'aspect-[3/1]' : 'min-h-[200px]'}
          ${uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-indigo-300'}
        `}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        {preview ? (
          <div className="relative w-full h-full group">
            <img
              src={preview}
              alt="Preview"
              className={`w-full h-full object-cover rounded-xl`}
            />
            {!uploading && (
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                  className="px-4 py-2 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                >
                  Cambiar
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemove()
                  }}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                <div className="text-white text-center">
                  <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm">Subiendo...</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <svg
              className="w-12 h-12 text-gray-400 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm font-medium text-gray-600 mb-1">
              {dragActive ? 'Soltar imagen aquí' : 'Haz clic o arrastra una imagen'}
            </p>
            <p className="text-xs text-gray-400">
              PNG, JPG o WEBP (máx. {Math.round(maxSize / 1024 / 1024)}MB)
            </p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleInputChange}
          className="hidden"
          disabled={uploading}
        />
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
          {error}
        </div>
      )}

      {description && (
        <p className="text-xs text-gray-500">
          {description}
        </p>
      )}
    </div>
  )
}

