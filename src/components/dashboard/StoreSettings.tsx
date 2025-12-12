import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import ImageUpload from '../ui/ImageUpload'
import { deleteImageFromStorage } from '../../utils/storage'

export default function StoreSettings() {
  const [store, setStore] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'images' | 'contact' | 'settings'>('profile')
  
  // Estados para campos
  const [showPrices, setShowPrices] = useState(true)
  const [allowMultiple, setAllowMultiple] = useState(false)
  const [maxPerSlot, setMaxPerSlot] = useState(1)
  const [slug, setSlug] = useState('')
  const [slugError, setSlugError] = useState<string | null>(null)
  const [galleryImages, setGalleryImages] = useState<string[]>([])
  const [profileImageUrl, setProfileImageUrl] = useState('')
  const [bannerImageUrl, setBannerImageUrl] = useState('')

  useEffect(() => {
    loadStore()
  }, [])

  async function loadStore() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        window.location.href = '/login'
        return
      }

      const { data: storeData } = await supabase
        .from('stores')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (!storeData) {
        window.location.href = '/setup/store'
        return
      }

      setStore(storeData)
      setShowPrices(storeData.show_prices !== false)
      setAllowMultiple(storeData.allow_multiple_appointments || false)
      setMaxPerSlot(storeData.max_appointments_per_slot || 1)
      setSlug(storeData.slug || '')
      setGalleryImages(storeData.gallery_images || [])
      setProfileImageUrl(storeData.profile_image_url || '')
      setBannerImageUrl(storeData.banner_image_url || '')
    } catch (error) {
      console.error('Error cargando tienda:', error)
      setError('Error al cargar la información de la tienda')
    } finally {
      setLoading(false)
    }
  }

  // Validar slug
  async function validateSlug(newSlug: string) {
    if (!newSlug) {
      setSlugError(null)
      return true
    }

    // Validar formato
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    if (!slugRegex.test(newSlug)) {
      setSlugError('Solo letras minúsculas, números y guiones')
      return false
    }

    // Verificar que no sea un UUID (reservado)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRegex.test(newSlug)) {
      setSlugError('No puedes usar un ID como URL')
      return false
    }

    // Verificar disponibilidad
    if (newSlug !== store.slug) {
      const { data: existing } = await supabase
        .from('stores')
        .select('id')
        .eq('slug', newSlug)
        .neq('id', store.id)
        .single()

      if (existing) {
        setSlugError('Esta URL ya está en uso')
        return false
      }
    }

    setSlugError(null)
    return true
  }

  function handleSlugChange(value: string) {
    // Auto-formatear: minúsculas, sin espacios
    const formatted = value.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
    setSlug(formatted)
    validateSlug(formatted)
  }

  function handleGalleryImageUploaded(url: string) {
    if (!url) return
    if (galleryImages.length >= 10) {
      alert('Máximo 10 imágenes')
      return
    }
    setGalleryImages([...galleryImages, url])
  }

  async function removeGalleryImage(index: number) {
    const imageUrl = galleryImages[index]
    
    // Eliminar del storage si es de nuestro storage
    if (imageUrl && imageUrl.includes('supabase.co/storage')) {
      try {
        await deleteImageFromStorage(imageUrl)
      } catch (e) {
        // Ignorar errores al eliminar
      }
    }
    
    setGalleryImages(galleryImages.filter((_, i) => i !== index))
  }

  function moveGalleryImage(index: number, direction: 'up' | 'down') {
    const newOrder = [...galleryImages]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= newOrder.length) return
    [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]]
    setGalleryImages(newOrder)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    const form = e.target as HTMLFormElement
    const formData = new FormData(form)
    
    // Obtener el nombre - usar el actual si no está en el formulario (porque está en otra pestaña)
    const nameFromForm = formData.get('name')?.toString().trim()
    const nameValue = nameFromForm || store.name
    
    if (!nameValue) {
      setError('El nombre de la tienda es obligatorio')
      return
    }
    
    // Validar slug antes de guardar
    if (slug && !(await validateSlug(slug))) {
      setError('Por favor corrige el error en la URL personalizada')
      return
    }
    
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      // Campos básicos - usar valores del formulario si existen, sino mantener los actuales
      const basicData: any = {
        name: nameValue,
        description: formData.get('description')?.toString() ?? store.description ?? '',
        location: formData.get('location')?.toString() ?? store.location ?? '',
        whatsapp_url: formData.get('whatsapp_url')?.toString() ?? store.whatsapp_url ?? '',
        banner_image_url: bannerImageUrl,
        profile_image_url: profileImageUrl,
        show_prices: showPrices,
        allow_multiple_appointments: allowMultiple,
        max_appointments_per_slot: allowMultiple ? maxPerSlot : 1
      }

      // Intentar guardar con todos los campos nuevos - usar valores actuales si el campo no está en el form
      const fullData: any = {
        ...basicData,
        short_bio: formData.get('short_bio')?.toString() ?? store.short_bio ?? '',
        address: formData.get('address')?.toString() ?? store.address ?? '',
        phone: formData.get('phone')?.toString() ?? store.phone ?? '',
        email: formData.get('email')?.toString() ?? store.email ?? '',
        instagram_url: formData.get('instagram_url')?.toString() ?? store.instagram_url ?? '',
        facebook_url: formData.get('facebook_url')?.toString() ?? store.facebook_url ?? '',
        tiktok_url: formData.get('tiktok_url')?.toString() ?? store.tiktok_url ?? '',
        website_url: formData.get('website_url')?.toString() ?? store.website_url ?? '',
        business_hours_text: formData.get('business_hours_text')?.toString() ?? store.business_hours_text ?? '',
        gallery_images: galleryImages,
      }

      // Solo incluir slug si tiene valor
      if (slug) {
        fullData.slug = slug
      }

      // Intentar con todos los campos
      let { error: updateError } = await supabase
        .from('stores')
        .update(fullData)
        .eq('id', store.id)

      // Si falla por columnas inexistentes, intentar solo con campos básicos
      if (updateError && (updateError.code === '42703' || updateError.message?.includes('column'))) {
        console.warn('Columnas nuevas no disponibles, guardando campos básicos')
        const { error: basicError } = await supabase
          .from('stores')
          .update(basicData)
          .eq('id', store.id)
        
        if (basicError) throw basicError
        
        setStore({ ...store, ...basicData })
        setSuccess(true)
        setError('Guardado parcialmente. Ejecuta la migración para habilitar todas las opciones.')
        setTimeout(() => {
          setSuccess(false)
          setError(null)
        }, 5000)
        return
      }

      if (updateError) throw updateError

      // Actualizar store local
      setStore({ ...store, ...fullData })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (error: any) {
      console.error('Error:', error)
      setError(error.message || 'Error al guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!store) return null

  const isAppointments = store.store_type === 'appointments'
  const publicUrl = slug 
    ? `${window.location.origin}/${slug}` 
    : `${window.location.origin}/${store.id}`

  const tabs = [
    { id: 'profile', label: 'Perfil', icon: '👤' },
    { id: 'images', label: 'Imágenes', icon: '🖼️' },
    { id: 'contact', label: 'Contacto', icon: '📞' },
    { id: 'settings', label: 'Ajustes', icon: '⚙️' },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Mi Tienda</h1>
        <p className="text-gray-500 mt-1">Personaliza cómo se ve tu {isAppointments ? 'negocio' : 'tienda'} para tus clientes</p>
      </div>

      {/* Alertas */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-xl flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Cambios guardados correctamente
        </div>
      )}

      {/* URL pública - siempre visible */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 mb-8 text-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold">Tu página pública</h3>
            <p className="text-indigo-100 text-sm">Comparte este enlace con tus clientes</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-white/10 backdrop-blur rounded-xl px-4 py-3 font-mono text-sm truncate">
            {publicUrl}
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(publicUrl)
              alert('¡Enlace copiado!')
            }}
            className="px-4 py-3 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-indigo-50 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copiar
          </button>
          <a
            href={`/${slug || store.id}`}
            target="_blank"
            className="px-4 py-3 bg-white/20 text-white rounded-xl font-semibold hover:bg-white/30 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Ver
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 min-w-max flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* TAB: Perfil */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* URL personalizada */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">URL personalizada</h2>
                  <p className="text-sm text-gray-500">Elige una URL fácil de recordar</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">{window.location.origin}/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  className={`flex-1 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-100 ${
                    slugError ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-indigo-500'
                  }`}
                  placeholder="mi-negocio"
                />
              </div>
              {slugError && (
                <p className="mt-2 text-sm text-red-500">{slugError}</p>
              )}
              <p className="mt-2 text-sm text-gray-400">
                Solo letras minúsculas, números y guiones. Ej: peluqueria-maria
              </p>
            </div>

            {/* Información básica */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <span className="text-xl">📝</span> Información básica
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de la tienda *
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={store.name}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Eslogan o bio breve
                </label>
                <input
                  type="text"
                  name="short_bio"
                  defaultValue={store.short_bio || ''}
                  maxLength={100}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  placeholder="Tu frase que define tu negocio"
                />
                <p className="mt-1 text-sm text-gray-400">Máximo 100 caracteres</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción completa
                </label>
                <textarea
                  name="description"
                  rows={4}
                  defaultValue={store.description || ''}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none"
                  placeholder="Describe tu negocio, qué servicios ofreces, tu experiencia..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ciudad / Zona
                  </label>
                  <input
                    type="text"
                    name="location"
                    defaultValue={store.location || ''}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    placeholder="Buenos Aires, Argentina"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dirección completa
                  </label>
                  <input
                    type="text"
                    name="address"
                    defaultValue={store.address || ''}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    placeholder="Av. Corrientes 1234, Piso 2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Horario de atención (texto)
                </label>
                <textarea
                  name="business_hours_text"
                  rows={2}
                  defaultValue={store.business_hours_text || ''}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none"
                  placeholder="Lunes a Viernes 9:00 - 18:00&#10;Sábados 10:00 - 14:00"
                />
                <p className="mt-1 text-sm text-gray-400">Este texto se muestra en tu perfil público</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Imágenes */}
        {activeTab === 'images' && store && (
          <div className="space-y-6">
            {/* Logo */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-xl">👤</span> Logo o foto de perfil
              </h2>
              <div className="flex items-start gap-4">
                <ImageUpload
                  currentImageUrl={profileImageUrl}
                  onImageUploaded={setProfileImageUrl}
                  storeId={store.id}
                  type="logo"
                  aspectRatio="square"
                  label=""
                  description="Imagen cuadrada recomendada (400x400 px)"
                />
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mt-2">
                    Tu logo aparecerá en tu perfil público. Imagen cuadrada recomendada (400x400 px).
                  </p>
                </div>
              </div>
            </div>

            {/* Banner */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-xl">🖼️</span> Banner principal
              </h2>
              <ImageUpload
                currentImageUrl={bannerImageUrl}
                onImageUploaded={setBannerImageUrl}
                storeId={store.id}
                type="banner"
                aspectRatio="banner"
                label=""
                description="Banner horizontal recomendado (1200 x 400 px)"
              />
            </div>

            {/* Galería / Carrusel */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <span className="text-xl">📸</span> Galería de imágenes
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Agrega hasta 10 imágenes para mostrar en tu perfil (carrusel)
              </p>
              
              {/* Lista de imágenes */}
              {galleryImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
                  {galleryImages.map((url, index) => (
                    <div key={index} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100">
                      <img
                        src={url}
                        alt={`Galería ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => moveGalleryImage(index, 'up')}
                            className="p-2 bg-white rounded-lg hover:bg-gray-100"
                            title="Mover antes"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeGalleryImage(index)}
                          className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                          title="Eliminar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        {index < galleryImages.length - 1 && (
                          <button
                            type="button"
                            onClick={() => moveGalleryImage(index, 'down')}
                            className="p-2 bg-white rounded-lg hover:bg-gray-100"
                            title="Mover después"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <div className="absolute top-2 left-2 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Agregar nueva imagen */}
              {galleryImages.length < 10 && store && (
                <div className="max-w-xs">
                  <ImageUpload
                    currentImageUrl=""
                    onImageUploaded={handleGalleryImageUploaded}
                    storeId={store.id}
                    type="gallery"
                    aspectRatio="square"
                    label=""
                    description=""
                    resetAfterUpload={true}
                  />
                </div>
              )}
              
              <p className="mt-3 text-sm text-gray-400">
                {galleryImages.length}/10 imágenes
              </p>
            </div>
          </div>
        )}

        {/* TAB: Contacto */}
        {activeTab === 'contact' && (
          <div className="space-y-6">
            {/* Contacto directo */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <span className="text-xl">📱</span> Contacto directo
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  WhatsApp
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-4 rounded-l-xl border border-r-0 border-gray-200 bg-gray-50 text-gray-500 text-sm">
                    +
                  </span>
                  <input
                    type="text"
                    name="whatsapp_url"
                    defaultValue={store.whatsapp_url || ''}
                    className="flex-1 px-4 py-3 border border-gray-200 rounded-r-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    placeholder="549111234567"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-400">
                  Número con código de país, sin espacios ni símbolos
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    defaultValue={store.phone || ''}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    placeholder="(011) 1234-5678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={store.email || ''}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    placeholder="contacto@ejemplo.com"
                  />
                </div>
              </div>
            </div>

            {/* Redes sociales */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <span className="text-xl">🌐</span> Redes sociales
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Instagram
                  </label>
                  <div className="flex">
                    <span className="inline-flex items-center px-4 rounded-l-xl border border-r-0 border-gray-200 bg-gray-50 text-gray-500 text-sm">
                      @
                    </span>
                    <input
                      type="text"
                      name="instagram_url"
                      defaultValue={store.instagram_url || ''}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-r-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      placeholder="tunegocio"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Facebook
                  </label>
                  <div className="flex">
                    <span className="inline-flex items-center px-4 rounded-l-xl border border-r-0 border-gray-200 bg-gray-50 text-gray-500 text-sm">
                      fb.com/
                    </span>
                    <input
                      type="text"
                      name="facebook_url"
                      defaultValue={store.facebook_url || ''}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-r-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      placeholder="tunegocio"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    TikTok
                  </label>
                  <div className="flex">
                    <span className="inline-flex items-center px-4 rounded-l-xl border border-r-0 border-gray-200 bg-gray-50 text-gray-500 text-sm">
                      @
                    </span>
                    <input
                      type="text"
                      name="tiktok_url"
                      defaultValue={store.tiktok_url || ''}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-r-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      placeholder="tunegocio"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sitio web
                  </label>
                  <input
                    type="url"
                    name="website_url"
                    defaultValue={store.website_url || ''}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    placeholder="https://www.ejemplo.com"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Ajustes */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Opciones solo para turnos */}
            {isAppointments && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <span className="text-xl">📅</span> Opciones de turnos
                </h2>

                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div>
                    <p className="font-medium text-gray-900">Mostrar precios</p>
                    <p className="text-sm text-gray-500">
                      Mostrar los precios de los servicios en la página pública
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPrices(!showPrices)}
                    className={`relative w-14 h-8 rounded-full transition-colors ${
                      showPrices ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${
                        showPrices ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="py-3">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-medium text-gray-900">Permitir múltiples turnos simultáneos</p>
                      <p className="text-sm text-gray-500">
                        Si está activado, varios clientes pueden reservar en el mismo horario
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAllowMultiple(!allowMultiple)
                        if (allowMultiple) setMaxPerSlot(1)
                      }}
                      className={`relative w-14 h-8 rounded-full transition-colors ${
                        allowMultiple ? 'bg-indigo-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${
                          allowMultiple ? 'left-7' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  {allowMultiple && (
                    <div className="bg-indigo-50 rounded-xl p-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cantidad máxima de turnos por horario
                      </label>
                      <input
                        type="number"
                        min="2"
                        max="20"
                        value={maxPerSlot}
                        onChange={(e) => setMaxPerSlot(Math.max(2, parseInt(e.target.value) || 2))}
                        className="w-full px-4 py-2.5 border border-indigo-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white"
                      />
                      <p className="text-xs text-indigo-600 mt-2">
                        Ejemplo: Si es 3, hasta 3 clientes pueden reservar a las 10:00 hs
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tipo de tienda (info) */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-xl">🏪</span> Tipo de tienda
              </h2>
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isAppointments ? 'bg-purple-100 text-purple-600' : 'bg-emerald-100 text-emerald-600'
                }`}>
                  {isAppointments ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {isAppointments ? 'Tienda de Turnos/Citas' : 'Tienda de Productos'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {isAppointments 
                      ? 'Tus clientes pueden reservar turnos online' 
                      : 'Tus clientes pueden ver y consultar productos'}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-400">
                El tipo de tienda se define al crear la cuenta y no se puede cambiar
              </p>
            </div>

            {/* Zona de peligro */}
            <div className="bg-red-50 rounded-2xl border border-red-200 p-6">
              <h2 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                <span className="text-xl">⚠️</span> Zona de peligro
              </h2>
              <p className="text-sm text-red-600 mb-4">
                Estas acciones son irreversibles
              </p>
              <button
                type="button"
                onClick={() => {
                  if (confirm('¿Estás seguro? Esta acción no se puede deshacer.')) {
                    alert('Función no implementada aún')
                  }
                }}
                className="px-4 py-2 bg-white border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors"
              >
                Eliminar tienda
              </button>
            </div>
          </div>
        )}

        {/* Botones de guardar (siempre visibles) */}
        <div className="sticky bottom-4 flex justify-end gap-4 pt-4 bg-gradient-to-t from-stone-50 to-transparent pb-4">
          <button
            type="button"
            onClick={() => window.location.href = '/dashboard'}
            className="px-6 py-3 text-gray-700 bg-white border border-gray-200 rounded-xl font-medium hover:bg-gray-50 transition-colors shadow-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !!slugError}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-200"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Guardando...
              </span>
            ) : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
