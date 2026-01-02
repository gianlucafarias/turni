import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import DateTimeSelector from '../shared/DateTimeSelector'

interface Props {
  appointment: any
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
  onDelete: () => void
  store?: any
}

interface Toast {
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
}

export default function AppointmentDetailModal({
  appointment,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  store
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [copied, setCopied] = useState(false)
  
  // Estados de edición
  const [isEditing, setIsEditing] = useState(false)
  const [editDate, setEditDate] = useState<Date | null>(null)
  const [editTime, setEditTime] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [subscription, setSubscription] = useState<any>(null)

  // Cargar datos de suscripción
  useEffect(() => {
    if (store?.id && isOpen) {
      loadSubscription()
    }
  }, [store?.id, isOpen])

  // Resetear edición cuando cambia el appointment
  useEffect(() => {
    if (appointment) {
      setEditDate(appointment.date ? new Date(appointment.date + 'T12:00:00') : null)
      setEditTime(appointment.time?.substring(0, 5) || '')
      setEditNotes(appointment.notes || '')
      setIsEditing(false)
    }
  }, [appointment?.id])

  async function loadSubscription() {
    const { data } = await supabase
      .from('subscriptions')
      .select('plan_id, status, trial_ends_at')
      .eq('store_id', store.id)
      .single()
    setSubscription(data)
  }

  const showToast = useCallback((toastData: Toast) => {
    setToast(toastData)
    setTimeout(() => setToast(null), 5000)
  }, [])

  const isPremium = () => {
    if (!subscription) return false
    const premiumPlans = ['premium', 'premium_annual']
    const isTrialActive = subscription.status === 'trial' && 
      subscription.trial_ends_at && 
      new Date(subscription.trial_ends_at) > new Date()
    return (subscription.status === 'active' && premiumPlans.includes(subscription.plan_id)) || isTrialActive
  }

  if (!isOpen || !appointment) return null

  const getStatusConfig = (status: string) => {
    const configs = {
      confirmed: { 
        bg: 'bg-emerald-50', 
        text: 'text-emerald-700', 
        border: 'border-emerald-200',
        icon: '✓',
        iconBg: 'bg-emerald-100',
        label: 'Confirmado' 
      },
      cancelled: { 
        bg: 'bg-red-50', 
        text: 'text-red-700', 
        border: 'border-red-200',
        icon: '✕',
        iconBg: 'bg-red-100',
        label: 'Cancelado' 
      },
      pending: { 
        bg: 'bg-amber-50', 
        text: 'text-amber-700', 
        border: 'border-amber-200',
        icon: '⏳',
        iconBg: 'bg-amber-100',
        label: 'Pendiente' 
      }
    }
    return configs[status as keyof typeof configs] || configs.pending
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

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointment.id)

      if (error) throw error

      // Enviar notificación si es premium
      if (isPremium() && newStatus === 'confirmed') {
        try {
          const response = await fetch('/api/notifications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'appointment_confirmed',
              appointment_id: appointment.id,
              store_id: store.id,
            }),
          })

          if (response.ok) {
            showToast({
              type: 'success',
              title: 'Turno confirmado',
              message: `${appointment.client_name} fue notificado por WhatsApp`
            })
          } else {
            showToast({
              type: 'warning',
              title: 'Turno confirmado',
              message: 'No se pudo notificar por WhatsApp'
            })
          }
        } catch {
          showToast({ type: 'success', title: 'Turno confirmado' })
        }
      } else if (newStatus === 'cancelled') {
        showToast({ type: 'info', title: 'Turno cancelado' })
      } else {
        showToast({ type: 'success', title: 'Estado actualizado' })
      }

      setTimeout(() => {
        onUpdate()
        onClose()
      }, 1000)
    } catch (err: any) {
      setError(err.message || 'Error al actualizar el estado')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async () => {
    if (!editDate || !editTime) {
      setError('Seleccioná fecha y hora')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const oldDate = appointment.date
      const oldTime = appointment.time
      const newDateStr = editDate.toISOString().split('T')[0]

      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          date: newDateStr,
          time: editTime,
          notes: editNotes || null
        })
        .eq('id', appointment.id)

      if (updateError) throw updateError

      // Notificar al cliente si es premium
      if (isPremium() && (oldDate !== newDateStr || oldTime !== editTime)) {
        try {
          const response = await fetch('/api/notifications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'appointment_modified',
              appointment_id: appointment.id,
              store_id: store.id,
              old_date: oldDate,
              old_time: oldTime,
              new_date: newDateStr,
              new_time: editTime
            }),
          })

          if (response.ok) {
            showToast({
              type: 'success',
              title: 'Turno modificado',
              message: `${appointment.client_name} fue notificado por WhatsApp`
            })
          } else {
            showToast({
              type: 'warning',
              title: 'Turno modificado',
              message: 'No se pudo notificar al cliente'
            })
          }
        } catch {
          showToast({ type: 'success', title: 'Turno modificado' })
        }
      } else {
        showToast({ type: 'success', title: 'Turno modificado' })
      }

      setIsEditing(false)
      setTimeout(() => {
        onUpdate()
      }, 500)
    } catch (err: any) {
      setError(err.message || 'Error al modificar el turno')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    setError(null)

    try {
      await onDelete()
    } catch (err: any) {
      setError(err.message || 'Error al eliminar el turno')
      setLoading(false)
    }
  }

  const startEditing = () => {
    setIsEditing(true)
  }

  const publicUrl = appointment.public_token 
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/appointment/${appointment.public_token}`
    : null

  const copyPublicUrl = async () => {
    if (publicUrl) {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const statusConfig = getStatusConfig(appointment.status)
  const isPastAppointment = new Date(`${appointment.date}T${appointment.time}`) < new Date()
  const canModify = !isPastAppointment && appointment.status !== 'cancelled'

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay con blur */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden animate-modalIn">
          
          {/* Header con gradiente */}
          <div className="relative bg-gradient-to-br from-brand-600 to-brand-700 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${statusConfig.iconBg} flex items-center justify-center`}>
                  <span className={`text-lg ${statusConfig.text}`}>{statusConfig.icon}</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Detalles del turno</h2>
                  <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-lg ${statusConfig.bg} ${statusConfig.text}`}>
                    {statusConfig.label}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/20 text-white hover:bg-white/30 transition-colors flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-180px)]">
            
            {/* Fecha y Hora destacadas */}
            {!isEditing ? (
              <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-2xl p-5 border border-surface-200">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white rounded-2xl flex flex-col items-center justify-center border border-surface-200 shadow-sm">
                    <span className="text-[10px] text-brand-600 font-bold uppercase tracking-wide">
                      {formatDate(appointment.date).split(' ')[0].slice(0, 3)}
                    </span>
                    <span className="text-2xl font-black text-surface-900 -mt-0.5">
                      {new Date(appointment.date + 'T12:00:00').getDate()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-surface-500 font-medium mb-0.5">Fecha y hora</p>
                    <p className="text-sm font-semibold text-surface-900 capitalize">
                      {formatDate(appointment.date)}
                    </p>
                    <p className="text-2xl font-black text-brand-600 mt-0.5">
                      {formatTime(appointment.time)} hs
                    </p>
                  </div>
                  {canModify && (
                    <button
                      onClick={startEditing}
                      className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 hover:bg-brand-200 transition-colors flex items-center justify-center"
                      title="Editar fecha/hora"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Formulario de edición */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-surface-900">Modificar turno</h3>
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      setEditDate(appointment.date ? new Date(appointment.date + 'T12:00:00') : null)
                      setEditTime(appointment.time?.substring(0, 5) || '')
                      setEditNotes(appointment.notes || '')
                    }}
                    className="text-sm text-surface-500 hover:text-surface-700"
                  >
                    Cancelar
                  </button>
                </div>

                {/* Selector de fecha y hora - igual que en BookingWidget */}
                {store?.id ? (
                  <DateTimeSelector
                    storeId={store.id}
                    selectedDate={editDate}
                    selectedTime={editTime}
                    onDateChange={setEditDate}
                    onTimeChange={setEditTime}
                    excludeAppointmentId={appointment.id}
                    allowMultiple={store?.allow_multiple_appointments}
                    maxPerSlot={store?.max_appointments_per_slot || 1}
                  />
                ) : (
                  <div className="text-center py-8 text-surface-500">
                    <p>Cargando horarios...</p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-surface-500 uppercase tracking-wide mb-2">
                    Nota (opcional)
                  </label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={2}
                    placeholder="Agregar nota..."
                    className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all resize-none text-surface-900"
                  />
                </div>

                <button
                  onClick={handleEdit}
                  disabled={loading || !editDate || !editTime}
                  className="w-full py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-brand-600/20"
                >
                  {loading ? 'Guardando...' : 'Guardar cambios'}
                </button>

                {!isPremium() && (
                  <p className="text-xs text-center text-surface-500">
                    💡 Con Premium, notificamos al cliente automáticamente
                  </p>
                )}
              </div>
            )}

            {/* Información del cliente */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wider">Cliente</h3>
              <div className="bg-surface-50 rounded-2xl p-4 border border-surface-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center">
                    <span className="text-xl font-bold text-brand-600">
                      {appointment.client_name?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-surface-900 truncate">{appointment.client_name}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {appointment.client_phone && (
                        <a 
                          href={`https://wa.me/${appointment.client_phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          {appointment.client_phone}
                        </a>
                      )}
                      {appointment.client_email && (
                        <a 
                          href={`mailto:${appointment.client_email}`}
                          className="inline-flex items-center gap-1 text-xs text-surface-500 hover:text-surface-700 font-medium"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {appointment.client_email}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Servicio */}
            {appointment.service_name && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wider">Servicio</h3>
                <div className="bg-surface-50 rounded-2xl p-4 border border-surface-100">
                  <p className="font-bold text-surface-900">{appointment.service_name}</p>
                  {appointment.service_price > 0 && (
                    <p className="text-lg font-black text-brand-600 mt-1">${appointment.service_price.toLocaleString()}</p>
                  )}
                </div>
              </div>
            )}

            {/* Notas */}
            {appointment.notes && !isEditing && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wider">Notas</h3>
                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
                  <p className="text-surface-700 text-sm">{appointment.notes}</p>
                </div>
              </div>
            )}

            {/* Enlace público */}
            {publicUrl && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wider">Compartir con cliente</h3>
                <div className="flex items-center gap-2 p-3 bg-surface-50 rounded-xl border border-surface-200">
                  <input 
                    type="text" 
                    readOnly 
                    value={publicUrl} 
                    className="flex-1 text-xs text-surface-600 bg-transparent truncate"
                  />
                  <button
                    onClick={copyPublicUrl}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      copied 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-surface-900 text-white hover:bg-black'
                    }`}
                  >
                    {copied ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
                <p className="text-xs text-surface-400">
                  El cliente puede modificar o cancelar su turno desde este enlace
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Acciones de estado */}
            {!isEditing && canModify && (
              <div className="flex flex-wrap gap-2 pt-4 border-t border-surface-100">
                {appointment.status !== 'confirmed' && (
                  <button
                    onClick={() => handleStatusChange('confirmed')}
                    disabled={loading}
                    className="flex-1 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Confirmar
                  </button>
                )}
                {appointment.status !== 'cancelled' && (
                  <button
                    onClick={() => handleStatusChange('cancelled')}
                    disabled={loading}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancelar
                  </button>
                )}
                {appointment.status !== 'pending' && (
                  <button
                    onClick={() => handleStatusChange('pending')}
                    disabled={loading}
                    className="px-4 py-2.5 bg-amber-100 text-amber-700 font-semibold rounded-xl hover:bg-amber-200 transition-colors disabled:opacity-50 text-sm"
                  >
                    Pendiente
                  </button>
                )}
              </div>
            )}

            {/* Eliminar */}
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
                className="w-full px-4 py-2.5 text-red-600 hover:bg-red-50 font-medium rounded-xl transition-colors disabled:opacity-50 text-sm border border-red-200"
              >
                Eliminar turno
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-red-900">
                  ¿Eliminar este turno permanentemente?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 text-sm"
                  >
                    {loading ? 'Eliminando...' : 'Sí, eliminar'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-white text-surface-700 font-semibold rounded-lg hover:bg-surface-50 transition-colors border border-surface-200 text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[110] animate-slideIn">
          <div className={`
            px-4 py-3 rounded-xl shadow-xl border max-w-sm
            ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200' : ''}
            ${toast.type === 'error' ? 'bg-red-50 border-red-200' : ''}
            ${toast.type === 'warning' ? 'bg-amber-50 border-amber-200' : ''}
            ${toast.type === 'info' ? 'bg-blue-50 border-blue-200' : ''}
          `}>
            <div className="flex items-center gap-2">
              <span className="text-lg">
                {toast.type === 'success' && '✅'}
                {toast.type === 'error' && '❌'}
                {toast.type === 'warning' && '⚠️'}
                {toast.type === 'info' && 'ℹ️'}
              </span>
              <div>
                <p className={`font-semibold text-sm ${
                  toast.type === 'success' ? 'text-emerald-800' : ''
                } ${toast.type === 'error' ? 'text-red-800' : ''
                } ${toast.type === 'warning' ? 'text-amber-800' : ''
                } ${toast.type === 'info' ? 'text-blue-800' : ''}`}>
                  {toast.title}
                </p>
                {toast.message && (
                  <p className="text-xs text-surface-600">{toast.message}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estilos */}
      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modalIn { animation: modalIn 0.2s ease-out; }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
      `}</style>
    </div>
  )
}
