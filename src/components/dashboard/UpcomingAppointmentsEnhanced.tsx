import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import AppointmentDetailModal from './AppointmentDetailModal'

interface Appointment {
  id: string
  date: string
  time: string
  client_name: string
  service_name: string
  status: string
  client_email?: string
  client_phone?: string
  notes?: string
  duration?: number
}

interface Props {
  storeId: string
  onNewAppointment?: () => void
}

export default function UpcomingAppointmentsEnhanced({ storeId, onNewAppointment }: Props) {
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([])
  const [weekAppointments, setWeekAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [workHours, setWorkHours] = useState<number[]>([])
  const [store, setStore] = useState<any>(null)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(today)
    monday.setDate(diff)
    monday.setHours(0, 0, 0, 0)
    return monday
  })

  useEffect(() => {
    loadData()
  }, [storeId, currentWeekStart])

  async function loadData() {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString().split('T')[0]

      // Cargar store
      const { data: storeData } = await supabase
        .from('stores')
        .select('id, name, allow_multiple_appointments, max_appointments_per_slot')
        .eq('id', storeId)
        .single()
      
      if (storeData) {
        setStore(storeData)
      }

      // Cargar horarios de trabajo
      const { data: schedulesData } = await supabase
        .from('schedules')
        .select('start_time, end_time, morning_start, morning_end, afternoon_start, afternoon_end, is_continuous, day')
        .eq('store_id', storeId)
        .eq('enabled', true)

      // Calcular horas de trabajo
      const hoursSet = new Set<number>()
      if (schedulesData && schedulesData.length > 0) {
        const weekDaySchedules = schedulesData.filter(s => s.day !== null && s.day >= 0 && s.day <= 2)
        const schedulesToUse = weekDaySchedules.length > 0 ? weekDaySchedules : schedulesData
        
        schedulesToUse.forEach(schedule => {
          if (schedule.is_continuous !== false) {
            const start = parseInt(schedule.start_time?.substring(0, 2) || '8')
            const end = parseInt(schedule.end_time?.substring(0, 2) || '18')
            for (let h = start; h < end; h++) {
              hoursSet.add(h)
            }
          } else {
            const morningStart = parseInt(schedule.morning_start?.substring(0, 2) || '8')
            const morningEnd = parseInt(schedule.morning_end?.substring(0, 2) || '13')
            const afternoonStart = parseInt(schedule.afternoon_start?.substring(0, 2) || '16')
            const afternoonEnd = parseInt(schedule.afternoon_end?.substring(0, 2) || '20')
            
            for (let h = morningStart; h < morningEnd; h++) hoursSet.add(h)
            for (let h = afternoonStart; h < afternoonEnd; h++) hoursSet.add(h)
          }
        })
      }
      
      const defaultHours = [8, 9, 10, 11, 12, 13, 14]
      const hours = hoursSet.size > 0 ? Array.from(hoursSet).sort((a, b) => a - b) : defaultHours
      setWorkHours(hours)

      const weekStart = new Date(currentWeekStart)
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 2)
      weekEnd.setHours(23, 59, 59, 999)
      
      const weekStartStr = weekStart.toISOString().split('T')[0]
      const weekEndStr = weekEnd.toISOString().split('T')[0]

      const { data: weekData } = await supabase
        .from('appointments')
        .select('id, date, time, client_name, service_name, status, duration')
        .eq('store_id', storeId)
        .gte('date', weekStartStr)
        .lte('date', weekEndStr)
        .in('status', ['pending', 'confirmed'])
        .order('date', { ascending: true })
        .order('time', { ascending: true })

      const { data: upcomingData } = await supabase
        .from('appointments')
        .select('id, date, time, client_name, service_name, status, client_email, client_phone, notes, duration')
        .eq('store_id', storeId)
        .gte('date', todayStr)
        .in('status', ['pending', 'confirmed'])
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .limit(10)

      setWeekAppointments(weekData || [])
      setUpcomingAppointments(upcomingData || [])
    } catch (error) {
      console.error('Error cargando turnos:', error)
    } finally {
      setLoading(false)
    }
  }

  function getAppointmentsForDay(dayIndex: number): Appointment[] {
    const targetDate = new Date(currentWeekStart)
    targetDate.setDate(targetDate.getDate() + dayIndex)
    const dateStr = targetDate.toISOString().split('T')[0]
    
    return weekAppointments
      .filter(apt => apt.date === dateStr)
      .sort((a, b) => a.time.localeCompare(b.time))
  }

  function goToPreviousWeek() {
    const newDate = new Date(currentWeekStart)
    newDate.setDate(newDate.getDate() - 7)
    setCurrentWeekStart(newDate)
  }

  function goToNextWeek() {
    const newDate = new Date(currentWeekStart)
    newDate.setDate(newDate.getDate() + 7)
    setCurrentWeekStart(newDate)
  }

  function goToCurrentWeek() {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(today)
    monday.setDate(diff)
    monday.setHours(0, 0, 0, 0)
    setCurrentWeekStart(monday)
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr + 'T12:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date.toDateString() === today.toDateString()) return 'Hoy'
    if (date.toDateString() === tomorrow.toDateString()) return 'Mañana'
    return date.toLocaleDateString('es', { day: 'numeric', month: 'short' })
  }

  // Colores exactos como en la imagen
  function getBlockColor(status: string): string {
    const colors = {
      pending: 'bg-amber-100 text-amber-900', // Amarillo claro
      confirmed: 'bg-pink-100 text-pink-900', // Rosa
      cancelled: 'bg-red-100 text-red-900'
    }
    return colors[status as keyof typeof colors] || 'bg-white text-gray-900 border border-gray-200'
  }

  function getStatusLabel(status: string): string {
    const labels = {
      pending: 'Pendiente',
      confirmed: 'Confirmado',
      cancelled: 'Cancelado'
    }
    return labels[status as keyof typeof labels] || status
  }

  const dayNames = ['Lun', 'Mar', 'Mié']
  const weekDays = dayNames.map((name, index) => {
    const date = new Date(currentWeekStart)
    date.setDate(date.getDate() + index)
    return {
      name,
      date: date,
      dateStr: date.toISOString().split('T')[0]
    }
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Hora actual para la línea
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const currentTimePosition = currentHour + currentMinute / 60

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-surface-500 font-medium">Cargando turnos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Calendario Semanal - Diseño exacto como la imagen */}
      <div className="bg-white rounded-3xl p-6 border border-surface-200/60 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-surface-900 flex items-center gap-2">
            <div className="w-8 h-8 bg-surface-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            Vista Semanal
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousWeek}
              className="p-2 hover:bg-surface-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToCurrentWeek}
              className="px-3 py-1.5 text-xs font-bold text-surface-600 hover:bg-surface-100 rounded-lg transition-colors"
            >
              Esta semana
            </button>
            <button
              onClick={goToNextWeek}
              className="p-2 hover:bg-surface-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Grid del calendario - Diseño exacto como la imagen */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Header de horas */}
              <div className="grid border-b-2 border-gray-300" style={{ gridTemplateColumns: `80px repeat(${workHours.length}, minmax(100px, 1fr))` }}>
                <div className="p-3"></div>
                {workHours.map((hour) => {
                  const isCurrentHour = currentTimePosition >= hour && currentTimePosition < hour + 1
                  return (
                    <div key={hour} className="relative p-3 text-center border-r border-gray-200 last:border-r-0">
                      <div className="text-sm font-bold text-gray-700">
                        {hour.toString().padStart(2, '0')}:00
                      </div>
                      {/* Círculo negro en la hora actual */}
                      {isCurrentHour && (
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-black rounded-full z-20" />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Filas de días */}
              {weekDays.map((day, dayIndex) => {
                const isTodayDate = day.date.toDateString() === today.toDateString()
                const dayAppointments = getAppointmentsForDay(dayIndex)
                
                return (
                  <div 
                    key={dayIndex} 
                    className="grid border-b border-gray-300 last:border-b-0 relative"
                    style={{ gridTemplateColumns: `80px repeat(${workHours.length}, minmax(100px, 1fr))` }}
                  >
                    {/* Columna de día */}
                    <div className={`p-4 border-r-2 border-gray-300 text-center ${isTodayDate ? 'bg-green-50' : 'bg-white'}`}>
                      <div className="text-sm font-bold text-gray-700">
                        {day.name}
                      </div>
                    </div>

                    {/* Contenedor para todas las horas del día */}
                    <div className="col-span-full relative" style={{ minHeight: '120px' }}>
                      {/* Grid de columnas para las horas */}
                      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${workHours.length}, 1fr)` }}>
                        {workHours.map((hour) => {
                          const isCurrentHour = currentTimePosition >= hour && currentTimePosition < hour + 1
                          return (
                            <div
                              key={`${dayIndex}-${hour}`}
                              className="relative border-r border-gray-200 last:border-r-0"
                            >
                              {/* Línea vertical de tiempo actual */}
                              {isCurrentHour && (
                                <div className="absolute top-0 bottom-0 left-0 w-0.5 bg-black z-10" />
                              )}
                            </div>
                          )
                        })}
                      </div>
                      
                      {/* Bloques de turnos posicionados absolutamente */}
                      {dayAppointments.map((appointment) => {
                        const aptHour = parseInt(appointment.time.substring(0, 2))
                        const duration = appointment.duration || 60
                        const spansHours = duration / 60
                        const hourIndex = workHours.indexOf(aptHour)
                        
                        if (hourIndex === -1) return null
                        
                        const cellWidthPercent = 100 / workHours.length
                        const leftPercent = hourIndex * cellWidthPercent
                        const widthPercent = spansHours * cellWidthPercent
                        
                        return (
                          <div
                            key={appointment.id}
                            className={`absolute rounded-lg p-2 cursor-pointer hover:shadow-md transition-all border border-gray-300 ${getBlockColor(appointment.status)}`}
                            style={{
                              top: '4px',
                              bottom: '4px',
                              left: `${leftPercent}%`,
                              width: `${widthPercent}%`,
                              marginLeft: '2px',
                              marginRight: '2px',
                              zIndex: 15,
                              minHeight: '80px'
                            }}
                            onClick={async (e) => {
                              e.stopPropagation()
                              const { data } = await supabase
                                .from('appointments')
                                .select('*')
                                .eq('id', appointment.id)
                                .single()
                              if (data) {
                                setSelectedAppointment(data)
                                setIsModalOpen(true)
                              }
                            }}
                          >
                            <div className="text-xs font-bold">
                              {appointment.time.substring(0, 5)}
                            </div>
                            <div className="text-xs font-semibold mt-1 truncate">
                              {appointment.client_name}
                            </div>
                            {appointment.service_name && (
                              <div className="text-[10px] mt-0.5 truncate opacity-80">
                                {appointment.service_name}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              
              {/* Línea vertical de tiempo actual que cruza todo */}
              {currentTimePosition >= workHours[0] && currentTimePosition <= workHours[workHours.length - 1] + 1 && (
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-black z-20 pointer-events-none"
                  style={{ 
                    left: `calc(80px + ${((currentTimePosition - workHours[0]) / (workHours[workHours.length - 1] - workHours[0] + 1)) * 100}%)`,
                    height: '100%'
                  }}
                >
                  <div className="absolute -top-1 -left-1 w-2 h-2 bg-black rounded-full"></div>
                </div>
              )}
            </div>
          </div>
          
          {/* Línea horizontal debajo del calendario */}
          {currentTimePosition >= workHours[0] && currentTimePosition <= workHours[workHours.length - 1] + 1 && (
            <div className="mt-2 flex justify-center relative">
              <div 
                className="h-1 bg-black w-16 absolute"
                style={{ 
                  left: `calc(${((currentTimePosition - workHours[0]) / (workHours[workHours.length - 1] - workHours[0] + 1)) * 100}%)`,
                  transform: 'translateX(-50%)'
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Lista de Próximos Turnos */}
      <div className="bg-white rounded-3xl p-6 border border-surface-200/60 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-surface-900 text-lg flex items-center gap-2">
            Próximos Turnos
            <button className="ml-2 text-surface-400 hover:text-surface-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </h3>
          <div className="flex items-center gap-3">
            {onNewAppointment && (
              <button
                onClick={onNewAppointment}
                className="inline-flex items-center gap-1.5 bg-brand-600 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-600/10 active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nuevo
              </button>
            )}
            <a href="/dashboard/appointments" className="text-surface-400 hover:text-surface-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </a>
          </div>
        </div>

        {upcomingAppointments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-200">
                  <th className="text-left py-4 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      Nombre
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </th>
                  <th className="text-left py-4 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      Servicio
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </th>
                  <th className="text-left py-4 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      Fecha
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </th>
                  <th className="text-left py-4 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      Hora
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </th>
                  <th className="text-right py-4 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {upcomingAppointments.map((apt) => (
                  <tr
                    key={apt.id}
                    className="border-b border-surface-100 hover:bg-surface-50 transition-colors cursor-pointer"
                    onClick={async () => {
                      const { data } = await supabase
                        .from('appointments')
                        .select('*')
                        .eq('id', apt.id)
                        .single()
                      if (data) {
                        setSelectedAppointment(data)
                        setIsModalOpen(true)
                      }
                    }}
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-brand-400 to-brand-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {apt.client_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-surface-900">{apt.client_name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-surface-700">{apt.service_name || 'Sin servicio'}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm font-semibold text-surface-700">{formatDate(apt.date)}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm font-semibold text-surface-700">{apt.time.substring(0, 5)}</span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className={`text-[10px] px-2 py-1 rounded-lg font-bold border uppercase tracking-wider ${getBlockColor(apt.status)}`}>
                          {getStatusLabel(apt.status)}
                        </span>
                        <span className="text-surface-400 hover:text-brand-600 transition-colors font-semibold">
                          Detalles &gt;
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 bg-surface-50 rounded-3xl border border-dashed border-surface-200">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <svg className="w-8 h-8 text-surface-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-surface-500 font-medium mb-4 text-sm px-6">No tenés turnos próximos agendados.</p>
            {onNewAppointment && (
              <button
                onClick={onNewAppointment}
                className="inline-flex items-center gap-2 text-brand-600 font-bold hover:text-brand-700 text-sm px-4 py-2 bg-brand-50 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Crear turno manual
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal de detalles */}
      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          isOpen={isModalOpen}
          store={store}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedAppointment(null)
          }}
          onUpdate={() => {
            loadData()
          }}
          onDelete={async () => {
            await supabase.from('appointments').delete().eq('id', selectedAppointment.id)
            setIsModalOpen(false)
            setSelectedAppointment(null)
            loadData()
          }}
        />
      )}
    </div>
  )
}
