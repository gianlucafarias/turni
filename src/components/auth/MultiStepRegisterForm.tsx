import { useState } from 'react'
import { supabase } from '../../lib/supabase'

// Provincias de Argentina
const PROVINCIAS = [
  'Buenos Aires',
  'Ciudad Autónoma de Buenos Aires',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
]

// Rubros de negocio
const BUSINESS_CATEGORIES = [
  {
    id: 'profesional',
    name: 'Profesional',
    description: 'Abogados, contadores, consultores, etc.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'peluqueria',
    name: 'Peluquería',
    description: 'Cortes, peinados, tinturas, etc.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
  },
  {
    id: 'salud',
    name: 'Sector Salud',
    description: 'Médicos, dentistas, psicólogos, etc.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  {
    id: 'estetica',
    name: 'Estética',
    description: 'Depilación, uñas, tratamientos faciales, etc.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'fitness',
    name: 'Fitness y Deportes',
    description: 'Gimnasios, entrenadores, clases, etc.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    id: 'otro',
    name: 'Otro',
    description: 'Otro tipo de negocio',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
]

// Tipos de tienda con descripciones
const STORE_TYPES = [
  {
    id: 'appointments',
    name: 'Agendar Turnos',
    description: 'Gestioná reservas y turnos para tu negocio',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
]

// Planes disponibles
const PLANS = [
  {
    id: 'free',
    name: 'Gratis',
    price: 0,
    description: 'Ideal para empezar',
    features: [
      'Hasta 5 productos',
      '1 servicio para turnos',
      '30 turnos por mes',
      'Página pública de tu negocio',
    ],
    highlighted: false,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 2999,
    description: 'Para negocios en crecimiento',
    features: [
      'Productos ilimitados',
      'Servicios ilimitados',
      'Turnos ilimitados',
      'Gestión de clientes',
      'Notificaciones por WhatsApp',
      'Estadísticas avanzadas',
    ],
    highlighted: true,
    badge: 'Más Popular',
  },
]

// Días de la semana para horarios
const DIAS_SEMANA = [
  { id: 0, nombre: 'Lunes', abrev: 'Lun' },
  { id: 1, nombre: 'Martes', abrev: 'Mar' },
  { id: 2, nombre: 'Miércoles', abrev: 'Mié' },
  { id: 3, nombre: 'Jueves', abrev: 'Jue' },
  { id: 4, nombre: 'Viernes', abrev: 'Vie' },
  { id: 5, nombre: 'Sábado', abrev: 'Sáb' },
  { id: 6, nombre: 'Domingo', abrev: 'Dom' },
]

interface FormData {
  // Paso 1: Datos personales
  firstName: string
  lastName: string
  birthDate: string
  provincia: string
  localidad: string
  email: string
  password: string
  confirmPassword: string
  // Paso 2: Datos del negocio
  businessCategory: string
  
  // Paso 2: Datos de la tienda
  storeName: string
  storeType: 'products' | 'appointments'
  storeDescription: string
  slug: string
  
  // Paso 3: Config inicial (para turnos)
  initialService: string
  serviceDuration: number
  servicePrice: number
  workDays: number[]
  isContinuous: boolean
  startTime: string
  endTime: string
  morningStart: string
  morningEnd: string
  afternoonStart: string
  afternoonEnd: string
  
  // Paso 4: Plan
  selectedPlan: string
}

export default function MultiStepRegisterForm() {
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [checkingEmail, setCheckingEmail] = useState(false)
  
  const [formData, setFormData] = useState<FormData>({
    // Paso 1
    firstName: '',
    lastName: '',
    birthDate: '',
    provincia: '',
    localidad: '',
    email: '',
    password: '',
    confirmPassword: '',
    // Paso 2
    businessCategory: '',
    // Paso 2
    storeName: '',
    storeType: 'appointments',
    storeDescription: '',
    slug: '',
    // Paso 3
    initialService: '',
    serviceDuration: 30,
    servicePrice: 0,
    workDays: [0, 1, 2, 3, 4], // Lunes a Viernes por defecto
    isContinuous: true,
    startTime: '09:00',
    endTime: '18:00',
    morningStart: '09:00',
    morningEnd: '13:00',
    afternoonStart: '16:00',
    afternoonEnd: '20:00',
    // Paso 4
    selectedPlan: 'free',
  })

  const totalSteps = 4 // Siempre 4 pasos para turnos

  const updateField = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const toggleWorkDay = (dayId: number) => {
    setFormData(prev => ({
      ...prev,
      workDays: prev.workDays.includes(dayId)
        ? prev.workDays.filter(d => d !== dayId)
        : [...prev.workDays, dayId].sort()
    }))
  }

  // Validar slug
  const validateSlug = async (newSlug: string): Promise<boolean> => {
    if (!newSlug.trim()) {
      setSlugError(null)
      return true // El slug es opcional
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
    const { data: existing } = await supabase
      .from('stores')
      .select('id')
      .eq('slug', newSlug)
      .single()

    if (existing) {
      setSlugError('Esta URL ya está en uso')
      return false
    }

    setSlugError(null)
    return true
  }

  // Formatear slug automáticamente
  const handleSlugChange = async (value: string) => {
    // Auto-formatear: minúsculas, sin espacios
    const formatted = value.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
    
    updateField('slug', formatted)
    
    if (formatted) {
      await validateSlug(formatted)
    } else {
      setSlugError(null)
    }
  }

  // Verificar si el email ya existe en la base de datos
  const checkEmailExists = async (email: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('check_email_exists', {
        p_email: email.trim().toLowerCase()
      })
      
      if (error) {
        console.error('Error verificando email:', error)
        return false // Si hay error, asumimos que no existe para no bloquear
      }
      
      return data === true
    } catch (err) {
      console.error('Error verificando email:', err)
      return false // Si hay error, asumimos que no existe para no bloquear
    }
  }



  const validateStep = async (step: number): Promise<boolean> => {
    switch (step) {
      case 1:
        if (!formData.firstName.trim()) {
          setError('Por favor ingresá tu nombre')
          return false
        }
        if (!formData.lastName.trim()) {
          setError('Por favor ingresá tu apellido')
          return false
        }
        if (!formData.email.trim()) {
          setError('Por favor ingresá tu email')
          return false
        }
        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(formData.email.trim())) {
          setError('Por favor ingresá un email válido')
          return false
        }
        if (!formData.password || formData.password.length < 6) {
          setError('La contraseña debe tener al menos 6 caracteres')
          return false
        }
        if (formData.password !== formData.confirmPassword) {
          setError('Las contraseñas no coinciden')
          return false
        }
        
        // Verificar si el email ya existe
        setCheckingEmail(true)
        setError(null)
        try {
          const emailExists = await checkEmailExists(formData.email.trim())
          if (emailExists) {
            setError('Ya existe una cuenta con este correo electrónico. ¿Querés iniciar sesión?')
            setCheckingEmail(false)
            return false
          }
        } catch (err) {
          // Si hay error al verificar, continuamos (mejor intentar crear y ver qué pasa)
          console.log('Error verificando email:', err)
        }
        setCheckingEmail(false)
        return true
      case 2:
        if (!formData.businessCategory) {
          setError('Por favor seleccioná el rubro de tu negocio')
          return false
        }
        if (!formData.storeName.trim() || formData.storeName.length < 3) {
          setError('El nombre de la tienda debe tener al menos 3 caracteres')
          return false
        }
        // Validar slug si se proporcionó
        if (formData.slug.trim() && slugError) {
          setError('Por favor corrige el error en la URL personalizada')
          return false
        }
        if (formData.slug.trim() && !(await validateSlug(formData.slug.trim()))) {
          setError('Por favor corrige el error en la URL personalizada')
          return false
        }
        return true
      case 3:
        if (formData.storeType === 'appointments') {
          if (!formData.initialService.trim()) {
            setError('Por favor ingresá al menos un servicio')
            return false
          }
          if (formData.workDays.length === 0) {
            setError('Seleccioná al menos un día de trabajo')
            return false
          }
        }
        return true
      default:
        return true
    }
  }

  const nextStep = async () => {
    const isValid = await validateStep(currentStep)
    if (isValid) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const prevStep = () => {
    setCurrentStep(prev => prev - 1)
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      // Validaciones mínimas antes de llamar a Supabase
      if (!formData.email || !formData.password || !formData.confirmPassword) {
        setError('Completá email y contraseña')
        setLoading(false)
        return
      }
      if (formData.password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres')
        setLoading(false)
        return
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Las contraseñas no coinciden')
        setLoading(false)
        return
      }

      // 1. Crear usuario
      const trimmedEmail = formData.email.trim().toLowerCase()
      const redirectBase = typeof window !== 'undefined' ? window.location.origin : ''
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: formData.password,
        options: {
          emailRedirectTo: `${redirectBase}/auth/callback`,
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            birth_date: formData.birthDate || null,
            provincia: formData.provincia,
            localidad: formData.localidad,
            business_category: formData.businessCategory,
          }
        }
      })

      if (authError) {
        const msg = (authError.message || '').toLowerCase()
        console.error('Supabase signup error:', authError)
        
        // Manejar diferentes tipos de errores
        if (msg.includes('already registered') || 
            msg.includes('user already registered') || 
            msg.includes('already exists') ||
            msg.includes('email address is already registered')) {
          setError('Ya existe una cuenta con este correo electrónico. ¿Querés iniciar sesión?')
          setLoading(false)
          return
        }
        
        if (msg.includes('invalid email') || msg.includes('email address')) {
          setError('El correo electrónico no es válido. Por favor verifica que esté escrito correctamente.')
          setLoading(false)
          return
        }
        
        if (msg.includes('password')) {
          setError('La contraseña debe tener al menos 6 caracteres')
          setLoading(false)
          return
        }
        
        // Mostrar el mensaje exacto de Supabase
        setError(authError.message || 'Error al crear la cuenta')
        setLoading(false)
        return
      }

      if (!authData.user?.id) throw new Error('No se pudo crear el usuario')

      // 2. Esperar un momento para que se establezca la sesión
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 3. Crear tienda
      const categoryName = BUSINESS_CATEGORIES.find(c => c.id === formData.businessCategory)?.name || formData.businessCategory
      const storeData: any = {
        name: formData.storeName,
        user_id: authData.user.id,
        store_type: formData.storeType,
        plan: formData.selectedPlan === 'free' ? 'free' : 'premium',
        products_count: 0,
        setup_completed: false, // Se completará después de configurar servicios
        description: formData.storeDescription || `Negocio de ${categoryName}`,
        location: formData.localidad && formData.provincia 
          ? `${formData.localidad}, ${formData.provincia}` 
          : '',
        business_category: formData.businessCategory,
      }
      
      // Solo incluir slug si tiene valor y no hay error
      if (formData.slug.trim() && !slugError) {
        storeData.slug = formData.slug.trim()
      }
      
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .insert(storeData)
        .select()
        .single()

      if (storeError) throw storeError

      // 4. Crear servicio y horarios iniciales
      if (store) {
        // Crear servicio inicial
        if (formData.initialService.trim()) {
          await supabase.from('services').insert({
            store_id: store.id,
            name: formData.initialService,
            duration: formData.serviceDuration,
            price: formData.servicePrice,
            active: true,
          })
        }

        // Crear horarios
        for (const day of formData.workDays) {
          await supabase.from('schedules').insert({
            store_id: store.id,
            day: day,
            enabled: true,
            is_continuous: formData.isContinuous,
            start_time: formData.isContinuous ? formData.startTime : null,
            end_time: formData.isContinuous ? formData.endTime : null,
            morning_start: formData.isContinuous ? null : formData.morningStart,
            morning_end: formData.isContinuous ? null : formData.morningEnd,
            afternoon_start: formData.isContinuous ? null : formData.afternoonStart,
            afternoon_end: formData.isContinuous ? null : formData.afternoonEnd,
            slot_duration: formData.serviceDuration,
          })
        }

        // Marcar setup como completado si tiene servicio y horarios
        if (formData.initialService.trim() && formData.workDays.length > 0) {
          await supabase
            .from('stores')
            .update({ setup_completed: true })
            .eq('id', store.id)
        }
      }

      // 5. Redirigir (sin forzar verificación de email)
      window.location.href = '/dashboard'

    } catch (error: any) {
      console.error('Error en registro:', error)
      let errorMessage = 'Error al crear la cuenta'
      
      if (error?.message) {
        const msg = error.message.toLowerCase()
        if (msg.includes('duplicate') || msg.includes('already')) {
          errorMessage = 'Ya existe una cuenta con este correo electrónico'
        } else if (msg.includes('invalid') || msg.includes('email')) {
          errorMessage = 'El correo electrónico no es válido'
        } else if (msg.includes('password')) {
          errorMessage = 'La contraseña debe tener al menos 6 caracteres'
        } else {
          errorMessage = error.message
        }
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Renderizar el paso actual
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-display font-bold text-surface-900">Tus datos personales</h2>
              <p className="text-surface-600 mt-2">Contanos un poco sobre vos</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-surface-900 mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => updateField('firstName', e.target.value)}
                  className="w-full px-4 py-3 border border-surface-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-surface-900 placeholder-surface-400"
                  placeholder="Tu nombre"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-surface-900 mb-2">
                  Apellido *
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => updateField('lastName', e.target.value)}
                  className="w-full px-4 py-3 border border-surface-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-surface-900 placeholder-surface-400"
                  placeholder="Tu apellido"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-surface-900 mb-2">
                Fecha de nacimiento
              </label>
              <input
                type="date"
                value={formData.birthDate}
                onChange={(e) => updateField('birthDate', e.target.value)}
                className="w-full px-4 py-3 border border-surface-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-surface-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-surface-900 mb-2">
                  Provincia
                </label>
                <select
                  value={formData.provincia}
                  onChange={(e) => updateField('provincia', e.target.value)}
                  className="w-full px-4 py-3 border border-surface-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-surface-900 placeholder-surface-400"
                >
                  <option value="">Seleccionar...</option>
                  {PROVINCIAS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-surface-900 mb-2">
                  Localidad
                </label>
                <input
                  type="text"
                  value={formData.localidad}
                  onChange={(e) => updateField('localidad', e.target.value)}
                  className="w-full px-4 py-3 border border-surface-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-surface-900 placeholder-surface-400"
                  placeholder="Tu ciudad"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-surface-200">
              <p className="text-sm font-semibold text-surface-900 mb-4">Datos de acceso</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-surface-900 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    className="w-full px-4 py-3 border border-surface-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-surface-900 placeholder-surface-400"
                    placeholder="tu@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-surface-900 mb-2">
                    Contraseña *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    className="w-full px-4 py-3 border border-surface-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-surface-900 placeholder-surface-400"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-surface-900 mb-2">
                    Confirmar contraseña *
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => updateField('confirmPassword', e.target.value)}
                    className="w-full px-4 py-3 border border-surface-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-surface-900 placeholder-surface-400"
                    placeholder="Repetí tu contraseña"
                  />
                  {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">Las contraseñas no coinciden</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-display font-bold text-surface-900">Tu negocio</h2>
              <p className="text-surface-600 mt-2">Configurá tu tienda o servicio</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-surface-900 mb-3">
                Rubro de tu negocio *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {BUSINESS_CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => updateField('businessCategory', category.id)}
                    className={`p-4 border-2 rounded-xl text-left transition-all ${
                      formData.businessCategory === category.id
                        ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600 ring-offset-2'
                        : 'border-surface-200 hover:border-surface-300 hover:bg-surface-50'
                    }`}
                  >
                    <div className={`mb-2 ${formData.businessCategory === category.id ? 'text-brand-600' : 'text-surface-400'}`}>
                      {category.icon}
                    </div>
                    <h3 className="font-semibold text-surface-900 text-sm mb-1">{category.name}</h3>
                    <p className="text-xs text-surface-600">{category.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-surface-900 mb-2">
                Nombre de tu negocio *
              </label>
              <input
                type="text"
                value={formData.storeName}
                onChange={(e) => updateField('storeName', e.target.value)}
                className="w-full px-4 py-3 border border-surface-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-surface-900 placeholder-surface-400"
                placeholder="Ej: Peluquería María, Consultorio Dr. García..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-surface-900 mb-2">
                URL de tu sitio (opcional)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-surface-500 whitespace-nowrap">{typeof window !== 'undefined' ? window.location.origin : ''}/</span>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  className={`flex-1 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-surface-900 placeholder-surface-400 ${
                    slugError ? 'border-red-300 focus:border-red-500' : 'border-surface-300'
                  }`}
                  placeholder="mi-negocio"
                />
              </div>
              {slugError && (
                <p className="mt-2 text-sm text-red-600">{slugError}</p>
              )}
              <p className="mt-2 text-sm text-surface-500">
                Esta será la URL pública de tu negocio donde tus clientes reservarán sus turnos.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-surface-900 mb-2">
                Descripción breve
              </label>
              <textarea
                value={formData.storeDescription}
                onChange={(e) => updateField('storeDescription', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-surface-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all resize-none text-surface-900 placeholder-surface-400"
                placeholder="Contá brevemente qué ofrece tu negocio..."
              />
            </div>
          </div>
        )

      case 3:
        // Solo para turnos
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-display font-bold text-surface-900">Configuración inicial</h2>
              <p className="text-surface-600 mt-2">Configurá tu primer servicio y horarios</p>
            </div>

            {/* Servicio inicial */}
            <div className="bg-surface-50 rounded-2xl p-6">
              <h3 className="font-semibold text-surface-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Tu primer servicio
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-surface-900 mb-2">
                    Nombre del servicio *
                  </label>
                  <input
                    type="text"
                    value={formData.initialService}
                    onChange={(e) => updateField('initialService', e.target.value)}
                    className="w-full px-4 py-3 border border-surface-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-surface-900 placeholder-surface-400"
                    placeholder="Ej: Corte de pelo, Consulta, Clase..."
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-surface-900 mb-2">
                      Duración (minutos)
                    </label>
                    <select
                      value={formData.serviceDuration}
                      onChange={(e) => updateField('serviceDuration', parseInt(e.target.value))}
                      className="w-full px-4 py-3 border border-surface-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-surface-900 placeholder-surface-400"
                    >
                      <option value={15}>15 min</option>
                      <option value={30}>30 min</option>
                      <option value={45}>45 min</option>
                      <option value={60}>1 hora</option>
                      <option value={90}>1h 30min</option>
                      <option value={120}>2 horas</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-surface-900 mb-2">
                      Precio (opcional)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500">$</span>
                      <input
                        type="number"
                        value={formData.servicePrice || ''}
                        onChange={(e) => updateField('servicePrice', parseInt(e.target.value) || 0)}
                        className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Horarios */}
            <div className="bg-surface-50 rounded-2xl p-6">
              <h3 className="font-semibold text-surface-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Horarios de atención
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Días que trabajás *
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DIAS_SEMANA.map((dia) => (
                      <button
                        key={dia.id}
                        type="button"
                        onClick={() => toggleWorkDay(dia.id)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          formData.workDays.includes(dia.id)
                            ? 'bg-brand-600 text-white'
                            : 'bg-white border border-surface-300 text-surface-700 hover:bg-surface-50'
                        }`}
                      >
                        {dia.abrev}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tipo de horario */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-surface-900">Horario de corrido</span>
                  <button
                    type="button"
                    onClick={() => updateField('isContinuous', !formData.isContinuous)}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      formData.isContinuous ? 'bg-brand-600' : 'bg-surface-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${
                        formData.isContinuous ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {formData.isContinuous ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-surface-900 mb-2">
                        Hora de inicio
                      </label>
                      <input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => updateField('startTime', e.target.value)}
                        className="w-full px-4 py-3 border border-surface-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-surface-900 placeholder-surface-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-surface-900 mb-2">
                        Hora de fin
                      </label>
                      <input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => updateField('endTime', e.target.value)}
                        className="w-full px-4 py-3 border border-surface-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-surface-900 placeholder-surface-400"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-surface-900 mb-3">
                        Turno mañana
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-surface-600 mb-1">Inicio</label>
                          <input
                            type="time"
                            value={formData.morningStart}
                            onChange={(e) => updateField('morningStart', e.target.value)}
                            className="w-full px-4 py-3 border border-surface-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-surface-900 bg-amber-50"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-surface-600 mb-1">Fin</label>
                          <input
                            type="time"
                            value={formData.morningEnd}
                            onChange={(e) => updateField('morningEnd', e.target.value)}
                            className="w-full px-4 py-3 border border-surface-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-surface-900 bg-amber-50"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-surface-900 mb-3">
                        Turno tarde
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-surface-600 mb-1">Inicio</label>
                          <input
                            type="time"
                            value={formData.afternoonStart}
                            onChange={(e) => updateField('afternoonStart', e.target.value)}
                            className="w-full px-4 py-3 border border-surface-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-surface-900 bg-blue-50"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-surface-600 mb-1">Fin</label>
                          <input
                            type="time"
                            value={formData.afternoonEnd}
                            onChange={(e) => updateField('afternoonEnd', e.target.value)}
                            className="w-full px-4 py-3 border border-surface-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-surface-900 bg-blue-50"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <p className="text-sm text-surface-500 text-center">
              💡 Podés agregar más servicios y ajustar horarios después desde tu panel
            </p>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-display font-bold text-surface-900">Elegí tu plan</h2>
              <p className="text-surface-600 mt-2">Empezá gratis o pasate a Premium</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => updateField('selectedPlan', plan.id)}
                  className={`relative p-6 border-2 rounded-2xl text-left transition-all ${
                    formData.selectedPlan === plan.id
                      ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600 ring-offset-2'
                      : 'border-surface-200 hover:border-surface-300'
                  }`}
                >
                  {plan.badge && (
                    <span className="absolute -top-3 left-4 px-3 py-1 bg-brand-600 text-white text-xs font-semibold rounded-full">
                      {plan.badge}
                    </span>
                  )}
                  
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-surface-900">{plan.name}</h3>
                    <p className="text-sm text-surface-600">{plan.description}</p>
                  </div>

                  <div className="mb-6">
                    {plan.price === 0 ? (
                      <span className="text-3xl font-bold text-surface-900">Gratis</span>
                    ) : (
                      <div>
                        <span className="text-3xl font-bold text-surface-900">
                          ${plan.price.toLocaleString('es-AR')}
                        </span>
                        <span className="text-surface-500">/mes</span>
                      </div>
                    )}
                  </div>

                  <ul className="space-y-2">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-surface-700">
                        <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {formData.selectedPlan === plan.id && (
                    <div className="absolute top-4 right-4">
                      <div className="w-6 h-6 bg-brand-600 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {formData.selectedPlan === 'premium' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <p className="text-amber-800 text-sm">
                  💳 El pago se procesará después de crear tu cuenta
                </p>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  // Calcular progreso
  const getStepNumber = () => {
    return currentStep
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="mb-8 px-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-surface-600">
            Paso {getStepNumber()} de {totalSteps}
          </span>
          <span className="text-sm text-surface-500">
            {Math.round((getStepNumber() / totalSteps) * 100)}%
          </span>
        </div>
        <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-500"
            style={{ width: `${(getStepNumber() / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Form container */}
      <div className="bg-white rounded-2xl shadow-xl p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {renderStep()}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t border-surface-200">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={prevStep}
              className="px-6 py-3 text-surface-700 font-medium hover:bg-surface-100 rounded-xl transition-colors"
            >
              ← Anterior
            </button>
          ) : (
            <div />
          )}

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={nextStep}
              disabled={!!slugError || checkingEmail}
              className="px-8 py-3 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
            >
              {checkingEmail ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Verificando...
                </>
              ) : (
                'Continuar →'
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="px-8 py-3 bg-gradient-to-r from-brand-600 to-brand-700 text-white font-semibold rounded-xl hover:from-brand-700 hover:to-brand-800 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creando cuenta...
                </>
              ) : (
                <>
                  Crear mi cuenta
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Login link */}
      <p className="text-center text-surface-600 mt-6">
        ¿Ya tenés una cuenta?{' '}
        <a href="/login" className="text-brand-600 font-semibold hover:text-brand-700 transition-colors">
          Iniciar sesión
        </a>
      </p>
    </div>
  )
}

