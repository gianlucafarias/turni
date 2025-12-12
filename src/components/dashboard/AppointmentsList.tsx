import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSubscriptionLimits } from '../../hooks/useSubscriptionLimits'
import AppointmentDetailModal from './AppointmentDetailModal'
import NewAppointmentModal from './NewAppointmentModal'
import AppointmentsSettings from './AppointmentsSettings'

export default function AppointmentsList() {
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [store, setStore] = useState<any>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled' | 'past'>('all')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'thisWeek' | 'thisMonth' | null>(null)
  const [showDateDropdown, setShowDateDropdown] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isNewAppointmentModalOpen, setIsNewAppointmentModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const { isPremium } = useSubscriptionLimits()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
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

      if (storeData.store_type !== 'appointments') {
        window.location.href = '/dashboard/products'
        return
      }

      setStore(storeData)

      const { data: appointmentsData } = await supabase
        .from('appointments')
        .select('*')
        .eq('store_id', storeData.id)
        .order('date', { ascending: false })
        .order('time', { ascending: false })

      setAppointments(appointmentsData || [])
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(id: string, status: string, shouldNotify: boolean = false) {
    try {
      await supabase.from('appointments').update({ status }).eq('id', id)
      const updatedAppointments = appointments.map(a => a.id === id ? { ...a, status } : a)
      setAppointments(updatedAppointments)
      
      // Si se confirma y debe notificar (y es premium), enviar notificación
      if (status === 'confirmed' && shouldNotify && isPremium) {
        const appointment = updatedAppointments.find(a => a.id === id)
        if (appointment) {
          try {
            // Llamar al endpoint de notificaciones
            const response = await fetch('/api/notifications/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'appointment_confirmed',
                appointment_id: appointment.id,
                store_id: appointment.store_id,
              }),
            })
            if (!response.ok) {
              console.error('Error enviando notificación:', await response.text())
            }
          } catch (error) {
            console.error('Error enviando notificación:', error)
          }
        }
      }
      
      // Actualizar el appointment seleccionado si es el mismo
      if (selectedAppointment?.id === id) {
        setSelectedAppointment(updatedAppointments.find(a => a.id === id))
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  function handleAppointmentClick(appointment: any) {
    setSelectedAppointment(appointment)
    setIsModalOpen(true)
  }

  function handleQuickConfirm(appointment: any, e: React.MouseEvent) {
    e.stopPropagation()
    updateStatus(appointment.id, 'confirmed', false)
  }

  function handleQuickCancel(appointment: any, e: React.MouseEvent) {
    e.stopPropagation()
    if (confirm('¿Cancelar este turno?')) {
      updateStatus(appointment.id, 'cancelled', false)
    }
  }

  async function deleteAppointment(id: string) {
    try {
      await supabase.from('appointments').delete().eq('id', id)
      setAppointments(appointments.filter(a => a.id !== id))
      setIsModalOpen(false)
      setSelectedAppointment(null)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  function handleModalUpdate() {
    loadData()
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      confirmed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
      pending: 'bg-amber-100 text-amber-700'
    }
    const labels = {
      confirmed: 'Confirmada',
      cancelled: 'Cancelada',
      pending: 'Pendiente'
    }
    return { style: styles[status as keyof typeof styles] || styles.pending, label: labels[status as keyof typeof labels] || 'Pendiente' }
  }

  // Función para verificar si una cita es pasada
  const isPastAppointment = (appointment: any) => {
    const appointmentDate = new Date(`${appointment.date}T${appointment.time}`)
    const now = new Date()
    return appointmentDate < now
  }

  // Función para verificar si una cita está en el rango de fecha
  const isInDateRange = (appointment: any, range: 'today' | 'thisWeek' | 'thisMonth') => {
    const appointmentDate = new Date(`${appointment.date}T${appointment.time}`)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    switch (range) {
      case 'today':
        const appointmentDay = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate())
        return appointmentDay.getTime() === today.getTime()
      
      case 'thisWeek':
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - today.getDay()) // Domingo
        startOfWeek.setHours(0, 0, 0, 0)
        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(startOfWeek.getDate() + 6) // Sábado
        endOfWeek.setHours(23, 59, 59, 999) // Fin del día
        const appointmentDayOnly = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate())
        return appointmentDayOnly >= startOfWeek && appointmentDayOnly <= endOfWeek
      
      case 'thisMonth':
        return appointmentDate.getMonth() === now.getMonth() && 
               appointmentDate.getFullYear() === now.getFullYear()
      
      default:
        return true
    }
  }

  // Función para verificar si una cita es de hoy
  const isTodayAppointment = (appointment: any) => {
    const appointmentDate = new Date(`${appointment.date}T${appointment.time}`)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const appointmentDay = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate())
    return appointmentDay.getTime() === today.getTime()
  }

  // Función para verificar si una cita es futura
  const isFutureAppointment = (appointment: any) => {
    const appointmentDate = new Date(`${appointment.date}T${appointment.time}`)
    const now = new Date()
    return appointmentDate > now && !isTodayAppointment(appointment)
  }

  // Filtrar citas combinando estado y fecha
  let filteredAppointments = appointments.filter((appointment) => {
    // Filtro por estado
    let matchesStatus = true
    if (filter === 'past') {
      matchesStatus = isPastAppointment(appointment)
    } else if (filter !== 'all') {
      matchesStatus = appointment.status === filter
    }

    // Filtro por fecha
    let matchesDate = true
    if (dateFilter && dateFilter !== 'all') {
      matchesDate = isInDateRange(appointment, dateFilter)
    }

    return matchesStatus && matchesDate
  })

  // El ordenamiento se hace dentro de cada grupo de mes en groupAppointmentsByMonth

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  // Función para obtener el nombre del mes
  const getMonthName = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('es', { month: 'long', year: 'numeric' })
  }

  // Función para verificar si una cita es mañana
  const isTomorrowAppointment = (appointment: any) => {
    const appointmentDate = new Date(`${appointment.date}T${appointment.time}`)
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)
    const appointmentDay = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate())
    const tomorrowDay = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate())
    return appointmentDay.getTime() === tomorrowDay.getTime()
  }

  // Función para obtener el texto del día (Hoy, Mañana, o el número)
  const getDayText = (appointment: any) => {
    if (isTodayAppointment(appointment)) {
      return 'Hoy'
    }
    if (isTomorrowAppointment(appointment)) {
      return 'Mañana'
    }
    return new Date(appointment.date + 'T12:00:00').getDate().toString()
  }

  // Función para obtener la clave del mes (YYYY-MM) para agrupar
  const getMonthKey = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00')
    return `${date.getFullYear()}-${date.getMonth()}`
  }

  // Agrupar citas por mes
  const groupAppointmentsByMonth = (appointments: any[]) => {
    const groups: Record<string, any[]> = {}
    const now = new Date()
    const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`
    
    appointments.forEach(appointment => {
      const monthKey = getMonthKey(appointment.date)
      if (!groups[monthKey]) {
        groups[monthKey] = []
      }
      groups[monthKey].push(appointment)
    })

    // Convertir a array y ordenar: mes actual primero, luego futuros (ascendente), luego pasados (descendente)
    return Object.entries(groups)
      .sort(([keyA], [keyB]) => {
        // Mes actual siempre primero
        if (keyA === currentMonthKey) return -1
        if (keyB === currentMonthKey) return 1
        
        // Comparar si son meses futuros o pasados
        const isAFuture = keyA > currentMonthKey
        const isBFuture = keyB > currentMonthKey
        const isAPast = keyA < currentMonthKey
        const isBPast = keyB < currentMonthKey
        
        // Ambos futuros: ordenar ascendente (enero antes que febrero)
        if (isAFuture && isBFuture) {
          return keyA.localeCompare(keyB)
        }
        
        // Ambos pasados: ordenar descendente (diciembre antes que noviembre)
        if (isAPast && isBPast) {
          return keyB.localeCompare(keyA)
        }
        
        // Futuro antes que pasado
        if (isAFuture && isBPast) return -1
        if (isAPast && isBFuture) return 1
        
        return 0
      })
      .map(([monthKey, apps]) => {
        // Ordenar citas dentro de cada mes: hoy primero, luego futuras, luego pasadas
        const sortedApps = [...apps].sort((a, b) => {
          const aDate = new Date(`${a.date}T${a.time}`)
          const bDate = new Date(`${b.date}T${b.time}`)
          
          const aIsToday = isTodayAppointment(a)
          const bIsToday = isTodayAppointment(b)
          const aIsPast = isPastAppointment(a)
          const bIsPast = isPastAppointment(b)
          const aIsFuture = isFutureAppointment(a)
          const bIsFuture = isFutureAppointment(b)
          
          // Hoy primero
          if (aIsToday && !bIsToday) return -1
          if (!aIsToday && bIsToday) return 1
          
          // Luego futuras (ordenadas por fecha ascendente)
          if (aIsFuture && bIsFuture) {
            return aDate.getTime() - bDate.getTime()
          }
          if (aIsFuture && !bIsFuture && !bIsToday) return -1
          if (!aIsFuture && !aIsToday && bIsFuture) return 1
          
          // Finalmente pasadas (ordenadas por fecha descendente - más recientes primero)
          if (aIsPast && bIsPast) {
            return bDate.getTime() - aDate.getTime()
          }
          if (aIsPast && !bIsPast) return 1
          if (!aIsPast && bIsPast) return -1
          
          // Si ambas son del mismo tipo, ordenar por fecha
          return aDate.getTime() - bDate.getTime()
        })
        
        return {
          monthKey,
          monthName: getMonthName(apps[0].date),
          appointments: sortedApps
        }
      })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  const pendingCount = appointments.filter(a => a.status === 'pending').length
  const confirmedCount = appointments.filter(a => a.status === 'confirmed').length

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Mis Citas</h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1">
              {pendingCount > 0 && <span className="text-amber-600 font-medium">{pendingCount} pendientes</span>}
              {pendingCount > 0 && confirmedCount > 0 && ' · '}
              {confirmedCount > 0 && <span className="text-green-600">{confirmedCount} confirmadas</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsNewAppointmentModalOpen(true)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 sm:px-5 py-2.5 rounded-xl text-sm sm:text-base font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden xs:inline">Nueva Cita</span>
              <span className="xs:hidden">Nueva</span>
            </button>
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-2.5 bg-white border-2 border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 hover:border-indigo-300 transition-colors flex-shrink-0"
              title="Ajustes de citas"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mb-6">
        {/* Filtros de estado */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          {(['all', 'pending', 'confirmed', 'cancelled', 'past'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                filter === f
                  ? 'bg-gray-900 text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f === 'all' && 'Todas'}
              {f === 'pending' && (
                <>
                  <span className="hidden sm:inline">Pendientes ({pendingCount})</span>
                  <span className="sm:hidden">Pendientes</span>
                </>
              )}
              {f === 'confirmed' && 'Confirmadas'}
              {f === 'cancelled' && 'Canceladas'}
              {f === 'past' && 'Pasadas'}
            </button>
          ))}
        </div>

        {/* Filtro de fecha */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowDateDropdown(!showDateDropdown)}
            className={`px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
              dateFilter && dateFilter !== 'all'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="hidden sm:inline">
              {dateFilter === 'today' && 'Hoy'}
              {dateFilter === 'thisWeek' && 'Esta semana'}
              {dateFilter === 'thisMonth' && 'Este mes'}
              {(!dateFilter || dateFilter === 'all') && 'Filtrar por fecha'}
            </span>
            <span className="sm:hidden">
              {dateFilter === 'today' && 'Hoy'}
              {dateFilter === 'thisWeek' && 'Semana'}
              {dateFilter === 'thisMonth' && 'Mes'}
              {(!dateFilter || dateFilter === 'all') && 'Fecha'}
            </span>
            <svg 
              className={`w-4 h-4 transition-transform ${showDateDropdown ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown */}
          {showDateDropdown && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowDateDropdown(false)}
              />
              <div className="absolute top-full left-0 mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-lg z-20 min-w-[180px] overflow-hidden">
                <button
                  onClick={() => {
                    setDateFilter('all')
                    setShowDateDropdown(false)
                  }}
                  className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors ${
                    (!dateFilter || dateFilter === 'all')
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Todas las fechas
                </button>
                <button
                  onClick={() => {
                    setDateFilter('today')
                    setShowDateDropdown(false)
                  }}
                  className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors border-t border-gray-100 ${
                    dateFilter === 'today'
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Hoy
                </button>
                <button
                  onClick={() => {
                    setDateFilter('thisWeek')
                    setShowDateDropdown(false)
                  }}
                  className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors border-t border-gray-100 ${
                    dateFilter === 'thisWeek'
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Esta semana
                </button>
                <button
                  onClick={() => {
                    setDateFilter('thisMonth')
                    setShowDateDropdown(false)
                  }}
                  className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors border-t border-gray-100 ${
                    dateFilter === 'thisMonth'
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Este mes
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lista */}
      {filteredAppointments.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {filter === 'all' && (!dateFilter || dateFilter === 'all') && 'No hay citas'}
            {filter === 'all' && dateFilter && dateFilter !== 'all' && 'No hay citas en este período'}
            {filter === 'pending' && 'No hay citas pendientes'}
            {filter === 'confirmed' && 'No hay citas confirmadas'}
            {filter === 'cancelled' && 'No hay citas canceladas'}
            {filter === 'past' && 'No hay citas pasadas'}
          </h3>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
            Las citas que recibas de tus clientes aparecerán aquí
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupAppointmentsByMonth(filteredAppointments).map(({ monthKey, monthName, appointments: monthAppointments }) => (
            <div key={monthKey} className="space-y-3">
              {/* Encabezado del mes */}
              <div className="pt-2 pb-1">
                <h2 className="text-base font-semibold text-gray-900 capitalize">
                  {monthName}
                </h2>
              </div>
              
              {monthAppointments.map((appointment) => {
                const { style, label } = getStatusBadge(appointment.status)
                const isPast = isPastAppointment(appointment)

                return (
                  <div
                key={appointment.id}
                className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:border-indigo-200 transition-all group ${
                  isPast ? 'opacity-60' : ''
                }`}
              >
                {/* Fila principal */}
                <div 
                  className="p-4 sm:p-5 cursor-pointer"
                  onClick={() => handleAppointmentClick(appointment)}
                >
                  {/* Mobile: Layout vertical */}
                  <div className="flex flex-col sm:hidden gap-3">
                    {/* Header con fecha y nombre */}
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-14 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl flex flex-col items-center justify-center border-2 border-indigo-100 flex-shrink-0">
                        <p className="text-[10px] text-indigo-600 font-semibold uppercase">
                          {formatDate(appointment.date).split(' ')[0]}
                        </p>
                        <p className={`text-xl font-bold text-gray-900 -mt-0.5 ${
                          isTodayAppointment(appointment) || isTomorrowAppointment(appointment) ? 'text-xs' : ''
                        }`}>
                          {getDayText(appointment)}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base text-gray-900 truncate mb-1">{appointment.client_name}</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${style}`}>
                            {label}
                          </span>
                          {appointment.modified_by_client && (
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                              Modificado
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Info de hora, servicio y precio */}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 pl-1">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-semibold text-gray-900">{appointment.time} hs</span>
                      </div>
                      {appointment.service_name && (
                        <div className="flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <span className="truncate max-w-[150px]">{appointment.service_name}</span>
                        </div>
                      )}
                      {appointment.service_price > 0 && (
                        <div className="flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-semibold text-indigo-600">${appointment.service_price.toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    {/* Acciones rápidas - Mobile */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                      {appointment.status === 'pending' && (
                        <>
                          <button
                            onClick={(e) => handleQuickConfirm(appointment, e)}
                            className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors shadow-sm flex items-center justify-center gap-1.5"
                            title="Confirmar rápidamente"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Confirmar
                          </button>
                          <button
                            onClick={(e) => handleQuickCancel(appointment, e)}
                            className="flex-1 px-3 py-2 border-2 border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center justify-center gap-1.5"
                            title="Cancelar turno"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Cancelar
                          </button>
                        </>
                      )}
                      {appointment.status === 'confirmed' && (
                        <button
                          onClick={(e) => handleQuickCancel(appointment, e)}
                          className="flex-1 px-3 py-2 border-2 border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center justify-center gap-1.5"
                          title="Cancelar turno"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Cancelar
                        </button>
                      )}
                      <button
                        onClick={() => handleAppointmentClick(appointment)}
                        className="px-3 py-2 border-2 border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:border-indigo-300 transition-colors"
                        title="Ver detalles"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Desktop: Layout horizontal */}
                  <div className="hidden sm:flex items-center gap-4">
                    {/* Fecha destacada */}
                    <div className="text-center min-w-[70px]">
                      <div className="w-16 h-16 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl flex flex-col items-center justify-center border-2 border-indigo-100">
                        <p className="text-xs text-indigo-600 font-semibold uppercase">
                          {formatDate(appointment.date).split(' ')[0]}
                        </p>
                        <p className={`font-bold text-gray-900 -mt-1 ${
                          isTodayAppointment(appointment) || isTomorrowAppointment(appointment) 
                            ? 'text-sm' 
                            : 'text-2xl'
                        }`}>
                          {getDayText(appointment)}
                        </p>
                      </div>
                    </div>

                    {/* Línea divisoria */}
                    <div className="w-px h-16 bg-gray-200" />

                    {/* Info principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="font-bold text-lg text-gray-900 truncate">{appointment.client_name}</h3>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${style}`}>
                          {label}
                        </span>
                        {appointment.modified_by_client && (
                          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                            Modificado
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-semibold text-gray-900">{appointment.time} hs</span>
                        </div>
                        {appointment.service_name && (
                          <div className="flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <span>{appointment.service_name}</span>
                          </div>
                        )}
                        {appointment.service_price > 0 && (
                          <div className="flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-semibold text-indigo-600">${appointment.service_price.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Acciones rápidas */}
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {appointment.status === 'pending' && (
                        <>
                          <button
                            onClick={(e) => handleQuickConfirm(appointment, e)}
                            className="px-3 py-2 bg-green-600 text-white rounded-xl text-xs font-semibold hover:bg-green-700 transition-colors shadow-sm hover:shadow-md flex items-center gap-1.5"
                            title="Confirmar rápidamente"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Confirmar
                          </button>
                          <button
                            onClick={(e) => handleQuickCancel(appointment, e)}
                            className="px-3 py-2 border-2 border-gray-300 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center gap-1.5"
                            title="Cancelar turno"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Cancelar
                          </button>
                        </>
                      )}
                      {appointment.status === 'confirmed' && (
                        <button
                          onClick={(e) => handleQuickCancel(appointment, e)}
                          className="px-3 py-2 border-2 border-gray-300 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center gap-1.5"
                          title="Cancelar turno"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Cancelar
                        </button>
                      )}
                      <button
                        onClick={() => handleAppointmentClick(appointment)}
                        className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                        title="Ver detalles"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Modal de detalles */}
      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedAppointment(null)
          }}
          onUpdate={handleModalUpdate}
          onDelete={() => deleteAppointment(selectedAppointment.id)}
        />
      )}

      {/* Modal de nueva cita */}
      <NewAppointmentModal
        isOpen={isNewAppointmentModalOpen}
        onClose={() => setIsNewAppointmentModalOpen(false)}
        onSuccess={handleModalUpdate}
      />

      {/* Modal de ajustes */}
      <AppointmentsSettings
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onUpdate={handleModalUpdate}
      />

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}
