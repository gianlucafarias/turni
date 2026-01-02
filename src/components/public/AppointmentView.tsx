import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import DateTimeSelector from '../shared/DateTimeSelector'

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
  const [editDate, setEditDate] = useState<Date | null>(
    appointment.date ? new Date(appointment.date + 'T12:00:00') : null
  )
  const [editTime, setEditTime] = useState(appointment.time?.substring(0, 5) || '')
  const [editNotes, setEditNotes] = useState(appointment.notes || '')

  async function handleUpdate() {
    if (!editDate || !editTime) {
      setError('Por favor seleccioná fecha y hora')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const oldDate = appointment.date
      const oldTime = appointment.time
      const newDateStr = editDate.toISOString().split('T')[0]

      const updateData: any = {
        date: newDateStr,
        time: editTime,
        modified_by_client: true,
        client_modified_at: new Date().toISOString()
      }
      
      if (editNotes.trim()) {
        updateData.notes = editNotes.trim()
      }

      const { error: updateError } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', appointment.id)
        .eq('public_token', appointment.public_token)

      if (updateError) throw updateError

      // Recargar appointment
      const { data: updated } = await supabase
        .from('appointments')
        .select('*, stores(*)')
        .eq('id', appointment.id)
        .single()

      setAppointment(updated)
      setShowEditForm(false)
      setSuccess('¡Turno modificado correctamente!')

      // Notificar al negocio
      try {
        await fetch('/api/appointments/notify-change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appointment_id: appointment.id,
            change_type: 'modified',
            old_date: oldDate,
            old_time: oldTime,
            new_date: newDateStr,
            new_time: editTime
          })
        })
      } catch {
        // Ignorar error de notificación
      }
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
      const { error: cancelError } = await supabase
        .from('appointments')
        .update({
          status: 'cancelled',
          modified_by_client: true
        })
        .eq('id', appointment.id)
        .eq('public_token', appointment.public_token)

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
      try {
        await fetch('/api/appointments/notify-change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appointment_id: appointment.id,
            change_type: 'cancelled'
          })
        })
      } catch {
        // Ignorar
      }
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
    return timeStr?.substring(0, 5) || ''
  }

  const getStatusConfig = (status: string) => {
    const configs = {
      confirmed: { 
        bg: 'bg-emerald-50', 
        text: 'text-emerald-700', 
        border: 'border-emerald-200',
        icon: '✓',
        label: 'Confirmado' 
      },
      cancelled: { 
        bg: 'bg-red-50', 
        text: 'text-red-700', 
        border: 'border-red-200',
        icon: '✕',
        label: 'Cancelado' 
      },
      pending: { 
        bg: 'bg-amber-50', 
        text: 'text-amber-700', 
        border: 'border-amber-200',
        icon: '⏳',
        label: 'Pendiente de confirmación' 
      }
    }
    return configs[status as keyof typeof configs] || configs.pending
  }

  const statusConfig = getStatusConfig(appointment.status)
  const isPast = new Date(`${appointment.date}T${appointment.time}`) < new Date()
  const canModify = !isPast && appointment.status !== 'cancelled'

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-lg mx-auto">
        
        {/* Header con info de tienda */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 mb-6">
          <div className="h-24 bg-gradient-to-br from-brand-600 to-brand-700 relative">
            {store.banner_image_url && (
              <img 
                src={store.banner_image_url} 
                alt="" 
                className="w-full h-full object-cover opacity-80" 
              />
            )}
          </div>
          
          <div className="px-6 -mt-10 relative z-10 pb-6">
            <div className="w-20 h-20 rounded-2xl bg-white p-1 shadow-lg border-4 border-white">
              {store.profile_image_url ? (
                <img 
                  src={store.profile_image_url}
                  alt={store.name}
                  className="w-full h-full rounded-xl object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center">
                  <span className="text-2xl font-black text-brand-500">
                    {store.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            
            <div className="mt-3">
              <h1 className="text-xl font-bold text-gray-900">{store.name}</h1>
              {store.location && (
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  {store.location}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Mensajes */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl mb-6 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-2xl mb-6 text-sm flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {success}
          </div>
        )}

        {/* Card principal del turno */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          
          {/* Status badge */}
          <div className={`${statusConfig.bg} ${statusConfig.border} border-b px-6 py-4`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{statusConfig.icon}</span>
              <div>
                <p className={`font-semibold ${statusConfig.text}`}>{statusConfig.label}</p>
                {appointment.modified_by_client && (
                  <p className="text-xs text-gray-500">Modificado por ti</p>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            
            {/* Vista normal - Fecha y hora */}
            {!showEditForm && (
              <div className="bg-gradient-to-br from-brand-50 to-brand-100/50 rounded-2xl p-5 border border-brand-100">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white rounded-2xl flex flex-col items-center justify-center border border-brand-200 shadow-sm">
                    <span className="text-[10px] text-brand-600 font-bold uppercase">
                      {formatDate(appointment.date).split(' ')[0].slice(0, 3)}
                    </span>
                    <span className="text-2xl font-black text-gray-900 -mt-0.5">
                      {new Date(appointment.date + 'T12:00:00').getDate()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-brand-600 font-medium mb-0.5">Fecha y hora</p>
                    <p className="text-sm font-semibold text-gray-900 capitalize">
                      {formatDate(appointment.date)}
                    </p>
                    <p className="text-2xl font-black text-brand-600 mt-0.5">
                      {formatTime(appointment.time)} hs
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Formulario de edición */}
            {showEditForm && canModify && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">Modificar turno</h3>
                  <button
                    onClick={() => {
                      setShowEditForm(false)
                      setEditDate(appointment.date ? new Date(appointment.date + 'T12:00:00') : null)
                      setEditTime(appointment.time?.substring(0, 5) || '')
                      setEditNotes(appointment.notes || '')
                      setError(null)
                    }}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancelar
                  </button>
                </div>

                {/* Selector de fecha y hora */}
                <DateTimeSelector
                  storeId={store.id}
                  selectedDate={editDate}
                  selectedTime={editTime}
                  onDateChange={setEditDate}
                  onTimeChange={setEditTime}
                  excludeAppointmentId={appointment.id}
                  allowMultiple={store.allow_multiple_appointments}
                  maxPerSlot={store.max_appointments_per_slot || 1}
                />

                {/* Nota */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                    Nota adicional (opcional)
                  </label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Agrega una nota sobre el cambio..."
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all resize-none text-sm"
                  />
                </div>

                {/* Botón guardar */}
                <button
                  onClick={handleUpdate}
                  disabled={loading || !editDate || !editTime}
                  className="w-full py-3.5 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-brand-600/20"
                >
                  {loading ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            )}

            {/* Servicio */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Servicio</p>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="font-semibold text-gray-900">
                  {appointment.service_name || 'Turno general'}
                </p>
                {appointment.service_price > 0 && (
                  <p className="text-xl font-bold text-brand-600 mt-1">
                    ${appointment.service_price.toLocaleString()}
                  </p>
                )}
                {appointment.duration && (
                  <p className="text-sm text-gray-500 mt-1">
                    Duración: {appointment.duration} minutos
                  </p>
                )}
              </div>
            </div>

            {/* Notas */}
            {appointment.notes && !showEditForm && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Notas</p>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-gray-700 text-sm">{appointment.notes}</p>
                </div>
              </div>
            )}

            {/* Acciones */}
            {canModify && !showEditForm && (
              <div className="space-y-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setShowEditForm(true)}
                  className="w-full py-3.5 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-600/20"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Modificar fecha u hora
                </button>
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full py-3 border-2 border-red-200 text-red-600 font-semibold rounded-xl hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancelar turno
                </button>
              </div>
            )}

            {/* Turno cancelado */}
            {appointment.status === 'cancelled' && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
                <p className="text-red-700 font-semibold">Este turno ha sido cancelado</p>
              </div>
            )}

            {/* Turno pasado */}
            {isPast && appointment.status !== 'cancelled' && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 text-center">
                <p className="text-gray-700 font-semibold">Este turno ya pasó</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer con enlace a la tienda */}
        <div className="mt-6 text-center">
          <a 
            href={`/${store.slug || store.id}`}
            className="inline-flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Reservar otro turno
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>

      {/* Modal de confirmación de cancelación */}
      {showCancelConfirm && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowCancelConfirm(false)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 animate-modalIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">¿Cancelar turno?</h3>
              <p className="text-gray-600 text-sm">
                Esta acción no se puede deshacer. El negocio será notificado de la cancelación.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                No, mantener
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

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modalIn { animation: modalIn 0.2s ease-out; }
      `}</style>
    </div>
  )
}
