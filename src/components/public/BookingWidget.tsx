import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  storeId: string
}

interface Service {
  id: string
  name: string
  description: string
  duration: number
  price: number
  show_price: boolean
  available_days: number[]
  start_date: string | null
  end_date: string | null
}

interface Schedule {
  day: number
  enabled: boolean
  is_continuous: boolean
  start_time: string
  end_time: string
  morning_start: string
  morning_end: string
  afternoon_start: string
  afternoon_end: string
  slot_duration: number
}

interface Store {
  show_prices: boolean
  allow_multiple_appointments: boolean
  max_appointments_per_slot: number
}

interface DayOff {
  date: string
}

// Servicio "general" por defecto cuando no hay servicios configurados
const GENERAL_SERVICE: Service = {
  id: 'general',
  name: 'Turno',
  description: 'Reservar un turno',
  duration: 30, // Se actualizará según el slot_duration del schedule
  price: 0,
  show_price: false,
  available_days: [0, 1, 2, 3, 4, 5, 6],
  start_date: null,
  end_date: null
}

export default function BookingWidget({ storeId }: Props) {
  const [store, setStore] = useState<Store | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [daysOff, setDaysOff] = useState<DayOff[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [hasNoServices, setHasNoServices] = useState(false)
  
  const [step, setStep] = useState(1)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState('')
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [slotAvailability, setSlotAvailability] = useState<{ time: string; count: number; available: boolean }[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  
  const [clientName, setClientName] = useState('')
  const [clientLastName, setClientLastName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientLocation, setClientLocation] = useState('')
  
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [storeId])

  async function loadData() {
    try {
      const todayStr = new Date().toISOString().split('T')[0]
      
      // Cargar appointments
      const { data: allAppointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select('*')
        .eq('store_id', storeId)
      
      if (appointmentsError) {
        console.error('Error cargando appointments:', appointmentsError)
        setAppointments([])
      } else {
        const validAppointments = (allAppointments || []).filter(apt => {
          const isValidStatus = ['pending', 'confirmed'].includes(apt.status)
          const aptDateStr = typeof apt.date === 'string' ? apt.date.split('T')[0] : apt.date
          const isFuture = aptDateStr >= todayStr
          return isValidStatus && isFuture
        })
        setAppointments(validAppointments)
      }
      
      // Cargar store con manejo de errores (las columnas nuevas pueden no existir)
      let storeData: any = null
      try {
        const storeRes = await supabase.from('stores').select('show_prices, allow_multiple_appointments, max_appointments_per_slot').eq('id', storeId).single()
        if (storeRes.error) throw storeRes.error
        storeData = storeRes.data
      } catch (error: any) {
        // Si falla, intentar sin las columnas nuevas
        const { data: fallbackStore } = await supabase.from('stores').select('show_prices').eq('id', storeId).single()
        storeData = fallbackStore ? { ...fallbackStore, allow_multiple_appointments: false, max_appointments_per_slot: 1 } : null
      }
      
      const [servicesRes, schedulesRes, daysOffRes] = await Promise.all([
        supabase.from('services').select('*').eq('store_id', storeId).eq('active', true).order('price'),
        supabase.from('schedules').select('*').eq('store_id', storeId),
        supabase.from('days_off').select('date').eq('store_id', storeId)
      ])
      
      setStore(storeData)
      setSchedules(schedulesRes.data || [])
      setDaysOff(daysOffRes.data || [])
      
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const activeServices = (servicesRes.data || []).filter((service: Service) => {
        if (service.start_date) {
          const start = new Date(service.start_date + 'T00:00:00')
          if (today < start) return false
        }
        if (service.end_date) {
          const end = new Date(service.end_date + 'T23:59:59')
          if (today > end) return false
        }
        return true
      })
      
      // Si no hay servicios, usar el servicio general
      if (activeServices.length === 0) {
        setHasNoServices(true)
        // Obtener la duración del slot de cualquier schedule habilitado
        const enabledSchedule = (schedulesRes.data || []).find((s: Schedule) => s.enabled)
        if (enabledSchedule) {
          GENERAL_SERVICE.duration = enabledSchedule.slot_duration
        }
        setServices([GENERAL_SERVICE])
        // Auto-seleccionar el servicio general y saltar al paso 2
        setSelectedService(GENERAL_SERVICE)
        setStep(2)
      } else {
        setHasNoServices(false)
        setServices(activeServices)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const showPrices = store?.show_prices !== false

  function selectService(service: Service) {
    setSelectedService(service)
    setSelectedDate(null)
    setSelectedTime('')
    setSlotAvailability([])
    setStep(2)
  }

  function isDayOff(date: Date): boolean {
    const dateStr = date.toISOString().split('T')[0]
    return daysOff.some(d => d.date === dateStr)
  }

  function isDateAvailable(date: Date): boolean {
    // Verificar si es día libre
    if (isDayOff(date)) return false
    
    // Verificar que la tienda atienda ese día
    const dayOfWeek = date.getDay()
    const ourDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const schedule = schedules.find(s => s.day === ourDayIndex)
    if (!schedule?.enabled) return false
    
    // Si hay un servicio seleccionado (y no es el general), verificar disponibilidad del servicio
    if (selectedService && selectedService.id !== 'general') {
      const serviceDays = selectedService.available_days || [0, 1, 2, 3, 4, 5, 6]
      if (!serviceDays.includes(ourDayIndex)) return false
      
      if (selectedService.start_date) {
        const start = new Date(selectedService.start_date + 'T00:00:00')
        if (date < start) return false
      }
      if (selectedService.end_date) {
        const end = new Date(selectedService.end_date + 'T23:59:59')
        if (date > end) return false
      }
    }
    
    return true
  }

  async function selectDate(date: Date) {
    const dateStr = date.toISOString().split('T')[0]
    
    setSelectedDate(date)
    setSelectedTime('')
    setSlotAvailability([])
    setError(null)
    
    try {
      // Cargar appointments para esta fecha
      const { data: dateAppointments, error: fetchError } = await supabase
        .from('appointments')
        .select('*')
        .eq('store_id', storeId)
        .eq('date', dateStr)
        .in('status', ['pending', 'confirmed'])
      
      if (fetchError) throw fetchError
      
      // También actualizar la lista completa
      const todayStr = new Date().toISOString().split('T')[0]
      const { data: allAppointments } = await supabase
        .from('appointments')
        .select('*')
        .eq('store_id', storeId)
        .in('status', ['pending', 'confirmed'])
        .gte('date', todayStr)
      
      setAppointments(allAppointments || [])
      
      // Calcular slots con los appointments de la fecha seleccionada
      calculateAvailableSlotsWithAppointments(date, dateAppointments || [])
    } catch (error) {
      console.error('Error cargando appointments:', error)
      calculateAvailableSlots(date)
    }
  }
  
  function calculateAvailableSlotsWithAppointments(date: Date, appointmentsList: any[]) {
    const dayOfWeek = date.getDay()
    const ourDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const schedule = schedules.find(s => s.day === ourDayIndex)
    
    if (!schedule || !schedule.enabled) {
      setAvailableSlots([])
      setSlotAvailability([])
      return
    }

    const dateStr = date.toISOString().split('T')[0]
    const slots: { time: string; count: number; available: boolean }[] = []
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    const duration = selectedService?.duration || schedule.slot_duration
    const allowMultiple = store?.allow_multiple_appointments || false
    const maxPerSlot = store?.max_appointments_per_slot || 1

    // Contar turnos por horario
    const appointmentsByTime: Record<string, number> = {}
    
    appointmentsList.forEach(apt => {
      if (!apt.date || !apt.time) return
      
      // Normalizar fecha
      let aptDate = apt.date
      if (typeof aptDate === 'string') {
        aptDate = aptDate.includes('T') ? aptDate.split('T')[0] : aptDate
        if (aptDate.length > 10) aptDate = aptDate.substring(0, 10)
      }
      
      if (aptDate !== dateStr) return
      
      // Normalizar hora (formato HH:MM)
      let time = apt.time
      if (typeof time === 'string') {
        time = time.substring(0, 5)
        if (time.match(/^\d{2}:\d{2}$/)) {
          appointmentsByTime[time] = (appointmentsByTime[time] || 0) + 1
        }
      }
    })

    function addSlotsForRange(startTime: string, endTime: string) {
      const [startHour, startMin] = startTime.split(':').map(Number)
      const [endHour, endMin] = endTime.split(':').map(Number)
      let currentMinutes = startHour * 60 + startMin
      const endMinutes = endHour * 60 + endMin - duration

      while (currentMinutes <= endMinutes) {
        const hour = Math.floor(currentMinutes / 60)
        const min = currentMinutes % 60
        const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
        
        if (isToday) {
          const currentTime = now.getHours() * 60 + now.getMinutes()
          if (currentMinutes <= currentTime) {
            currentMinutes += schedule.slot_duration
            continue
          }
        }

        const currentCount = appointmentsByTime[timeStr] || 0
        const isAvailable = allowMultiple 
          ? currentCount < maxPerSlot 
          : currentCount === 0

        slots.push({
          time: timeStr,
          count: currentCount,
          available: isAvailable
        })
        
        currentMinutes += schedule.slot_duration
      }
    }

    if (schedule.is_continuous) {
      addSlotsForRange(schedule.start_time, schedule.end_time)
    } else {
      addSlotsForRange(schedule.morning_start, schedule.morning_end)
      addSlotsForRange(schedule.afternoon_start, schedule.afternoon_end)
    }

    setAvailableSlots(slots.map(s => s.time))
    setSlotAvailability(slots)
  }

  function calculateAvailableSlots(date: Date) {
    calculateAvailableSlotsWithAppointments(date, appointments)
  }

  function selectTime(time: string) {
    setSelectedTime(time)
    setStep(3)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedDate || !selectedTime) return
    
    // Validar que el slot aún esté disponible antes de reservar
    const dateStr = selectedDate.toISOString().split('T')[0]
    const allowMultiple = store?.allow_multiple_appointments || false
    const maxPerSlot = store?.max_appointments_per_slot || 1
    
    // Recargar appointments para verificar disponibilidad actual
    const { data: currentAppointments } = await supabase
      .from('appointments')
      .select('date, time, status')
      .eq('store_id', storeId)
      .eq('date', dateStr)
      .eq('time', selectedTime)
      .in('status', ['pending', 'confirmed'])
    
    const currentCount = currentAppointments?.length || 0
    const isAvailable = allowMultiple ? currentCount < maxPerSlot : currentCount === 0
    
    if (!isAvailable) {
      setError('Este horario ya no está disponible. Por favor, selecciona otro.')
      // Recargar datos para actualizar la vista
      await loadData()
      if (selectedDate) {
        calculateAvailableSlots(selectedDate)
      }
      return
    }
    
    setSubmitting(true)
    setError(null)

    try {
      const appointmentData: any = {
        store_id: storeId,
        date: dateStr,
        time: selectedTime,
        duration: selectedService?.duration || 30,
        client_name: `${clientName} ${clientLastName}`.trim(),
        client_email: clientEmail,
        client_phone: clientPhone,
        client_location: clientLocation,
        status: 'pending'
      }

      // Solo agregar datos del servicio si no es el general
      if (selectedService && selectedService.id !== 'general') {
        appointmentData.service_id = selectedService.id
        appointmentData.service_name = selectedService.name
        appointmentData.service_price = selectedService.price
      } else {
        appointmentData.service_name = 'Turno general'
        appointmentData.service_price = 0
      }

      const { error: insertError } = await supabase.from('appointments').insert(appointmentData)
      if (insertError) throw insertError
      
      // Recargar appointments después de crear
      await loadData()
      
      setStep(4)
    } catch (error: any) {
      setError(error.message || 'Error al reservar')
      // Recargar datos en caso de error
      await loadData()
      if (selectedDate) {
        calculateAvailableSlots(selectedDate)
      }
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    if (hasNoServices) {
      // Si no hay servicios, volver al paso 2 (calendario)
      setStep(2)
      setSelectedDate(null)
      setSelectedTime('')
    } else {
      setStep(1)
      setSelectedService(null)
      setSelectedDate(null)
      setSelectedTime('')
    }
    setSlotAvailability([])
    setClientName('')
    setClientLastName('')
    setClientEmail('')
    setClientPhone('')
    setClientLocation('')
  }

  function generateCalendarDays() {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
    
    const days: (Date | null)[] = []
    for (let i = 0; i < startOffset; i++) days.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))
    
    return days
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  function formatSelectedDate() {
    if (!selectedDate) return ''
    return selectedDate.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  function getServiceAvailabilityText(service: Service) {
    if (service.id === 'general') return null
    const days = service.available_days || [0, 1, 2, 3, 4, 5, 6]
    const DAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    
    if (days.length === 7) return null
    if (days.length === 5 && [0,1,2,3,4].every(d => days.includes(d))) return 'Solo Lun-Vie'
    if (days.length === 2 && days.includes(5) && days.includes(6)) return 'Solo fines de semana'
    
    return `Solo ${days.map(d => DAYS_SHORT[d]).join(', ')}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-10 h-10 border-3 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  // Si no hay schedules configurados
  if (schedules.filter(s => s.enabled).length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Sin horarios disponibles</h3>
        <p className="text-gray-500">El negocio aún no ha configurado sus horarios de atención</p>
      </div>
    )
  }

  const DAYS_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  // Calcular número de pasos según si hay servicios o no
  const totalSteps = hasNoServices ? 2 : 3
  const currentStepAdjusted = hasNoServices ? step - 1 : step

  return (
    <div>
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {Array.from({ length: totalSteps }).map((_, i) => {
          const stepNum = i + 1
          return (
            <div key={i} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                currentStepAdjusted >= stepNum ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {currentStepAdjusted > stepNum ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : stepNum}
              </div>
              {i < totalSteps - 1 && <div className={`w-12 h-1 mx-1 rounded transition-all ${currentStepAdjusted > stepNum ? 'bg-indigo-600' : 'bg-gray-100'}`} />}
            </div>
          )
        })}
      </div>

      {/* Paso 1: Elegir servicio (solo si hay servicios) */}
      {step === 1 && !hasNoServices && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">¿Qué servicio necesitas?</h3>
          {services.map(service => {
            const availabilityText = getServiceAvailabilityText(service)
            
            return (
              <button
                key={service.id}
                onClick={() => selectService(service)}
                className="w-full text-left p-5 bg-white border-2 border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 rounded-2xl transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900 group-hover:text-indigo-700">{service.name}</h4>
                    {service.description && (
                      <p className="text-sm text-gray-500 mt-1">{service.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="inline-flex items-center text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {service.duration} min
                      </span>
                      {availabilityText && (
                        <span className="inline-flex items-center text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                          {availabilityText}
                        </span>
                      )}
                      {(service.start_date || service.end_date) && (
                        <span className="inline-flex items-center text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                          {service.end_date && `Hasta ${new Date(service.end_date + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {showPrices && service.price > 0 && (
                      <span className="text-2xl font-bold text-indigo-600">${service.price.toLocaleString()}</span>
                    )}
                    <div className="mt-1 text-indigo-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                      Seleccionar →
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Paso 2: Elegir fecha y hora */}
      {step === 2 && (
        <div>
          {/* Resumen del servicio (solo si hay servicios) */}
          {!hasNoServices && selectedService && (
            <div className="bg-indigo-50 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-indigo-900">{selectedService.name}</p>
                  <p className="text-sm text-indigo-600">{selectedService.duration} minutos</p>
                </div>
                <button onClick={() => setStep(1)} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                  Cambiar
                </button>
              </div>
            </div>
          )}

          {/* Título para turno general */}
          {hasNoServices && (
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Elegí fecha y horario</h3>
              <p className="text-gray-500 text-sm">Seleccioná cuándo querés tu turno</p>
            </div>
          )}

          {/* Calendario */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                disabled={currentMonth.getMonth() === today.getMonth() && currentMonth.getFullYear() === today.getFullYear()}
                className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h4 className="font-semibold text-gray-900">
                {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h4>
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAYS_LABELS.map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-400 py-2">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {generateCalendarDays().map((date, i) => {
                if (!date) return <div key={i} className="aspect-square" />

                const isPast = date < today
                const isHoliday = isDayOff(date)
                const isAvailable = !isPast && !isHoliday && isDateAvailable(date)
                const isSelected = selectedDate?.toDateString() === date.toDateString()
                const isToday = date.toDateString() === today.toDateString()

                return (
                  <button
                    key={i}
                    onClick={() => isAvailable && selectDate(date)}
                    disabled={!isAvailable}
                    className={`aspect-square rounded-xl flex items-center justify-center text-sm font-medium transition-all relative ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                        : isAvailable
                          ? 'hover:bg-indigo-50 text-gray-700 hover:text-indigo-700'
                          : isHoliday && !isPast
                            ? 'text-red-300 cursor-not-allowed'
                            : 'text-gray-300 cursor-not-allowed'
                    } ${isToday && !isSelected ? 'ring-2 ring-indigo-200' : ''}`}
                    title={isHoliday ? 'Día no laborable' : ''}
                  >
                    {date.getDate()}
                    {isHoliday && !isPast && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-400 rounded-full" />
                    )}
                  </button>
                )
              })}
            </div>
            
            {daysOff.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
                <span className="w-2 h-2 bg-red-400 rounded-full" />
                <span>Día no laborable</span>
              </div>
            )}
          </div>

          {selectedDate && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Horarios para el {formatSelectedDate()}
              </h4>
              
              {slotAvailability.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-2xl">
                  <p className="text-gray-500">No hay horarios disponibles este día</p>
                  <p className="text-sm text-gray-400 mt-1">Prueba con otra fecha</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {slotAvailability.map(({ time, count, available }) => {
                    const allowMultiple = store?.allow_multiple_appointments || false
                    const maxPerSlot = store?.max_appointments_per_slot || 1
                    const remaining = maxPerSlot - count
                    
                    return (
                      <button
                        key={time}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          
                          if (!available) {
                            setError(`Este horario ya está ocupado (${count} turno${count !== 1 ? 's' : ''} reservado${count !== 1 ? 's' : ''}). Por favor, selecciona otro.`)
                            return
                          }
                          
                          selectTime(time)
                        }}
                        disabled={!available}
                        className={`py-3 px-3 text-sm font-semibold rounded-xl transition-all relative ${
                          available
                            ? 'bg-white border-2 border-gray-100 hover:border-indigo-500 hover:bg-indigo-50 text-gray-900 cursor-pointer'
                            : 'bg-gray-100 border-2 border-gray-200 text-gray-400 cursor-not-allowed opacity-60 pointer-events-none'
                        }`}
                        style={!available ? { pointerEvents: 'none' } : {}}
                        title={!available ? `Horario completo (${count} turno${count !== 1 ? 's' : ''} reservado${count !== 1 ? 's' : ''})` : allowMultiple && count > 0 ? `${remaining} turno${remaining !== 1 ? 's' : ''} disponible${remaining !== 1 ? 's' : ''}` : 'Disponible'}
                      >
                        {time}
                        {allowMultiple && count > 0 && available && (
                          <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {remaining}
                          </span>
                        )}
                        {!available && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Paso 3: Datos personales */}
      {step === 3 && selectedDate && (
        <div>
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 mb-6 text-white">
            {!hasNoServices && selectedService && (
              <p className="font-bold text-lg">{selectedService.name}</p>
            )}
            {hasNoServices && (
              <p className="font-bold text-lg">Tu turno</p>
            )}
            <p className="text-indigo-100 mt-1 capitalize">{formatSelectedDate()}</p>
            <p className="text-indigo-100">Hora: {selectedTime} hs</p>
            {!hasNoServices && showPrices && selectedService && selectedService.price > 0 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/20">
                <span className="text-indigo-100">Total a pagar</span>
                <span className="text-2xl font-bold">${selectedService.price.toLocaleString()}</span>
              </div>
            )}
            <button onClick={() => setStep(2)} className="text-sm text-indigo-200 hover:text-white mt-3 font-medium">
              ← Cambiar horario
            </button>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-4 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <h4 className="font-semibold text-gray-900 mb-2">Tus datos de contacto</h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Juan"
                  className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-indigo-500 focus:ring-0 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apellido *</label>
                <input
                  type="text"
                  required
                  value={clientLastName}
                  onChange={(e) => setClientLastName(e.target.value)}
                  placeholder="Pérez"
                  className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-indigo-500 focus:ring-0 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico *</label>
              <input
                type="email"
                required
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="juan@ejemplo.com"
                className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-indigo-500 focus:ring-0 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono / WhatsApp *</label>
              <input
                type="tel"
                required
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+54 9 11 1234-5678"
                className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-indigo-500 focus:ring-0 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Localidad</label>
              <input
                type="text"
                value={clientLocation}
                onChange={(e) => setClientLocation(e.target.value)}
                placeholder="Ciudad o barrio"
                className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-indigo-500 focus:ring-0 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !clientName || !clientLastName || !clientEmail || !clientPhone}
              className="w-full py-4 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 mt-6"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Reservando...
                </span>
              ) : (
                'Confirmar Reserva'
              )}
            </button>
          </form>
        </div>
      )}

      {/* Paso 4: Confirmación */}
      {step === 4 && (
        <div className="text-center py-8">
          <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">¡Reserva confirmada!</h3>
          <p className="text-gray-500 mb-2">Tu turno ha sido registrado exitosamente</p>
          <p className="text-sm text-gray-400 mb-8">Te contactaremos para confirmar</p>
          
          <div className="bg-gray-50 rounded-2xl p-5 mb-6 text-left max-w-sm mx-auto">
            <h4 className="font-semibold text-gray-900 mb-3">Resumen de tu turno:</h4>
            <div className="space-y-2 text-sm">
              {!hasNoServices && selectedService && (
                <p><span className="text-gray-500">Servicio:</span> <span className="font-medium">{selectedService.name}</span></p>
              )}
              <p><span className="text-gray-500">Fecha:</span> <span className="font-medium capitalize">{formatSelectedDate()}</span></p>
              <p><span className="text-gray-500">Hora:</span> <span className="font-medium">{selectedTime} hs</span></p>
              <p><span className="text-gray-500">Cliente:</span> <span className="font-medium">{clientName} {clientLastName}</span></p>
              {!hasNoServices && showPrices && selectedService && selectedService.price > 0 && (
                <p><span className="text-gray-500">Total:</span> <span className="font-bold text-indigo-600">${selectedService.price.toLocaleString()}</span></p>
              )}
            </div>
          </div>

          <button onClick={reset} className="text-indigo-600 font-medium hover:text-indigo-800 transition-colors">
            Hacer otra reserva
          </button>
        </div>
      )}
    </div>
  )
}
