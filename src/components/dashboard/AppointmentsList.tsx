import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type AppointmentFilter = 'today' | 'pending' | 'confirmed' | 'cancelled' | 'week' | 'month' | 'all'

export default function AppointmentsList() {
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [store, setStore] = useState<any>(null)
  const [branches, setBranches] = useState<any[]>([])
  const [filter, setFilter] = useState<AppointmentFilter>('today')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showDateDropdown, setShowDateDropdown] = useState(false)

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

      // Cargar sucursales
      const { data: branchesData } = await supabase
        .from('branches')
        .select('id, name')
        .eq('store_id', storeData.id)
        .eq('is_active', true)
      setBranches(branchesData || [])

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

  async function updateStatus(id: string, status: string) {
    try {
      await supabase.from('appointments').update({ status }).eq('id', id)
      setAppointments(appointments.map(a => a.id === id ? { ...a, status } : a))
    } catch (error) {
      console.error('Error:', error)
    }
  }

  async function deleteAppointment(id: string) {
    if (!confirm('¿Eliminar esta cita?')) return
    try {
      await supabase.from('appointments').delete().eq('id', id)
      setAppointments(appointments.filter(a => a.id !== id))
    } catch (error) {
      console.error('Error:', error)
    }
  }

  function getStatusBadge(status: string) {
    const styles = {
      pending: 'bg-amber-50 text-amber-700 border-amber-100',
      confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      cancelled: 'bg-red-50 text-red-700 border-red-100'
    }
    const labels = {
      pending: 'Pendiente',
      confirmed: 'Confirmado',
      cancelled: 'Cancelado'
    }
    return (
      <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold border uppercase tracking-wider ${styles[status as keyof typeof styles] || 'bg-surface-100 text-surface-700 border-surface-200'}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    )
  }

  // Filtrar appointments según el filtro seleccionado
  const getFilteredAppointments = () => {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoStr = weekAgo.toISOString().split('T')[0]
    
    const monthAgo = new Date(now)
    monthAgo.setDate(monthAgo.getDate() - 30)
    const monthAgoStr = monthAgo.toISOString().split('T')[0]

    switch (filter) {
      case 'today':
        return appointments.filter(a => a.date === todayStr)
      case 'pending':
        return appointments.filter(a => a.status === 'pending')
      case 'confirmed':
        return appointments.filter(a => a.status === 'confirmed')
      case 'cancelled':
        return appointments.filter(a => a.status === 'cancelled')
      case 'week':
        return appointments.filter(a => a.date >= weekAgoStr)
      case 'month':
        return appointments.filter(a => a.date >= monthAgoStr)
      default:
        return appointments
    }
  }

  const filteredAppointments = getFilteredAppointments()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-surface-500 font-medium">Cargando citas...</p>
        </div>
      </div>
    )
  }

  const pendingCount = appointments.filter(a => a.status === 'pending').length
  const confirmedCount = appointments.filter(a => a.status === 'confirmed').length
  const cancelledCount = appointments.filter(a => a.status === 'cancelled').length

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Mis Citas</h1>
          <p className="text-surface-500 mt-1">
            {pendingCount > 0 && <span className="text-amber-600 font-medium">{pendingCount} pendientes</span>}
            {pendingCount > 0 && confirmedCount > 0 && ' · '}
            {confirmedCount > 0 && <span className="text-emerald-600">{confirmedCount} confirmadas</span>}
          </p>
        </div>
        <a
          href="/dashboard/appointments/new"
          className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-600/20 text-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Cita
        </a>
      </div>

      {/* Filtros como pills redondeadas */}
      <div className="flex flex-wrap gap-2 mb-6 items-center">
        {/* Filtros principales */}
        {(['today', 'pending', 'confirmed', 'cancelled'] as const).map((f) => {
          const labels = { today: 'Hoy', pending: 'Pendientes', confirmed: 'Confirmadas', cancelled: 'Canceladas' }
          const todayStr = new Date().toISOString().split('T')[0]
          const counts = { 
            today: appointments.filter(a => a.date === todayStr).length,
            pending: pendingCount, 
            confirmed: confirmedCount, 
            cancelled: cancelledCount 
          }
          const count = counts[f]
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                filter === f
                  ? 'bg-surface-900 text-white shadow-md'
                  : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
              }`}
            >
              {labels[f]}{count > 0 ? ` (${count})` : ''}
            </button>
          )
        })}

        {/* Dropdown de fechas */}
        <div className="relative">
          <button
            onClick={() => setShowDateDropdown(!showDateDropdown)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              ['week', 'month', 'all'].includes(filter)
                ? 'bg-surface-900 text-white shadow-md'
                : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
            }`}
          >
            {filter === 'week' && 'Últimos 7 días'}
            {filter === 'month' && 'Últimos 30 días'}
            {filter === 'all' && 'Todas'}
            {!['week', 'month', 'all'].includes(filter) && 'Más'}
            <svg className={`w-3.5 h-3.5 transition-transform ${showDateDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDateDropdown && (
            <>
              <div 
                className="fixed inset-0 z-[100]" 
                onClick={() => setShowDateDropdown(false)}
              />
              <div className="absolute left-0 top-full mt-2 w-44 bg-white rounded-xl shadow-2xl border border-surface-200 py-1 z-[110] animate-fadeIn">
                <button
                  onClick={() => { setFilter('week'); setShowDateDropdown(false) }}
                  className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                    filter === 'week' ? 'bg-surface-100 text-surface-900' : 'text-surface-600 hover:bg-surface-50'
                  }`}
                >
                  Últimos 7 días
                </button>
                <button
                  onClick={() => { setFilter('month'); setShowDateDropdown(false) }}
                  className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                    filter === 'month' ? 'bg-surface-100 text-surface-900' : 'text-surface-600 hover:bg-surface-50'
                  }`}
                >
                  Últimos 30 días
                </button>
                <div className="border-t border-surface-100 my-1" />
                <button
                  onClick={() => { setFilter('all'); setShowDateDropdown(false) }}
                  className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                    filter === 'all' ? 'bg-surface-100 text-surface-900' : 'text-surface-600 hover:bg-surface-50'
                  }`}
                >
                  Todas ({appointments.length})
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lista */}
      {filteredAppointments.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-sm border border-surface-200/60 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-surface-100 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-surface-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-surface-900 mb-2">
            {filter === 'all' ? 'No hay citas' : `No hay citas ${filter === 'pending' ? 'pendientes' : filter === 'confirmed' ? 'confirmadas' : 'canceladas'}`}
          </h3>
          <p className="text-surface-500 mb-6 max-w-sm mx-auto">
            Las citas que recibas de tus clientes aparecerán aquí
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-4 sm:p-6 border border-surface-200/60 shadow-sm">
          <div className="space-y-3">
            {filteredAppointments.map((appointment) => {
              const isExpanded = expandedId === appointment.id
              const date = new Date(appointment.date + 'T12:00:00')

              return (
                <div
                  key={appointment.id}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    isExpanded 
                      ? 'bg-white border-surface-200 shadow-md' 
                      : 'bg-surface-50 border-transparent hover:bg-white hover:border-surface-200 hover:shadow-sm'
                  }`}
                >
                  {/* Fila principal */}
                  <div 
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : appointment.id)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Fecha en columna vertical */}
                      <div className="text-center min-w-[50px]">
                        <p className="text-lg font-black text-surface-900">
                          {date.getDate()}/{String(date.getMonth() + 1).padStart(2, '0')}
                        </p>
                        <p className="text-[10px] font-bold text-surface-400">
                          {appointment.time?.substring(0, 5)}
                        </p>
                      </div>

                      {/* Línea divisoria */}
                      <div className="w-px h-10 bg-surface-200" />

                      {/* Info principal */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-surface-900 truncate">{appointment.client_name}</p>
                        <p className="text-xs font-semibold text-surface-500 truncate mt-0.5">
                          {appointment.service_name || 'Turno general'}
                          {appointment.service_price > 0 && ` · $${appointment.service_price.toLocaleString()}`}
                        </p>
                      </div>

                      {/* Badge y flecha */}
                      <div className="flex items-center gap-2">
                        <div className="hidden sm:block">
                          {getStatusBadge(appointment.status)}
                        </div>
                        <svg 
                          className={`w-5 h-5 text-surface-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Detalles expandidos */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-surface-100 pt-4 animate-fadeIn">
                      {/* Badge en móvil */}
                      <div className="sm:hidden mb-4">
                        {getStatusBadge(appointment.status)}
                      </div>

                      {/* Info del cliente */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        {appointment.client_email && (
                          <div>
                            <p className="text-[10px] text-surface-400 uppercase font-bold tracking-wider mb-1">Email</p>
                            <a href={`mailto:${appointment.client_email}`} className="text-sm text-surface-900 hover:text-brand-600">
                              {appointment.client_email}
                            </a>
                          </div>
                        )}
                        {appointment.client_phone && (
                          <div>
                            <p className="text-[10px] text-surface-400 uppercase font-bold tracking-wider mb-1">Teléfono</p>
                            <a 
                              href={`https://wa.me/${appointment.client_phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 font-medium"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                              {appointment.client_phone}
                            </a>
                          </div>
                        )}
                        {appointment.client_location && (
                          <div>
                            <p className="text-[10px] text-surface-400 uppercase font-bold tracking-wider mb-1">Localidad</p>
                            <p className="text-sm text-surface-900">{appointment.client_location}</p>
                          </div>
                        )}
                        {appointment.duration && (
                          <div>
                            <p className="text-[10px] text-surface-400 uppercase font-bold tracking-wider mb-1">Duración</p>
                            <p className="text-sm text-surface-900">{appointment.duration} minutos</p>
                          </div>
                        )}
                        {appointment.branch_id && (
                          <div>
                            <p className="text-[10px] text-surface-400 uppercase font-bold tracking-wider mb-1">Sucursal</p>
                            <p className="text-sm text-surface-900 flex items-center gap-1">
                              📍 {branches.find(b => b.id === appointment.branch_id)?.name || 'Sucursal'}
                            </p>
                          </div>
                        )}
                        {appointment.notes && (
                          <div className="sm:col-span-2">
                            <p className="text-[10px] text-surface-400 uppercase font-bold tracking-wider mb-1">Notas</p>
                            <p className="text-sm text-surface-700 bg-surface-50 p-3 rounded-xl">{appointment.notes}</p>
                          </div>
                        )}
                      </div>

                      {/* Acciones */}
                      <div className="flex flex-wrap gap-2 pt-4 border-t border-surface-100">
                        {appointment.status === 'pending' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              updateStatus(appointment.id, 'confirmed')
                            }}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                          >
                            ✓ Confirmar
                          </button>
                        )}
                        {appointment.status !== 'cancelled' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              updateStatus(appointment.id, 'cancelled')
                            }}
                            className="px-4 py-2 bg-surface-100 text-surface-700 rounded-xl text-sm font-bold hover:bg-surface-200 transition-colors"
                          >
                            Cancelar
                          </button>
                        )}
                        {appointment.status === 'cancelled' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              updateStatus(appointment.id, 'pending')
                            }}
                            className="px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-sm font-bold hover:bg-amber-200 transition-colors"
                          >
                            Reactivar
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteAppointment(appointment.id)
                          }}
                          className="px-4 py-2 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 transition-colors ml-auto"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Estilos */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
      `}</style>
    </div>
  )
}
