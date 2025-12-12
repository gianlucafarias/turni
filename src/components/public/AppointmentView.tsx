import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  appointment: any
  store: any
}

export default function AppointmentView({ appointment: initialAppointment, store }: Props) {
  const [appointment, setAppointment] = useState(initialAppointment)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  // Estados del formulario de edición
  const [editDate, setEditDate] = useState(appointment.date)
  const [editTime, setEditTime] = useState(appointment.time)
  const [editNotes, setEditNotes] = useState(appointment.notes || '')
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [daysOff, setDaysOff] = useState<any[]>([])
  const [existingAppointments, setExistingAppointments] = useState<any[]>([])

  useEffect(() => {
    loadSchedulesAndSlots()
  }, [])

  // Recalcular slots cuando cambien los datos necesarios
  useEffect(() => {
    if (schedules.length > 0 && editDate) {
      calculateAvailableSlots(new Date(editDate))
    }
  }, [schedules, daysOff, existingAppointments, editDate])

  async function loadSchedulesAndSlots() {
    try {
      const [schedulesRes, daysOffRes, appointmentsRes] = await Promise.all([
        supabase.from('schedules').select('*').eq('store_id', store.id),
        supabase.from('days_off').select('*').eq('store_id', store.id),
        supabase
          .from('appointments')
          .select('date, time, id')
          .eq('store_id', store.id)
          .in('status', ['pending', 'confirmed'])
      ])

      setSchedules(schedulesRes.data || [])
      setDaysOff(daysOffRes.data || [])
      // Filtrar el turno actual de los appointments existentes
      const filteredAppointments = (appointmentsRes.data || []).filter(apt => apt.id !== appointment.id)
      setExistingAppointments(filteredAppointments)
    } catch (error) {
      console.error('Error cargando horarios:', error)
    }
  }

  function calculateAvailableSlots(date: Date) {
    const dayOfWeek = date.getDay()
    const dateStr = date.toISOString().split('T')[0]
    
    // Verificar si es día libre
    const isDayOff = daysOff.some(doff => doff.date === dateStr)
    if (isDayOff) {
      setAvailableSlots([])
      return
    }

    // Buscar horario para este día
    const schedule = schedules.find(s => s.day === dayOfWeek && s.enabled)
    if (!schedule) {
      setAvailableSlots([])
      return
    }

    // Generar slots disponibles
    const slots: string[] = []
    const slotDuration = schedule.slot_duration || 30

    // Filtrar appointments que no sean el turno actual
    // Si estamos editando el mismo día, el turno actual ya no debería contar
    const relevantAppointments = existingAppointments.filter(
      apt => apt.id !== appointment.id
    )

    if (schedule.is_continuous) {
      const start = new Date(`${dateStr}T${schedule.start_time}`)
      const end = new Date(`${dateStr}T${schedule.end_time}`)
      let current = new Date(start)

      while (current < end) {
        const timeStr = current.toTimeString().slice(0, 5)
        // Verificar disponibilidad (excluyendo el turno actual)
        const existingCount = relevantAppointments.filter(
          apt => apt.date === dateStr && apt.time === timeStr
        ).length

        const maxSlots = store.allow_multiple_appointments ? (store.max_appointments_per_slot || 1) : 1
        if (existingCount < maxSlots) {
          slots.push(timeStr)
        }

        current.setMinutes(current.getMinutes() + slotDuration)
      }
    } else {
      // Horario con descanso
      const morningStart = new Date(`${dateStr}T${schedule.morning_start}`)
      const morningEnd = new Date(`${dateStr}T${schedule.morning_end}`)
      const afternoonStart = new Date(`${dateStr}T${schedule.afternoon_start}`)
      const afternoonEnd = new Date(`${dateStr}T${schedule.afternoon_end}`)

      // Slots de la mañana
      let current = new Date(morningStart)
      while (current < morningEnd) {
        const timeStr = current.toTimeString().slice(0, 5)
        const existingCount = relevantAppointments.filter(
          apt => apt.date === dateStr && apt.time === timeStr
        ).length
        const maxSlots = store.allow_multiple_appointments ? (store.max_appointments_per_slot || 1) : 1
        if (existingCount < maxSlots) {
          slots.push(timeStr)
        }
        current.setMinutes(current.getMinutes() + slotDuration)
      }

      // Slots de la tarde
      current = new Date(afternoonStart)
      while (current < afternoonEnd) {
        const timeStr = current.toTimeString().slice(0, 5)
        const existingCount = relevantAppointments.filter(
          apt => apt.date === dateStr && apt.time === timeStr
        ).length
        const maxSlots = store.allow_multiple_appointments ? (store.max_appointments_per_slot || 1) : 1
        if (existingCount < maxSlots) {
          slots.push(timeStr)
        }
        current.setMinutes(current.getMinutes() + slotDuration)
      }
    }

    setAvailableSlots(slots)
  }

  async function handleUpdate() {
    if (!editDate || !editTime) {
      setError('Por favor selecciona fecha y hora')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const oldDate = appointment.date
      const oldTime = appointment.time

      // Validar que el token coincida antes de actualizar
      const updateData: any = {
        date: editDate,
        time: editTime,
        modified_by_client: true,
        client_modified_at: new Date().toISOString()
      }
      
      // Agregar notas si se proporcionaron
      if (editNotes.trim()) {
        updateData.notes = editNotes.trim()
      }

      const { error: updateError } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', appointment.id)
        .eq('public_token', appointment.public_token) // Validación adicional de seguridad

      if (updateError) throw updateError

      // Recargar appointment
      const { data: updated } = await supabase
        .from('appointments')
        .select('*, stores(*)')
        .eq('id', appointment.id)
        .single()

      setAppointment(updated)
      setShowEditForm(false)
      setSuccess('Turno actualizado correctamente')

      // Notificar al negocio (esto se hará via trigger o API)
      await fetch('/api/appointments/notify-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment_id: appointment.id,
          change_type: 'modified',
          old_date: oldDate,
          old_time: oldTime,
          new_date: editDate,
          new_time: editTime
        })
      })
    } catch (error: any) {
      setError(error.message || 'Error al actualizar el turno')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    setLoading(true)
    setError(null)

    try {
      // Validar que el token coincida antes de cancelar
      const { error: cancelError } = await supabase
        .from('appointments')
        .update({
          status: 'cancelled',
          modified_by_client: true
        })
        .eq('id', appointment.id)
        .eq('public_token', appointment.public_token) // Validación adicional de seguridad

      if (cancelError) throw cancelError

      // Recargar appointment
      const { data: updated } = await supabase
        .from('appointments')
        .select('*, stores(*)')
        .eq('id', appointment.id)
        .single()

      setAppointment(updated)
      setShowCancelConfirm(false)
      setSuccess('Turno cancelado correctamente')

      // Notificar al negocio
      await fetch('/api/appointments/notify-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment_id: appointment.id,
          change_type: 'cancelled'
        })
      })
    } catch (error: any) {
      setError(error.message || 'Error al cancelar el turno')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('es', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatTime = (timeStr: string) => {
    return timeStr.substring(0, 5)
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      confirmed: 'bg-green-100 text-green-700 border-green-200',
      cancelled: 'bg-red-100 text-red-700 border-red-200',
      pending: 'bg-amber-100 text-amber-700 border-amber-200'
    }
    const labels = {
      confirmed: 'Confirmada',
      cancelled: 'Cancelada',
      pending: 'Pendiente'
    }
    return {
      style: styles[status as keyof typeof styles] || styles.pending,
      label: labels[status as keyof typeof labels] || 'Pendiente'
    }
  }

  const { style, label } = getStatusBadge(appointment.status)
  const isPast = new Date(`${appointment.date}T${appointment.time}`) < new Date()
  const canModify = !isPast && appointment.status !== 'cancelled'

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-2xl mx-auto">
        {/* Header con perfil de tienda */}
        <div className="bg-white rounded-b-3xl overflow-hidden shadow-sm mb-8">
          {/* Banner */}
          <div className="h-32 bg-gradient-to-br from-indigo-600 to-purple-700 relative">
            {store.banner_image_url && (
              <img 
                src={store.banner_image_url} 
                alt="" 
                className="w-full h-full object-cover opacity-80" 
              />
            )}
          </div>
          
          {/* Avatar y nombre */}
          <div className="px-6 -mt-16 relative z-10 pb-6">
            <div className="w-32 h-32 rounded-2xl bg-white p-1 shadow-lg border-4 border-white">
              {store.profile_image_url ? (
                <img 
                  src={store.profile_image_url}
                  alt={store.name}
                  className="w-full h-full rounded-xl object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                  <span className="text-4xl font-black text-indigo-400">
                    {store.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            
            {/* Nombre de la tienda */}
            <div className="mt-4">
              <h1 className="text-2xl font-bold text-gray-900">{store.name}</h1>
              {store.location && (
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {store.location}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Título de la sección */}
        <div className="text-center mb-6 px-4">
          <h2 className="text-2xl font-bold text-gray-900">Detalles de tu turno</h2>
        </div>

        {/* Mensajes */}
        <div className="px-4 mb-6">
          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-600 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border-2 border-green-200 text-green-600 px-4 py-3 rounded-xl">
              {success}
            </div>
          )}
        </div>

        {/* Card principal */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden mx-4 mb-8">
          {/* Status Badge */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b border-indigo-100">
            <div className="flex items-center justify-between">
              <span className={`px-4 py-2 text-sm font-semibold rounded-xl border ${style}`}>
                {label}
              </span>
              {appointment.modified_by_client && (
                <span className="text-xs text-gray-500 italic">
                  Modificado por ti
                </span>
              )}
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Fecha y Hora destacadas */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-white rounded-2xl flex flex-col items-center justify-center border-2 border-indigo-200 shadow-sm">
                  <span className="text-xs text-indigo-600 font-semibold uppercase">
                    {formatDate(appointment.date).split(' ')[0]}
                  </span>
                  <span className="text-3xl font-bold text-gray-900 -mt-1">
                    {new Date(appointment.date + 'T12:00:00').getDate()}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-indigo-600 font-medium mb-1">Fecha y hora</p>
                  <p className="text-lg font-bold text-gray-900 capitalize">
                    {formatDate(appointment.date)}
                  </p>
                  <p className="text-3xl font-bold text-indigo-600 mt-1">
                    {formatTime(appointment.time)} hs
                  </p>
                </div>
              </div>
            </div>

            {/* Información del servicio */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Servicio
              </h3>
              <div className="bg-gray-50 rounded-2xl p-5">
                <p className="text-lg font-semibold text-gray-900">
                  {appointment.service_name || 'Turno general'}
                </p>
                {appointment.service_price > 0 && (
                  <p className="text-2xl font-bold text-indigo-600 mt-2">
                    ${appointment.service_price.toLocaleString()}
                  </p>
                )}
                {appointment.duration && (
                  <p className="text-sm text-gray-500 mt-2">
                    Duración: {appointment.duration} minutos
                  </p>
                )}
              </div>
            </div>

            {/* Notas si existen */}
            {appointment.notes && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Notas
                </h3>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                  <p className="text-gray-700 italic">{appointment.notes}</p>
                </div>
              </div>
            )}

            {/* Formulario de edición */}
            {showEditForm && canModify && (
              <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-6 space-y-4">
                <h3 className="font-semibold text-gray-900">Modificar turno</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nueva fecha
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => {
                      setEditDate(e.target.value)
                      if (e.target.value) {
                        calculateAvailableSlots(new Date(e.target.value))
                      }
                    }}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-0 transition-colors"
                  />
                </div>

                {editDate && availableSlots.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nueva hora
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setEditTime(slot)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            editTime === slot
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-indigo-300'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {editDate && availableSlots.length === 0 && (
                  <p className="text-sm text-amber-600">
                    No hay horarios disponibles para esta fecha
                  </p>
                )}

                {/* Campo de notas opcional */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nota adicional (opcional)
                  </label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Agrega una nota sobre el cambio de turno..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-0 transition-colors resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Esta nota será visible para el negocio
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditForm(false)
                      setEditDate(appointment.date)
                      setEditTime(appointment.time)
                      setEditNotes(appointment.notes || '')
                      setError(null)
                    }}
                    className="flex-1 px-4 py-3 bg-white text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors border-2 border-gray-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleUpdate}
                    disabled={loading || !editDate || !editTime}
                    className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            )}

            {/* Acciones */}
            {canModify && !showEditForm && (
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowEditForm(true)}
                  className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Modificar fecha u hora
                </button>
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full px-4 py-3 border-2 border-red-300 text-red-600 rounded-xl font-semibold hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancelar turno
                </button>
              </div>
            )}

            {appointment.status === 'cancelled' && (
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 text-center">
                <p className="text-red-700 font-semibold">Este turno ha sido cancelado</p>
              </div>
            )}

            {isPast && appointment.status !== 'cancelled' && (
              <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-5 text-center">
                <p className="text-gray-700 font-semibold">Este turno ya pasó</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de confirmación de cancelación */}
      {showCancelConfirm && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowCancelConfirm(false)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">¿Cancelar turno?</h3>
              <p className="text-gray-600">
                Esta acción no se puede deshacer. El negocio será notificado de la cancelación.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                No, mantener turno
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Cancelando...' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

