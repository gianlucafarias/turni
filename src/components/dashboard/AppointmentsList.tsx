import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function AppointmentsList() {
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [store, setStore] = useState<any>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

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

  const filteredAppointments = filter === 'all' 
    ? appointments 
    : appointments.filter(a => a.status === filter)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Citas</h1>
          <p className="text-gray-500 mt-1">
            {pendingCount > 0 && <span className="text-amber-600 font-medium">{pendingCount} pendientes</span>}
            {pendingCount > 0 && confirmedCount > 0 && ' · '}
            {confirmedCount > 0 && <span className="text-green-600">{confirmedCount} confirmadas</span>}
          </p>
        </div>
        <a
          href="/dashboard/appointments/new"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Cita
        </a>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(['all', 'pending', 'confirmed', 'cancelled'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              filter === f
                ? 'bg-gray-900 text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f === 'all' && 'Todas'}
            {f === 'pending' && `Pendientes (${pendingCount})`}
            {f === 'confirmed' && 'Confirmadas'}
            {f === 'cancelled' && 'Canceladas'}
          </button>
        ))}
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
            {filter === 'all' ? 'No hay citas' : `No hay citas ${filter === 'pending' ? 'pendientes' : filter === 'confirmed' ? 'confirmadas' : 'canceladas'}`}
          </h3>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
            Las citas que recibas de tus clientes aparecerán aquí
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAppointments.map((appointment) => {
            const { style, label } = getStatusBadge(appointment.status)
            const isExpanded = expandedId === appointment.id

            return (
              <div
                key={appointment.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all"
              >
                {/* Fila principal */}
                <div 
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : appointment.id)}
                >
                  <div className="flex items-center gap-4">
                    {/* Fecha */}
                    <div className="text-center min-w-[60px]">
                      <p className="text-xs text-gray-400 uppercase">
                        {formatDate(appointment.date).split(' ')[0]}
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {new Date(appointment.date + 'T12:00:00').getDate()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(appointment.date).split(' ').slice(2).join(' ')}
                      </p>
                    </div>

                    {/* Línea divisoria */}
                    <div className="w-px h-12 bg-gray-200" />

                    {/* Info principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{appointment.client_name}</h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${style}`}>
                          {label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        <span className="font-medium">{appointment.time} hs</span>
                        {appointment.service_name && ` · ${appointment.service_name}`}
                        {appointment.service_price > 0 && ` · $${appointment.service_price.toLocaleString()}`}
                      </p>
                    </div>

                    {/* Flecha */}
                    <svg 
                      className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Detalles expandidos */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {appointment.client_email && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Email</p>
                          <p className="text-sm text-gray-900">{appointment.client_email}</p>
                        </div>
                      )}
                      {appointment.client_phone && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Teléfono</p>
                          <a 
                            href={`https://wa.me/${appointment.client_phone.replace(/\D/g, '')}`}
                            target="_blank"
                            className="text-sm text-green-600 hover:underline flex items-center gap-1"
                          >
                            {appointment.client_phone}
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                          </a>
                        </div>
                      )}
                      {appointment.client_location && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Localidad</p>
                          <p className="text-sm text-gray-900">{appointment.client_location}</p>
                        </div>
                      )}
                      {appointment.duration && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Duración</p>
                          <p className="text-sm text-gray-900">{appointment.duration} minutos</p>
                        </div>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                      {appointment.status === 'pending' && (
                        <button
                          onClick={() => updateStatus(appointment.id, 'confirmed')}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                        >
                          ✓ Confirmar
                        </button>
                      )}
                      {appointment.status !== 'cancelled' && (
                        <button
                          onClick={() => updateStatus(appointment.id, 'cancelled')}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                        >
                          Cancelar
                        </button>
                      )}
                      {appointment.status === 'cancelled' && (
                        <button
                          onClick={() => updateStatus(appointment.id, 'pending')}
                          className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors"
                        >
                          Reactivar
                        </button>
                      )}
                      <button
                        onClick={() => deleteAppointment(appointment.id)}
                        className="px-4 py-2 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors ml-auto"
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
      )}
    </div>
  )
}
