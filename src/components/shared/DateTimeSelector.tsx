// =============================================================================
// DateTimeSelector - Componente reutilizable para selección de fecha y hora
// Usado en: BookingWidget, AppointmentView, AppointmentDetailModal
// =============================================================================

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

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

interface DayOff {
  date: string
}

interface Props {
  storeId: string
  selectedDate: Date | null
  selectedTime: string
  onDateChange: (date: Date) => void
  onTimeChange: (time: string) => void
  excludeAppointmentId?: string // Para excluir el turno actual cuando se edita
  serviceAvailableDays?: number[] // Días disponibles del servicio
  allowMultiple?: boolean
  maxPerSlot?: number
  minDate?: Date // Fecha mínima permitida
}

const DAYS_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function DateTimeSelector({
  storeId,
  selectedDate,
  selectedTime,
  onDateChange,
  onTimeChange,
  excludeAppointmentId,
  serviceAvailableDays = [0, 1, 2, 3, 4, 5, 6],
  allowMultiple = false,
  maxPerSlot = 1,
  minDate
}: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [daysOff, setDaysOff] = useState<DayOff[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [showFullCalendar, setShowFullCalendar] = useState(false)
  const [quickDateOffset, setQuickDateOffset] = useState(0)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [slotAvailability, setSlotAvailability] = useState<{ time: string; count: number; available: boolean }[]>([])

  const today = minDate || new Date()
  today.setHours(0, 0, 0, 0)

  useEffect(() => {
    if (storeId) {
      console.log('[DateTimeSelector] Loading data for storeId:', storeId)
      loadData()
    }
  }, [storeId])

  useEffect(() => {
    if (selectedDate && schedules.length > 0) {
      calculateSlots(selectedDate)
    }
  }, [selectedDate, schedules, appointments])

  async function loadData() {
    setLoading(true)
    try {
      const todayStr = new Date().toISOString().split('T')[0]
      
      const [schedulesRes, daysOffRes, appointmentsRes] = await Promise.all([
        supabase.from('schedules').select('*').eq('store_id', storeId),
        supabase.from('days_off').select('*').eq('store_id', storeId),
        supabase
          .from('appointments')
          .select('id, date, time, status')
          .eq('store_id', storeId)
          .in('status', ['pending', 'confirmed'])
          .gte('date', todayStr)
      ])

      console.log('[DateTimeSelector] Loaded schedules:', schedulesRes.data)
      console.log('[DateTimeSelector] storeId:', storeId)
      
      setSchedules(schedulesRes.data || [])
      setDaysOff(daysOffRes.data || [])
      
      // Excluir el turno que se está editando
      const filteredAppointments = (appointmentsRes.data || []).filter(
        apt => apt.id !== excludeAppointmentId
      )
      setAppointments(filteredAppointments)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  function calculateSlots(date: Date) {
    const dayOfWeek = date.getDay()
    const jsDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const dateStr = date.toISOString().split('T')[0]
    
    console.log('[DateTimeSelector] calculateSlots:', { 
      date: dateStr, 
      dayOfWeek, 
      jsDay, 
      schedulesCount: schedules.length,
      schedules: schedules.map(s => ({ day: s.day, enabled: s.enabled }))
    })
    
    const schedule = schedules.find(s => s.day === jsDay && s.enabled)
    if (!schedule) {
      console.log('[DateTimeSelector] No schedule found for day', jsDay)
      setSlotAvailability([])
      return
    }
    
    console.log('[DateTimeSelector] Found schedule:', schedule)

    const slots: { time: string; count: number; available: boolean }[] = []
    const slotDuration = schedule.slot_duration || 30
    const dateAppointments = appointments.filter(apt => apt.date === dateStr)

    const generateSlots = (startStr: string, endStr: string) => {
      const start = new Date(`${dateStr}T${startStr}`)
      const end = new Date(`${dateStr}T${endStr}`)
      let current = new Date(start)

      while (current < end) {
        const timeStr = current.toTimeString().slice(0, 5)
        const count = dateAppointments.filter(apt => apt.time === timeStr).length
        const maxSlots = allowMultiple ? maxPerSlot : 1
        
        slots.push({
          time: timeStr,
          count,
          available: count < maxSlots
        })

        current.setMinutes(current.getMinutes() + slotDuration)
      }
    }

    if (schedule.is_continuous) {
      generateSlots(schedule.start_time, schedule.end_time)
    } else {
      if (schedule.morning_start && schedule.morning_end) {
        generateSlots(schedule.morning_start, schedule.morning_end)
      }
      if (schedule.afternoon_start && schedule.afternoon_end) {
        generateSlots(schedule.afternoon_start, schedule.afternoon_end)
      }
    }

    setSlotAvailability(slots)
  }

  function isDayOff(date: Date): boolean {
    const dateStr = date.toISOString().split('T')[0]
    return daysOff.some(d => d.date === dateStr)
  }

  function isDateAvailable(date: Date): boolean {
    const dayOfWeek = date.getDay()
    const jsDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    
    if (!serviceAvailableDays.includes(jsDay)) return false
    if (isDayOff(date)) return false
    
    const schedule = schedules.find(s => s.day === jsDay && s.enabled)
    return !!schedule
  }

  function generateUpcomingDays(count: number, offset: number): Date[] {
    const days: Date[] = []
    let currentDate = new Date()
    currentDate.setDate(currentDate.getDate() + offset)
    
    while (days.length < count) {
      const date = new Date(currentDate)
      days.push(date)
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return days
  }

  function generateCalendarDays(): (Date | null)[] {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: (Date | null)[] = []
    
    let startDay = firstDay.getDay()
    startDay = startDay === 0 ? 6 : startDay - 1
    
    for (let i = 0; i < startDay; i++) {
      days.push(null)
    }
    
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d))
    }
    
    return days
  }

  function isToday(date: Date): boolean {
    const todayDate = new Date()
    todayDate.setHours(0, 0, 0, 0)
    const compareDate = new Date(date)
    compareDate.setHours(0, 0, 0, 0)
    return compareDate.getTime() === todayDate.getTime()
  }

  function isTomorrow(date: Date): boolean {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    const compareDate = new Date(date)
    compareDate.setHours(0, 0, 0, 0)
    return compareDate.getTime() === tomorrow.getTime()
  }

  function isPastDate(date: Date): boolean {
    const compareDate = new Date(date)
    compareDate.setHours(0, 0, 0, 0)
    return compareDate < today
  }

  function getShortDayName(date: Date): string {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    return days[date.getDay()]
  }

  function formatSelectedDate(): string {
    if (!selectedDate) return ''
    return selectedDate.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Vista simplificada de fechas */}
      {!showFullCalendar && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Elegí fecha</p>
          
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Flecha izquierda */}
            <button
              onClick={() => setQuickDateOffset(Math.max(0, quickDateOffset - 5))}
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
              {generateUpcomingDays(5, quickDateOffset).map((date, i) => {
                const isSelected = selectedDate?.toDateString() === date.toDateString()
                const todayDate = isToday(date)
                const tomorrowDate = isTomorrow(date)
                const isPast = isPastDate(date)
                const isAvailable = !isPast && isDateAvailable(date)
                
                return (
                  <button
                    key={i}
                    onClick={() => isAvailable && onDateChange(date)}
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
              onClick={() => setQuickDateOffset(quickDateOffset + 5)}
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
            className="mt-4 w-full py-2.5 text-sm font-medium text-gray-500 hover:text-brand-600 hover:bg-brand-50/50 rounded-xl transition-all flex items-center justify-center gap-2 border border-gray-200 hover:border-brand-200"
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
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
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
                  onClick={() => isAvailable && onDateChange(date)}
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

      {/* Horarios */}
      {selectedDate && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            Horarios para el {formatSelectedDate()}
          </p>
          
          {slotAvailability.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-2xl">
              <p className="text-gray-500">No hay horarios disponibles este día</p>
              <p className="text-sm text-gray-400 mt-1">Probá con otra fecha</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {slotAvailability.map(({ time, count, available }) => {
                const remaining = maxPerSlot - count
                const isSelected = selectedTime === time
                
                return (
                  <button
                    key={time}
                    onClick={() => available && onTimeChange(time)}
                    disabled={!available}
                    className={`py-2.5 px-2 rounded-xl text-sm font-semibold transition-all ${
                      isSelected
                        ? 'bg-brand-600 text-white shadow-lg shadow-brand-200'
                        : available
                          ? 'bg-gray-50 hover:bg-brand-50 text-gray-700 hover:text-brand-700 border border-gray-100 hover:border-brand-200'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed line-through'
                    }`}
                  >
                    {time}
                    {allowMultiple && available && remaining < maxPerSlot && (
                      <span className={`block text-[10px] font-normal mt-0.5 ${
                        isSelected ? 'text-brand-100' : 'text-gray-400'
                      }`}>
                        {remaining} disp.
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
  )
}
