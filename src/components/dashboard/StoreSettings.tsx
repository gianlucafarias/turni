import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import ImageUpload from '../ui/ImageUpload'
import { deleteImageFromStorage } from '../../utils/storage'
import GoogleCalendarSync from './GoogleCalendarSync'
import AddressAutocomplete from '../ui/AddressAutocomplete'
import { ARGENTINA_PROVINCES } from '../../utils/argentinaProvinces'
import BranchesManager from './BranchesManager'
import { useSubscriptionLimits } from '../../hooks/useSubscriptionLimits'
import { BUSINESS_CATEGORIES } from '../../utils/businessCategories'

export default function StoreSettings() {
  const { isPremium } = useSubscriptionLimits()
  const [store, setStore] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'images' | 'contact' | 'settings'>('profile')
  const [showUnsavedModal, setShowUnsavedModal] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  
  // Estados para campos
  const [showPrices, setShowPrices] = useState(true)
  const [allowMultiple, setAllowMultiple] = useState(false)
  const [maxPerSlot, setMaxPerSlot] = useState(1)
  const [slug, setSlug] = useState('')
  const [slugError, setSlugError] = useState<string | null>(null)
  const [galleryImages, setGalleryImages] = useState<string[]>([])
  const [profileImageUrl, setProfileImageUrl] = useState('')
  const [bannerImageUrl, setBannerImageUrl] = useState('')
  const [city, setCity] = useState('')
  const [province, setProvince] = useState('')
  const [address, setAddress] = useState('')
  const [businessCategory, setBusinessCategory] = useState('')

  // Valores iniciales para comparar
  const initialValuesRef = useRef<any>(null)

  useEffect(() => {
    loadStore()
  }, [])

  // Función para verificar si hay cambios sin guardar
  const hasUnsavedChanges = useCallback(() => {
    if (!store || !initialValuesRef.current || !formRef.current) return false

    // Leer valores directamente del formulario
    const form = formRef.current
    const formData = new FormData(form)

    const current = {
      name: formData.get('name')?.toString().trim() || store.name || '',
      description: formData.get('description')?.toString() || store.description || '',
      short_bio: formData.get('short_bio')?.toString() || store.short_bio || '',
      location: city || store.location || '',
      city: city || store.city || '',
      province: province || store.province || '',
      address: address || store.address || '',
      whatsapp_url: formData.get('whatsapp_url')?.toString() || store.whatsapp_url || '',
      phone: formData.get('phone')?.toString() || store.phone || '',
      email: formData.get('email')?.toString() || store.email || '',
      instagram_url: formData.get('instagram_url')?.toString() || store.instagram_url || '',
      facebook_url: formData.get('facebook_url')?.toString() || store.facebook_url || '',
      tiktok_url: formData.get('tiktok_url')?.toString() || store.tiktok_url || '',
      website_url: formData.get('website_url')?.toString() || store.website_url || '',
        business_hours_text: formData.get('business_hours_text')?.toString() || store.business_hours_text || '',
        business_category: businessCategory || formData.get('business_category')?.toString() || store.business_category || '',
        show_prices: showPrices,
        allow_multiple_appointments: allowMultiple,
        max_appointments_per_slot: maxPerSlot,
        slug: slug || '',
        gallery_images: JSON.stringify([...galleryImages].sort()),
        profile_image_url: profileImageUrl,
        banner_image_url: bannerImageUrl,
      }

      const initial = {
        ...initialValuesRef.current,
        gallery_images: JSON.stringify([...(initialValuesRef.current.gallery_images || [])].sort()),
      }

    return JSON.stringify(current) !== JSON.stringify(initial)
  }, [store, showPrices, allowMultiple, maxPerSlot, slug, galleryImages, profileImageUrl, bannerImageUrl, city, province, address, businessCategory])

  // Interceptar navegación cuando hay cambios sin guardar
  const handleNavigation = (url: string) => {
    if (hasUnsavedChanges()) {
      setPendingNavigation(url)
      setShowUnsavedModal(true)
    } else {
      window.location.href = url
    }
  }

  // Confirmar navegación (descartar cambios)
  const confirmNavigation = () => {
    if (pendingNavigation) {
      setShowUnsavedModal(false)
      window.location.href = pendingNavigation
    }
  }

  // Cancelar navegación (quedarse en la página)
  const cancelNavigation = () => {
    setShowUnsavedModal(false)
    setPendingNavigation(null)
  }

  // Interceptar clics en enlaces cuando hay cambios sin guardar
  useEffect(() => {
    if (!store || !initialValuesRef.current) return

    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')
      
      if (!link) return
      
      // Ignorar enlaces externos, con target="_blank", o que sean botones
      if (link.target === '_blank' || link.href.startsWith('mailto:') || link.href.startsWith('tel:')) {
        return
      }

      // Ignorar si es el mismo dominio pero diferente ruta
      const currentPath = window.location.pathname
      const linkPath = new URL(link.href).pathname
      
      if (linkPath === currentPath) return

      // Verificar cambios
      if (hasUnsavedChanges()) {
        e.preventDefault()
        e.stopPropagation()
        setPendingNavigation(link.href)
        setShowUnsavedModal(true)
      }
    }

    document.addEventListener('click', handleLinkClick, true)
    return () => {
      document.removeEventListener('click', handleLinkClick, true)
    }
  }, [hasUnsavedChanges])

  // Event listener para beforeunload (cerrar pestaña/navegador)
  useEffect(() => {
    if (!store || !initialValuesRef.current || !formRef.current) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Leer valores directamente del formulario
      const form = formRef.current
      if (!form) return

      const formData = new FormData(form)
      const current = {
        name: formData.get('name')?.toString().trim() || store.name || '',
        description: formData.get('description')?.toString() || store.description || '',
        short_bio: formData.get('short_bio')?.toString() || store.short_bio || '',
        location: city || store.location || '',
        city: city || store.city || '',
        province: province || store.province || '',
        address: address || store.address || '',
        whatsapp_url: formData.get('whatsapp_url')?.toString() || store.whatsapp_url || '',
        phone: formData.get('phone')?.toString() || store.phone || '',
        email: formData.get('email')?.toString() || store.email || '',
        instagram_url: formData.get('instagram_url')?.toString() || store.instagram_url || '',
        facebook_url: formData.get('facebook_url')?.toString() || store.facebook_url || '',
        tiktok_url: formData.get('tiktok_url')?.toString() || store.tiktok_url || '',
        website_url: formData.get('website_url')?.toString() || store.website_url || '',
        business_hours_text: formData.get('business_hours_text')?.toString() || store.business_hours_text || '',
        business_category: businessCategory || formData.get('business_category')?.toString() || store.business_category || '',
        show_prices: showPrices,
        allow_multiple_appointments: allowMultiple,
        max_appointments_per_slot: maxPerSlot,
        slug: slug || '',
        gallery_images: JSON.stringify([...galleryImages].sort()),
        profile_image_url: profileImageUrl,
        banner_image_url: bannerImageUrl,
      }

      const initial = {
        ...initialValuesRef.current,
        gallery_images: JSON.stringify([...(initialValuesRef.current.gallery_images || [])].sort()),
      }

      const hasChanges = JSON.stringify(current) !== JSON.stringify(initial)

      if (hasChanges) {
        e.preventDefault()
        e.returnValue = '' // Chrome requiere returnValue
        return '' // Algunos navegadores requieren return
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [store, showPrices, allowMultiple, maxPerSlot, slug, galleryImages, profileImageUrl, bannerImageUrl, city, province, address])

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
      setCity(storeData.location || storeData.city || '')
      setProvince(storeData.province || '')
      setAddress(storeData.address || '')
      setBusinessCategory(storeData.business_category || '')

      // Guardar valores iniciales para comparar
      initialValuesRef.current = {
        name: storeData.name || '',
        description: storeData.description || '',
        short_bio: storeData.short_bio || '',
        location: storeData.location || '',
        city: storeData.city || '',
        province: storeData.province || '',
        address: storeData.address || '',
        whatsapp_url: storeData.whatsapp_url || '',
        phone: storeData.phone || '',
        email: storeData.email || '',
        instagram_url: storeData.instagram_url || '',
        facebook_url: storeData.facebook_url || '',
        tiktok_url: storeData.tiktok_url || '',
        website_url: storeData.website_url || '',
        business_hours_text: storeData.business_hours_text || '',
        business_category: storeData.business_category || '',
        show_prices: storeData.show_prices !== false,
        allow_multiple_appointments: storeData.allow_multiple_appointments || false,
        max_appointments_per_slot: storeData.max_appointments_per_slot || 1,
        slug: storeData.slug || '',
        gallery_images: storeData.gallery_images || [],
        profile_image_url: storeData.profile_image_url || '',
        banner_image_url: storeData.banner_image_url || '',
      }
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
        location: city || (formData.get('city')?.toString() ?? store.location ?? store.city ?? ''),
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
        city: city || (formData.get('city')?.toString() ?? store.city ?? ''),
        province: province || (formData.get('province')?.toString() ?? store.province ?? ''),
        address: address || (formData.get('address')?.toString() ?? store.address ?? ''),
        phone: formData.get('phone')?.toString() ?? store.phone ?? '',
        email: formData.get('email')?.toString() ?? store.email ?? '',
        instagram_url: formData.get('instagram_url')?.toString() ?? store.instagram_url ?? '',
        facebook_url: formData.get('facebook_url')?.toString() ?? store.facebook_url ?? '',
        tiktok_url: formData.get('tiktok_url')?.toString() ?? store.tiktok_url ?? '',
        website_url: formData.get('website_url')?.toString() ?? store.website_url ?? '',
        business_hours_text: formData.get('business_hours_text')?.toString() ?? store.business_hours_text ?? '',
        business_category: businessCategory || (formData.get('business_category')?.toString() ?? store.business_category ?? ''),
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
      
      // Actualizar valores iniciales después de guardar
      initialValuesRef.current = {
        name: fullData.name || '',
        description: fullData.description || '',
        short_bio: fullData.short_bio || '',
        location: fullData.location || '',
        city: fullData.city || '',
        province: fullData.province || '',
        address: fullData.address || '',
        whatsapp_url: fullData.whatsapp_url || '',
        phone: fullData.phone || '',
        email: fullData.email || '',
        instagram_url: fullData.instagram_url || '',
        facebook_url: fullData.facebook_url || '',
        tiktok_url: fullData.tiktok_url || '',
        website_url: fullData.website_url || '',
        business_hours_text: fullData.business_hours_text || '',
        business_category: fullData.business_category || '',
        show_prices: fullData.show_prices !== false,
        allow_multiple_appointments: fullData.allow_multiple_appointments || false,
        max_appointments_per_slot: fullData.max_appointments_per_slot || 1,
        slug: fullData.slug || '',
        gallery_images: fullData.gallery_images || [],
        profile_image_url: fullData.profile_image_url || '',
        banner_image_url: fullData.banner_image_url || '',
      }
      
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
      <div className="bg-surface-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-surface-200 mb-8">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-600/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
        
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
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
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
        
        {/* TAB: Perfil */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* URL personalizada */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rubro del negocio
                </label>
                <select
                  name="business_category"
                  value={businessCategory}
                  onChange={(e) => setBusinessCategory(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white"
                >
                  <option value="">Selecciona un rubro</option>
                  {BUSINESS_CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-sm text-gray-400">
                  Ayuda a los clientes a encontrar tu negocio más fácilmente
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    placeholder="Buenos Aires"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Provincia
                  </label>
                  <select
                    name="province"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white"
                  >
                    {ARGENTINA_PROVINCES.map((prov) => (
                      <option key={prov.value} value={prov.value}>
                        {prov.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dirección completa
                </label>
                <AddressAutocomplete
                  value={address}
                  onChange={(newAddress, placeDetails) => {
                    setAddress(newAddress)
                    
                    // Si tenemos detalles del lugar, intentar extraer ciudad y provincia si no están definidas
                    if (placeDetails?.address_components && (!city || !province)) {
                      let extractedCity = city
                      let extractedProvince = province
                      
                      placeDetails.address_components.forEach((component: any) => {
                        const types = component.types || []
                        
                        // Buscar ciudad/localidad
                        if (!extractedCity && (types.includes('locality') || types.includes('administrative_area_level_2'))) {
                          extractedCity = component.long_name
                        }
                        
                        // Buscar provincia
                        if (!extractedProvince && types.includes('administrative_area_level_1')) {
                          extractedProvince = component.long_name
                        }
                      })
                      
                      if (extractedCity && !city) setCity(extractedCity)
                      if (extractedProvince && !province) setProvince(extractedProvince)
                    }
                  }}
                  city={city}
                  province={province}
                  placeholder="Av. Corrientes 1234, CABA"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <p className="mt-2 text-sm text-gray-400">
                  Escribe para buscar direcciones.
                </p>
              </div>

              {/* Sucursales PRO */}
              {isPremium && store && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <BranchesManager storeId={store.id} />
                </div>
              )}
             
            </div>
          </div>
        )}

        {/* TAB: Imágenes */}
        {activeTab === 'images' && store && (
          <div className="space-y-6">
            {/* Logo */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Logo o foto de perfil</h2>
                  <p className="text-sm text-gray-500">Aparecerá en tu perfil público y en el dashboard</p>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-start gap-6">
                <div className="flex-shrink-0">
                  <ImageUpload
                    currentImageUrl={profileImageUrl}
                    onImageUploaded={setProfileImageUrl}
                    storeId={store.id}
                    type="logo"
                    aspectRatio="square"
                    label=""
                    description=""
                    maxWidth="w-32"
                  />
                </div>
                <div className="flex-1 space-y-3">
                  
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      <strong>Recomendaciones:</strong>
                    </p>
                    <ul className="text-sm text-gray-500 space-y-1 list-disc list-inside">
                      <li>Imagen cuadrada (400x400 px o más)</li>
                      <li>Formato PNG, JPG o WEBP</li>
                      <li>Máximo 5MB</li>
                      <li>Fondo transparente o sólido</li>
                    </ul>
                  </div>
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
               Contacto
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  WhatsApp
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-4 rounded-l-xl border border-r-0 border-gray-200 bg-gray-50 text-gray-500 text-sm">
                    +54
                  </span>
                  <input
                    type="text"
                    name="whatsapp_url"
                    defaultValue={store.whatsapp_url || ''}
                    className="flex-1 px-4 py-3 border border-gray-200 rounded-r-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    placeholder="111234567"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-400">
                  Número con código de país, sin espacios y sin 15.
                </p>
              </div>

              <div >
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={store.email || ''}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    placeholder="contacto@tunegocio.com"
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
            {/* Sincronización con Google Calendar */}
            {isAppointments && <GoogleCalendarSync />}

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
            onClick={() => handleNavigation('/dashboard')}
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

      {/* Modal de advertencia de cambios sin guardar */}
      {showUnsavedModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-scaleIn">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">¿Descartar cambios?</h3>
                  <p className="text-sm text-gray-500 mt-1">Tienes cambios sin guardar que se perderán</p>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-6">
                Si sales ahora, perderás todos los cambios que no hayas guardado. ¿Estás seguro de que quieres continuar?
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={cancelNavigation}
                  className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmNavigation}
                  className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 transition-colors"
                >
                  Descartar cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
