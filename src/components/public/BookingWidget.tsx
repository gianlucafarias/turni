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
  auto_confirm?: boolean
  branches_available?: string[]
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
  // Propiedades de configuración de turnos
  show_prices: boolean
  allow_multiple_appointments: boolean
  max_appointments_per_slot: number
  temporarily_closed?: boolean

  // Datos generales de la tienda (para títulos y ubicación)
  name?: string
  location?: string
  address?: string
  city?: string
  province?: string
}

interface Branch {
  id: string
  name: string
  address: string
  city: string
  province: string
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
  const [branches, setBranches] = useState<Branch[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [daysOff, setDaysOff] = useState<DayOff[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [hasNoServices, setHasNoServices] = useState(false)
  
  const [step, setStep] = useState(1)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null) // null = ubicación principal
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState('')
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [slotAvailability, setSlotAvailability] = useState<{ time: string; count: number; available: boolean }[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [showFullCalendar, setShowFullCalendar] = useState(false)
  const [quickDateOffset, setQuickDateOffset] = useState(0) // Para navegar en la vista rápida
  
  // Estado para límite diario de turnos
  const [dailyLimitInfo, setDailyLimitInfo] = useState<{
    limit: number;
    current: number;
    remaining: number;
    isUnlimited: boolean;
    canBook: boolean;
  } | null>(null)
  
  const [clientName, setClientName] = useState('')
  const [clientLastName, setClientLastName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientLocation, setClientLocation] = useState('')
  
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPremium, setIsPremium] = useState(false)
  const [createdAppointment, setCreatedAppointment] = useState<any>(null)

  useEffect(() => {
    loadData()
    checkPremiumStatus()
  }, [storeId])

  async function checkPremiumStatus() {
    try {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan_id, status')
        .eq('store_id', storeId)
        .single()
      
      const premiumPlans = ['premium', 'premium_annual', 'trial']
      const premium = subscription?.status === 'active' && premiumPlans.includes(subscription?.plan_id)
      setIsPremium(premium || false)
    } catch (error) {
      setIsPremium(false)
    }
  }

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
        const storeRes = await supabase.from('stores').select('show_prices, allow_multiple_appointments, max_appointments_per_slot, temporarily_closed, address, city, province, location').eq('id', storeId).single()
        if (storeRes.error) throw storeRes.error
        storeData = storeRes.data
      } catch (error: any) {
        // Si falla, intentar sin las columnas nuevas
        const { data: fallbackStore } = await supabase.from('stores').select('show_prices, temporarily_closed, address, city, province, location').eq('id', storeId).single()
        storeData = fallbackStore ? { ...fallbackStore, allow_multiple_appointments: false, max_appointments_per_slot: 1, temporarily_closed: fallbackStore.temporarily_closed || false } : null
      }
      
      // Cargar sucursales - intentar siempre, no solo si es premium
      // (el widget es público, así que necesitamos cargar las sucursales activas)
      let branchesData: Branch[] = []
      try {
        console.log('Cargando sucursales para storeId:', storeId)
        const { data: branchesRes, error: branchesError } = await supabase
          .from('branches')
          .select('id, name, address, city, province')
          .eq('store_id', storeId)
          .eq('is_active', true)
          .order('display_order', { ascending: true })
        
        if (branchesError) {
          console.error('Error cargando sucursales en widget:', branchesError)
        } else {
          console.log('Sucursales cargadas en widget:', branchesRes?.length || 0, branchesRes)
          branchesData = branchesRes || []
        }
      } catch (error) {
        console.error('Error al cargar sucursales en widget:', error)
      }
      setBranches(branchesData)
      console.log('Branches state actualizado:', branchesData.length, 'sucursales')

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
    setSelectedBranch(null) // Reset sucursal al cambiar servicio
    setStep(2) // Ir directo a seleccionar fecha
  }

  function selectBranch(branchId: string | null) {
    setSelectedBranch(branchId)
    // No cambiar de paso, solo actualizar la sucursal seleccionada
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
    setDailyLimitInfo(null)
    
    try {
      // Verificar límite diario de turnos
      const limitResponse = await fetch(`/api/subscriptions/check-daily-limit?store_id=${storeId}&date=${dateStr}`)
      if (limitResponse.ok) {
        const limitData = await limitResponse.json()
        setDailyLimitInfo({
          limit: limitData.daily_limit,
          current: limitData.current_count,
          remaining: limitData.slots_remaining,
          isUnlimited: limitData.is_unlimited,
          canBook: limitData.can_book
        })
        
        // Si se alcanzó el límite, mostrar mensaje y no cargar slots
        if (!limitData.can_book) {
          setAvailableSlots([])
          setError(`Lo sentimos, se alcanzó el límite de ${limitData.daily_limit} turnos para este día. Por favor, elegí otra fecha.`)
          return
        }
      }
      
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

    const slotDuration = schedule.slot_duration

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
            currentMinutes += slotDuration
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
        
        currentMinutes += slotDuration
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
    setStep(3) // Paso 3: Datos personales
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!selectedDate || !selectedTime) return
    
    // Verificar si está cerrado temporalmente
    if (store?.temporarily_closed) {
      setError('El negocio está cerrado temporalmente. No se pueden realizar nuevas reservas.')
      return
    }
    
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
      // Verificar si el servicio tiene auto_confirm y si el store es premium
      let shouldAutoConfirm = false
      if (selectedService && selectedService.id !== 'general' && selectedService.auto_confirm) {
        // Verificar suscripción del store
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('plan_id, status')
          .eq('store_id', storeId)
          .single()
        
        const premiumPlans = ['premium', 'premium_annual', 'trial']
        const isPremium = subscription?.status === 'active' && premiumPlans.includes(subscription?.plan_id)
        shouldAutoConfirm = isPremium
      }

      const appointmentData: any = {
        store_id: storeId,
        date: dateStr,
        time: selectedTime,
        duration: selectedService?.duration || 30,
        client_name: `${clientName} ${clientLastName}`.trim(),
        client_email: clientEmail,
        client_phone: `+549${clientPhone}`,
        client_location: clientLocation,
        status: shouldAutoConfirm ? 'confirmed' : 'pending'
      }

      // Agregar branch_id si se seleccionó una sucursal
      if (selectedBranch) {
        appointmentData.branch_id = selectedBranch
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

      const { data: insertedAppointment, error: insertError } = await supabase
        .from('appointments')
        .insert(appointmentData)
        .select()
        .single()
      
      if (insertError) throw insertError
      
      // Sincronizar con Google Calendar si está conectado
      if (insertedAppointment) {
        try {
          const response = await fetch('/api/google-calendar/create-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              appointmentId: insertedAppointment.id,
              storeId: insertedAppointment.store_id,
            }),
          })
          if (!response.ok) {
            console.error('Error sincronizando con Google Calendar')
          }
        } catch (error) {
          console.error('Error sincronizando con Google Calendar:', error)
          // No fallar la creación del turno si falla la sincronización
        }
      }
      
      // Si se auto-confirmó, enviar notificación
      if (shouldAutoConfirm && insertedAppointment) {
        try {
          const response = await fetch('/api/notifications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'appointment_confirmed',
              appointment_id: insertedAppointment.id,
              store_id: storeId,
            }),
          })
          if (!response.ok) {
            console.error('Error enviando notificación:', await response.text())
          }
        } catch (error) {
          console.error('Error enviando notificación:', error)
        }
      }
      
      // Guardar el turno creado para mostrar el link de Google Calendar
      setCreatedAppointment(insertedAppointment)
      
      // Recargar appointments después de crear
      await loadData()
      
      setStep(5) // Paso 5: Confirmación final
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

  function generateGoogleCalendarLink(appointment: any): string {
    if (!appointment || !selectedDate || !selectedTime) return ''
    
    const startDate = new Date(`${appointment.date}T${selectedTime}`)
    const endDate = new Date(startDate.getTime() + (appointment.duration * 60 * 1000))
    
    // Formatear fechas para Google Calendar (formato: YYYYMMDDTHHmmss)
    const formatDate = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const seconds = String(date.getSeconds()).padStart(2, '0')
      return `${year}${month}${day}T${hours}${minutes}${seconds}`
    }
    
    const start = formatDate(startDate)
    const end = formatDate(endDate)
    
    const title = encodeURIComponent(`${appointment.service_name || 'Turno'} - ${store?.name || ''}`)
    const details = encodeURIComponent(
      `Turno reservado en ${store?.name || ''}\n\n` +
      `Cliente: ${appointment.client_name}\n` +
      (appointment.notes ? `Notas: ${appointment.notes}\n` : '') +
      (store?.location ? `Ubicación: ${store.location}` : '')
    )
    const location = encodeURIComponent(store?.location || '')
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`
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
      setSelectedBranch(null)
      setSelectedDate(null)
      setSelectedTime('')
    }
    setSlotAvailability([])
    setShowFullCalendar(false)
    setQuickDateOffset(0)
    setClientName('')
    setClientLastName('')
    setClientEmail('')
    setClientPhone('')
    setClientLocation('')
    setCreatedAppointment(null)
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

  // Genera los próximos días (disponibles o no) para la vista simplificada
  function generateUpcomingDaysWithOffset(count: number = 5, offset: number = 0): Date[] {
    const days: Date[] = []
    const startDate = new Date()
    startDate.setHours(0, 0, 0, 0)
    startDate.setDate(startDate.getDate() + offset)
    
    for (let i = 0; i < count; i++) {
      const checkDate = new Date(startDate)
      checkDate.setDate(startDate.getDate() + i)
      days.push(checkDate)
    }
    
    return days
  }

  // Formatea el día de la semana corto
  function getShortDayName(date: Date): string {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    return days[date.getDay()]
  }

  // Verifica si una fecha es hoy
  function isToday(date: Date): boolean {
    const todayDate = new Date()
    todayDate.setHours(0, 0, 0, 0)
    const compareDate = new Date(date)
    compareDate.setHours(0, 0, 0, 0)
    return compareDate.getTime() === todayDate.getTime()
  }

  // Verifica si una fecha es mañana
  function isTomorrow(date: Date): boolean {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    const compareDate = new Date(date)
    compareDate.setHours(0, 0, 0, 0)
    return compareDate.getTime() === tomorrow.getTime()
  }

  // Verifica si una fecha es pasada
  function isPastDate(date: Date): boolean {
    const todayDate = new Date()
    todayDate.setHours(0, 0, 0, 0)
    const compareDate = new Date(date)
    compareDate.setHours(0, 0, 0, 0)
    return compareDate < todayDate
  }

  // Navegar a días anteriores en la vista rápida
  function goToPreviousDays() {
    if (quickDateOffset > 0) {
      setQuickDateOffset(Math.max(0, quickDateOffset - 5))
    }
  }

  // Navegar a días siguientes en la vista rápida
  function goToNextDays() {
    setQuickDateOffset(quickDateOffset + 5)
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
        <div className="w-10 h-10 border-3 border-gray-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    )
  }

  // Verificar si está cerrado temporalmente
  if (store?.temporarily_closed) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Cerrado temporalmente</h3>
        <p className="text-gray-600 mb-4">
          Este negocio está cerrado temporalmente y no está recibiendo nuevas reservas en este momento.
        </p>
        <p className="text-sm text-gray-500">
          Por favor, intentá nuevamente más tarde.
        </p>
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
  // Con servicios: 1=Servicio, 2=Fecha/Hora, 3=Datos, 4=Resumen, 5=Confirmación
  // Sin servicios: 2=Fecha/Hora, 3=Datos, 4=Resumen, 5=Confirmación (3 pasos visibles)
  const totalSteps = hasNoServices ? 3 : 4
  const currentStepAdjusted = hasNoServices 
    ? (step === 2 ? 1 : step === 3 ? 2 : step === 4 ? 3 : step === 5 ? 4 : step) 
    : (step === 1 ? 1 : step === 2 ? 2 : step === 3 ? 3 : step === 4 ? 4 : step === 5 ? 4 : step)

  return (
    <div>
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {Array.from({ length: totalSteps }).map((_, i) => {
          const stepNum = i + 1
          return (
            <div key={i} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                currentStepAdjusted >= stepNum ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {currentStepAdjusted > stepNum ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : stepNum}
              </div>
              {i < totalSteps - 1 && <div className={`w-12 h-1 mx-1 rounded transition-all ${currentStepAdjusted > stepNum ? 'bg-brand-600' : 'bg-gray-100'}`} />}
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
                className="w-full text-left p-5 bg-white border-2 border-gray-100 hover:border-brand-200 hover:bg-brand-50/30 rounded-2xl transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900 group-hover:text-brand-700">{service.name}</h4>
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
                        <span className="inline-flex items-center text-xs text-brand-600 bg-brand-50 px-2 py-1 rounded-full">
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
                      <span className="text-2xl font-bold text-brand-600">${service.price.toLocaleString()}</span>
                    )}
                    <div className="mt-1 text-brand-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
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
            <div className="bg-brand-50 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-brand-900">{selectedService.name}</p>
                  <p className="text-sm text-brand-600">{selectedService.duration} minutos</p>
                  {/* Mostrar sucursal seleccionada si hay */}
                  {selectedBranch && branches.length > 0 && (
                    <p className="text-xs text-brand-500 mt-1">
                      📍 {branches.find(b => b.id === selectedBranch)?.name || 'Sucursal seleccionada'}
                    </p>
                  )}
                  {!selectedBranch && branches.length > 0 && (
                    <p className="text-xs text-brand-500 mt-1">
                      📍 Ubicación Principal
                    </p>
                  )}
                </div>
                <button onClick={() => setStep(1)} className="text-sm text-brand-600 hover:text-brand-800 font-medium">
                  Cambiar servicio
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

          {/* Vista simplificada de fechas */}
          {!showFullCalendar && (
            <div className="mb-6">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Elegí fecha</p>
              
              {/* Contenedor con flechas de navegación */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Flecha izquierda */}
                <button
                  onClick={goToPreviousDays}
                  disabled={quickDateOffset === 0}
                  className={`flex-shrink-0 w-9 h-14 sm:w-10 sm:h-16 rounded-xl flex items-center justify-center transition-all ${
                    quickDateOffset === 0
                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      : 'bg-gray-100 hover:bg-brand-100 text-gray-500 hover:text-brand-600 active:scale-95'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                {/* Días */}
                <div className="flex-1 grid grid-cols-5 gap-1.5 sm:gap-2">
                  {generateUpcomingDaysWithOffset(5, quickDateOffset).map((date, i) => {
                    const isSelected = selectedDate?.toDateString() === date.toDateString()
                    const todayDate = isToday(date)
                    const tomorrowDate = isTomorrow(date)
                    const isPast = isPastDate(date)
                    const isAvailable = !isPast && isDateAvailable(date)
                    
                    return (
                      <button
                        key={i}
                        onClick={() => isAvailable && selectDate(date)}
                        disabled={!isAvailable}
                        className={`py-2.5 sm:py-3 px-1 rounded-xl text-center transition-all ${
                          isSelected
                            ? 'bg-brand-600 text-white shadow-lg shadow-brand-200 scale-[1.02]'
                            : isAvailable
                              ? 'bg-gray-50 hover:bg-brand-50 text-gray-700 hover:text-brand-700 border border-gray-100 hover:border-brand-200 active:scale-95'
                              : 'bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-100'
                        }`}
                      >
                        <p className={`text-[11px] sm:text-xs uppercase font-semibold leading-tight ${
                          isSelected ? 'text-brand-100' : isAvailable ? 'text-gray-400' : 'text-gray-300'
                        }`}>
                          {todayDate ? 'Hoy' : tomorrowDate ? 'Mañ' : getShortDayName(date)}
                        </p>
                        <p className={`text-xl sm:text-2xl font-bold leading-tight mt-0.5 ${
                          isSelected ? 'text-white' : isAvailable ? 'text-gray-900' : 'text-gray-300'
                        }`}>
                          {date.getDate()}
                        </p>
                      </button>
                    )
                  })}
                </div>

                {/* Flecha derecha */}
                <button
                  onClick={goToNextDays}
                  className="flex-shrink-0 w-9 h-14 sm:w-10 sm:h-16 rounded-xl bg-gray-100 hover:bg-brand-100 text-gray-500 hover:text-brand-600 flex items-center justify-center transition-all active:scale-95"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              
              {/* Botón para ver calendario completo */}
              <button
                onClick={() => setShowFullCalendar(true)}
                className="mt-4 w-full py-3 text-sm font-medium text-gray-500 hover:text-brand-600 hover:bg-brand-50/50 rounded-xl transition-all flex items-center justify-center gap-2 border border-gray-200 hover:border-brand-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Ver calendario completo
              </button>
            </div>
          )}

          {/* Calendario completo */}
          {showFullCalendar && (
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
                  const isTodayDate = date.toDateString() === today.toDateString()

                  return (
                    <button
                      key={i}
                      onClick={() => isAvailable && selectDate(date)}
                      disabled={!isAvailable}
                      className={`aspect-square rounded-xl flex items-center justify-center text-sm font-medium transition-all relative ${
                        isSelected
                          ? 'bg-brand-600 text-white shadow-lg shadow-brand-200'
                          : isAvailable
                            ? 'hover:bg-brand-50 text-gray-700 hover:text-brand-700'
                            : isHoliday && !isPast
                              ? 'text-red-300 cursor-not-allowed'
                              : 'text-gray-300 cursor-not-allowed'
                      } ${isTodayDate && !isSelected ? 'ring-2 ring-brand-200' : ''}`}
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

              {/* Botón para volver a vista simplificada */}
              <button
                onClick={() => setShowFullCalendar(false)}
                className="mt-4 w-full py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Volver a vista rápida
              </button>
            </div>
          )}

          {selectedDate && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Horarios para el {formatSelectedDate()}
              </h4>
              
              {/* Indicador de límite diario */}
              {dailyLimitInfo && !dailyLimitInfo.isUnlimited && (
                <div className={`mb-3 px-3 py-2 rounded-lg text-sm ${
                  dailyLimitInfo.remaining <= 1 
                    ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                  <span className="font-medium">
                    {dailyLimitInfo.remaining === 0 
                      ? '⚠️ No hay turnos disponibles para este día'
                      : dailyLimitInfo.remaining === 1
                        ? '⚡ ¡Último turno disponible!'
                        : `📅 ${dailyLimitInfo.remaining} turnos disponibles`
                    }
                  </span>
                  {dailyLimitInfo.remaining > 0 && dailyLimitInfo.remaining <= 3 && (
                    <span className="text-xs ml-1 opacity-75">
                      ({dailyLimitInfo.current}/{dailyLimitInfo.limit} reservados)
                    </span>
                  )}
                </div>
              )}
              
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
                            ? 'bg-white border-2 border-gray-100 hover:border-brand-500 hover:bg-brand-50 text-gray-900 cursor-pointer'
                            : 'bg-gray-100 border-2 border-gray-200 text-gray-400 cursor-not-allowed opacity-60 pointer-events-none'
                        }`}
                        style={!available ? { pointerEvents: 'none' } : {}}
                        title={!available ? `Horario completo (${count} turno${count !== 1 ? 's' : ''} reservado${count !== 1 ? 's' : ''})` : allowMultiple && count > 0 ? `${remaining} turno${remaining !== 1 ? 's' : ''} disponible${remaining !== 1 ? 's' : ''}` : 'Disponible'}
                      >
                        {time}
                        {allowMultiple && count > 0 && available && (
                          <span className="absolute -top-1 -right-1 bg-brand-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
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
          <div className="bg-brand-600 rounded-2xl p-5 mb-6 text-white">
            {!hasNoServices && selectedService && (
              <p className="font-bold text-lg">{selectedService.name}</p>
            )}
            {hasNoServices && (
              <p className="font-bold text-lg">Tu turno</p>
            )}
            <p className="text-brand-100 mt-1 capitalize">{formatSelectedDate()}</p>
            <p className="text-brand-100">Hora: {selectedTime} hs</p>
            {/* Mostrar sucursal seleccionada */}
            {(() => {
              console.log('Paso 3 - Renderizando sucursal:', { branchesCount: branches.length, selectedBranch, isPremium })
              return branches.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/20">
                  <p className="text-brand-100 text-sm">📍 Sucursal:</p>
                  <p className="font-semibold">
                    {selectedBranch 
                      ? branches.find(b => b.id === selectedBranch)?.name || 'Sucursal seleccionada'
                      : 'Ubicación Principal'
                    }
                  </p>
                </div>
              )
            })()}
            {!hasNoServices && showPrices && selectedService && selectedService.price > 0 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/20">
                <span className="text-brand-100">Total a pagar</span>
                <span className="text-2xl font-bold">${selectedService.price.toLocaleString()}</span>
              </div>
            )}
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
                  className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-brand-500 focus:ring-0 transition-colors"
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
                  className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-brand-500 focus:ring-0 transition-colors"
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
                className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-brand-500 focus:ring-0 transition-colors"
              />
            </div>

            <div className="flex">
                  <span className="inline-flex items-center px-4 rounded-l-xl border border-r-0 border-gray-200 bg-gray-50 text-gray-500 text-sm">
                    +54
                  </span>
                  <input
                type="tel"
                required
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="1112345678"
                className="w-full px-4 py-3 border-2 border-gray-100 rounded-r-xl focus:border-brand-500 focus:ring-0 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Localidad</label>
              <input
                type="text"
                value={clientLocation}
                onChange={(e) => setClientLocation(e.target.value)}
                placeholder="Ciudad o barrio"
                className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-brand-500 focus:ring-0 transition-colors"
              />
            </div>

            {/* Selección de sucursal (si hay sucursales disponibles) */}
            {(() => {
              console.log('Paso 3 - Verificando sucursales:', {
                branchesCount: branches.length,
                branches: branches,
                isPremium: isPremium,
                storeId: storeId,
                selectedService: selectedService?.name
              })
              return branches.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ¿En qué sucursal querés ser atendido?
                  </label>
                <div className="space-y-2">
                  {/* Opción: Ubicación principal */}
                  <button
                    type="button"
                    onClick={() => selectBranch(null)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      selectedBranch === null
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 bg-white hover:border-brand-200'
                    }`}
                  >
                    <div className="flex-1">
                      <span className="font-medium text-gray-900">Ubicación Principal</span>
                      {(store?.address || store?.location) && (
                        <p className="text-xs text-gray-500 mt-0.5">{store.address || store.location}</p>
                      )}
                      {(store?.city || store?.province) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {[store.city, store.province].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {!store?.address && !store?.location && !store?.city && !store?.province && (
                        <p className="text-xs text-gray-400 mt-0.5 italic">Dirección principal de la tienda</p>
                      )}
                    </div>
                  </button>
                  
                  {/* Sucursales disponibles */}
                  {(() => {
                    // Si el servicio tiene sucursales específicas, mostrar solo esas
                    // Si no tiene (o está vacío), mostrar todas las sucursales
                    const availableBranches = selectedService && selectedService.branches_available && selectedService.branches_available.length > 0
                      ? branches.filter(b => selectedService.branches_available!.includes(b.id))
                      : branches

                    return availableBranches.map((branch) => (
                      <button
                        key={branch.id}
                        type="button"
                        onClick={() => selectBranch(branch.id)}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                          selectedBranch === branch.id
                            ? 'border-brand-500 bg-brand-50'
                            : 'border-gray-200 bg-white hover:border-brand-200'
                        }`}
                      >
                        <span className="font-medium text-gray-900">{branch.name}</span>
                        {branch.address && (
                          <p className="text-xs text-gray-500 mt-0.5">{branch.address}</p>
                        )}
                        {(branch.city || branch.province) && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {[branch.city, branch.province].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </button>
                    ))
                  })()}
                </div>
              </div>
              )
            })()}

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                disabled={!clientName || !clientLastName || !clientEmail || !clientPhone}
                className="flex-1 py-4 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-brand-200 hover:shadow-xl hover:shadow-brand-300"
              >
                Continuar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Paso 4: Resumen antes de confirmar */}
      {step === 4 && selectedDate && (
        <div>
          <div className="bg-brand-600 rounded-2xl p-6 mb-6 text-white">
            <h3 className="text-xl font-bold mb-4">Resumen de tu reserva</h3>
            
            <div className="space-y-3">
              {!hasNoServices && selectedService && (
                <div className="flex items-center justify-between py-2 border-b border-white/20">
                  <span className="text-brand-100">Servicio</span>
                  <span className="font-semibold">{selectedService.name}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-2 border-b border-white/20">
                <span className="text-brand-100">Fecha</span>
                <span className="font-semibold capitalize">{formatSelectedDate()}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/20">
                <span className="text-brand-100">Hora</span>
                <span className="font-semibold">{selectedTime} hs</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/20">
                <span className="text-brand-100">Duración</span>
                <span className="font-semibold">{selectedService?.duration || 30} minutos</span>
              </div>
              {branches.length > 0 && (
                <div className="flex items-center justify-between py-2 border-b border-white/20">
                  <span className="text-brand-100">📍 Sucursal</span>
                  <span className="font-semibold">
                    {selectedBranch 
                      ? branches.find(b => b.id === selectedBranch)?.name || 'Sucursal'
                      : 'Ubicación Principal'
                    }
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between py-2 border-b border-white/20">
                <span className="text-brand-100">Cliente</span>
                <span className="font-semibold">{clientName} {clientLastName}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/20">
                <span className="text-brand-100">Email</span>
                <span className="font-semibold text-sm">{clientEmail}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/20">
                <span className="text-brand-100">Teléfono</span>
                <span className="font-semibold">{clientPhone}</span>
              </div>
              {clientLocation && (
                <div className="flex items-center justify-between py-2 border-b border-white/20">
                  <span className="text-brand-100">Localidad</span>
                  <span className="font-semibold">{clientLocation}</span>
                </div>
              )}
              {!hasNoServices && showPrices && selectedService && selectedService.price > 0 && (
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/30">
                  <span className="text-lg text-brand-100">Total a pagar</span>
                  <span className="text-2xl font-bold">${selectedService.price.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Mensaje de notificación WhatsApp para usuarios premium */}
          {isPremium && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4 flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-900 mb-1">
                  Te notificaremos por WhatsApp
                </p>
                <p className="text-xs text-emerald-700">
                  Cuando se confirme tu turno, recibirás una notificación por WhatsApp con todos los detalles.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-4 text-sm">{error}</div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-4 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-brand-200 hover:shadow-xl hover:shadow-brand-300"
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
          </div>
        </div>
      )}

      {/* Paso 5: Confirmación */}
      {step === 5 && (
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
                <p><span className="text-gray-500">Total:</span> <span className="font-bold text-brand-600">${selectedService.price.toLocaleString()}</span></p>
              )}
            </div>
          </div>

          {/* Botón para agregar a Google Calendar (solo si es premium y tiene email) */}
          {isPremium && clientEmail && createdAppointment && (
            <div className="mb-6">
              <a
                href={generateGoogleCalendarLink(createdAppointment)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 rounded-xl font-medium text-gray-700 hover:border-brand-300 hover:bg-brand-50 transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/>
                </svg>
                <span>Agregar a Google Calendar</span>
              </a>
              <p className="text-xs text-gray-500 mt-2">
                Agrega este turno a tu calendario personal
              </p>
            </div>
          )}

          <button onClick={reset} className="text-brand-600 font-medium hover:text-brand-800 transition-colors">
            Hacer otra reserva
          </button>
        </div>
      )}
    </div>
  )
}
