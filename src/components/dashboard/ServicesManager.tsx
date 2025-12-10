import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSubscriptionLimits } from '../../hooks/useSubscriptionLimits'
import { UpgradePrompt } from './UpgradePrompt'

interface Service {
  id: string
  name: string
  description: string
  duration: number
  price: number
  active: boolean
  available_days: number[]
  start_date: string | null
  end_date: string | null
}

const DAYS = [
  { index: 0, name: 'Lun', fullName: 'Lunes' },
  { index: 1, name: 'Mar', fullName: 'Martes' },
  { index: 2, name: 'Mié', fullName: 'Miércoles' },
  { index: 3, name: 'Jue', fullName: 'Jueves' },
  { index: 4, name: 'Vie', fullName: 'Viernes' },
  { index: 5, name: 'Sáb', fullName: 'Sábado' },
  { index: 6, name: 'Dom', fullName: 'Domingo' }
]

export default function ServicesManager() {
  const [services, setServices] = useState<Service[]>([])
  const [store, setStore] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Límites de suscripción
  const { isPremium, checkLimit } = useSubscriptionLimits()
  const serviceLimit = checkLimit('services')

  // Form state
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formDuration, setFormDuration] = useState(30)
  const [formPrice, setFormPrice] = useState(0)
  const [formDays, setFormDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const [formHasDateRange, setFormHasDateRange] = useState(false)
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/login'; return }

      const { data: storeData } = await supabase.from('stores').select('*').eq('user_id', session.user.id).single()
      if (!storeData || storeData.store_type !== 'appointments') { window.location.href = '/dashboard'; return }

      setStore(storeData)
      const { data: servicesData } = await supabase.from('services').select('*').eq('store_id', storeData.id).order('name')
      setServices(servicesData || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  function openForm(service?: Service) {
    if (service) {
      setEditingService(service)
      setFormName(service.name)
      setFormDescription(service.description || '')
      setFormDuration(service.duration)
      setFormPrice(service.price)
      setFormDays(service.available_days || [0, 1, 2, 3, 4, 5, 6])
      setFormHasDateRange(!!service.start_date || !!service.end_date)
      setFormStartDate(service.start_date || '')
      setFormEndDate(service.end_date || '')
    } else {
      setEditingService(null)
      setFormName('')
      setFormDescription('')
      setFormDuration(30)
      setFormPrice(0)
      setFormDays([0, 1, 2, 3, 4, 5, 6])
      setFormHasDateRange(false)
      setFormStartDate('')
      setFormEndDate('')
    }
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingService(null)
    setError(null)
  }

  function toggleDay(day: number) {
    if (formDays.includes(day)) {
      setFormDays(formDays.filter(d => d !== day))
    } else {
      setFormDays([...formDays, day].sort())
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (formDays.length === 0) {
      setError('Debes seleccionar al menos un día')
      return
    }
    
    setSaving(true)
    setError(null)

    const data = {
      store_id: store.id,
      name: formName.trim(),
      description: formDescription.trim(),
      duration: formDuration,
      price: formPrice,
      available_days: formDays,
      start_date: formHasDateRange && formStartDate ? formStartDate : null,
      end_date: formHasDateRange && formEndDate ? formEndDate : null,
      active: true
    }

    try {
      if (editingService) {
        await supabase.from('services').update(data).eq('id', editingService.id)
      } else {
        await supabase.from('services').insert(data)
      }
      closeForm()
      loadData()
    } catch (error: any) {
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(service: Service) {
    await supabase.from('services').update({ active: !service.active }).eq('id', service.id)
    loadData()
  }

  async function deleteService(id: string) {
    if (!confirm('¿Eliminar este servicio?')) return
    await supabase.from('services').delete().eq('id', id)
    loadData()
  }

  function formatAvailability(service: Service) {
    const days = service.available_days || [0, 1, 2, 3, 4, 5, 6]
    
    // Si son todos los días
    if (days.length === 7) return 'Todos los días'
    
    // Si es Lun-Vie
    if (days.length === 5 && [0,1,2,3,4].every(d => days.includes(d))) return 'Lun - Vie'
    
    // Si es fin de semana
    if (days.length === 2 && days.includes(5) && days.includes(6)) return 'Sáb - Dom'
    
    // Mostrar días específicos
    return days.map(d => DAYS[d].name).join(', ')
  }

  function isServiceActive(service: Service) {
    if (!service.active) return false
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (service.start_date) {
      const start = new Date(service.start_date + 'T00:00:00')
      if (today < start) return false
    }
    
    if (service.end_date) {
      const end = new Date(service.end_date + 'T23:59:59')
      if (today > end) return false
    }
    
    return true
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  // Verificar si puede agregar más servicios
  const canAddMore = serviceLimit.allowed || editingService !== null
  const atLimit = !isPremium && serviceLimit.max !== -1 && !serviceLimit.allowed

  return (
    <div className="max-w-4xl mx-auto">
      {/* Banner de límite */}
      {atLimit && (
        <UpgradePrompt 
          feature="services" 
          currentCount={serviceLimit.current} 
          limit={serviceLimit.max} 
          variant="banner" 
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Servicios</h1>
          <p className="text-gray-500 mt-1">
            Define qué servicios ofreces a tus clientes
            {!isPremium && serviceLimit.max !== -1 && (
              <span className="text-gray-400"> · {serviceLimit.current}/{serviceLimit.max} del plan</span>
            )}
          </p>
        </div>
        {canAddMore ? (
          <button
            onClick={() => openForm()}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Servicio
          </button>
        ) : (
          <a
            href="/dashboard/subscription"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-2.5 rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-colors shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            Actualizar para más servicios
          </a>
        )}
      </div>

      {/* Lista */}
      {services.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-indigo-50 rounded-2xl flex items-center justify-center">
            <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin servicios</h3>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
            Agrega los servicios que ofreces para que tus clientes puedan reservar turnos
          </p>
          <button
            onClick={() => openForm()}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            Agregar primer servicio
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {services.map((service) => {
            const isActive = isServiceActive(service)
            
            return (
              <div
                key={service.id}
                className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 transition-all hover:shadow-md ${!isActive ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{service.name}</h3>
                      {!service.active && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Pausado</span>
                      )}
                      {service.active && !isActive && (
                        <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">Fuera de fecha</span>
                      )}
                    </div>
                    {service.description && (
                      <p className="text-gray-500 text-sm mt-1 line-clamp-1">{service.description}</p>
                    )}
                    
                    {/* Info de disponibilidad */}
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      <span className="inline-flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded-lg">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {service.duration} min
                      </span>
                      
                      <span className="inline-flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded-lg">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {formatAvailability(service)}
                      </span>

                      {(service.start_date || service.end_date) && (
                        <span className="inline-flex items-center gap-1.5 text-sm text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {service.start_date && new Date(service.start_date + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                          {service.start_date && service.end_date && ' - '}
                          {service.end_date && new Date(service.end_date + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                          {!service.start_date && service.end_date && `Hasta ${new Date(service.end_date + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })}`}
                        </span>
                      )}

                      {service.price > 0 && (
                        <span className="text-lg font-bold text-indigo-600">${service.price.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleActive(service)}
                      className={`p-2 rounded-xl transition-colors ${service.active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                      title={service.active ? 'Pausar' : 'Activar'}
                    >
                      {service.active ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => openForm(service)}
                      className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteService(service.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 my-8 animate-fadeIn">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingService ? 'Editar Servicio' : 'Nuevo Servicio'}
              </h2>
              <button
                onClick={closeForm}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-xl text-sm">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre del servicio *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Corte de pelo"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 focus:ring-0 transition-colors"
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Describe brevemente el servicio..."
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 focus:ring-0 transition-colors resize-none"
                />
              </div>

              {/* Duración y Precio */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Duración *</label>
                  <select
                    required
                    value={formDuration}
                    onChange={(e) => setFormDuration(parseInt(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 focus:ring-0 transition-colors"
                  >
                    <option value="15">15 min</option>
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">1 hora</option>
                    <option value="90">1:30 hs</option>
                    <option value="120">2 horas</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Precio</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={formPrice}
                      onChange={(e) => setFormPrice(parseFloat(e.target.value) || 0)}
                      className="w-full pl-8 pr-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 focus:ring-0 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Días disponibles */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ¿Qué días ofreces este servicio? *
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => (
                    <button
                      key={day.index}
                      type="button"
                      onClick={() => toggleDay(day.index)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        formDays.includes(day.index)
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {day.name}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setFormDays([0, 1, 2, 3, 4])}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Lun-Vie
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => setFormDays([5, 6])}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Fin de semana
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => setFormDays([0, 1, 2, 3, 4, 5, 6])}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Todos
                  </button>
                </div>
              </div>

              {/* Rango de fechas */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">
                    ¿Disponible solo en ciertas fechas?
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormHasDateRange(!formHasDateRange)}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      formHasDateRange ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${
                        formHasDateRange ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
                
                {formHasDateRange && (
                  <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-xl">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Desde</label>
                      <input
                        type="date"
                        value={formStartDate}
                        onChange={(e) => setFormStartDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-0 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Hasta</label>
                      <input
                        type="date"
                        value={formEndDate}
                        onChange={(e) => setFormEndDate(e.target.value)}
                        min={formStartDate}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-0 text-sm"
                      />
                    </div>
                    <p className="col-span-2 text-xs text-gray-400">
                      El servicio solo estará disponible entre estas fechas. Dejá vacío para sin límite.
                    </p>
                  </div>
                )}
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-200"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .line-clamp-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </div>
  )
}
