import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSubscriptionLimits } from '../../hooks/useSubscriptionLimits'

interface AppointmentDetailModalProps {
  appointment: any
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
  onDelete: () => void
}

export default function AppointmentDetailModal({
  appointment,
  isOpen,
  onClose,
  onUpdate,
  onDelete
}: AppointmentDetailModalProps) {
  const [notifyOnConfirm, setNotifyOnConfirm] = useState(false)
  const [updating, setUpdating] = useState(false)
  const { isPremium } = useSubscriptionLimits()

  if (!isOpen || !appointment) return null

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

  async function handleStatusChange(newStatus: string) {
    setUpdating(true)
    try {
      await supabase.from('appointments').update({ status: newStatus }).eq('id', appointment.id)
      
      // Si se confirma y debe notificar (y es premium), enviar notificación
      if (newStatus === 'confirmed' && notifyOnConfirm && isPremium) {
        try {
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
      
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setUpdating(false)
    }
  }

  const { style, label } = getStatusBadge(appointment.status)

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Detalles del turno</h2>
            <p className="text-sm text-gray-500 mt-0.5">Información completa del turno</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Badge y Acción principal */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-4 py-2 text-sm font-semibold rounded-xl border ${style}`}>
                {label}
              </span>
              {appointment.modified_by_client && (
                <span className="px-4 py-2 text-sm font-semibold rounded-xl border border-blue-200 bg-blue-100 text-blue-700">
                  Modificado por cliente
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {appointment.public_token && (
                <button
                  onClick={async () => {
                    const url = `${window.location.origin}/appointment/${appointment.public_token}`
                    await navigator.clipboard.writeText(url)
                    alert('Link copiado al portapapeles')
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                  title="Copiar link para compartir con el cliente"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  
                </button>
              )}
              {appointment.status === 'pending' && (
                <button
                  onClick={() => handleStatusChange('confirmed')}
                  disabled={updating}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Confirmar turno
                </button>
              )}
            </div>
          </div>

          {/* Información de modificación si existe */}
          {appointment.modified_by_client && appointment.client_modified_at && (() => {
            const modifiedDate = new Date(appointment.client_modified_at)
            const modifiedDateStr = modifiedDate.toISOString().split('T')[0]
            const modifiedTimeStr = modifiedDate.toTimeString().substring(0, 5)
            return (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-blue-900 mb-1">Modificado por el cliente</h4>
                    <p className="text-sm text-blue-700">
                      El cliente modificó este turno el {formatDate(modifiedDateStr)} a las {modifiedTimeStr}
                    </p>
                    {appointment.notes && (
                      <div className="mt-2 pt-2 border-t border-blue-200">
                        <p className="text-xs text-blue-600 font-medium mb-1">Nota del cliente:</p>
                        <p className="text-sm text-blue-800 italic">{appointment.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Fecha y Hora destacadas */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-white rounded-2xl flex flex-col items-center justify-center border-2 border-indigo-200 shadow-sm">
                <span className="text-xs text-indigo-600 font-semibold uppercase">
                  {formatDate(appointment.date).split(' ')[0].substring(0, 3)}
                </span>
                <span className="text-2xl font-bold text-gray-900 -mt-1">
                  {new Date(appointment.date + 'T12:00:00').getDate()}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm text-indigo-600 font-medium mb-1">Fecha y hora</p>
                <p className="text-lg font-bold text-gray-900 capitalize">
                  {formatDate(appointment.date)}
                </p>
                <p className="text-2xl font-bold text-indigo-600 mt-1">
                  {formatTime(appointment.time)} hs
                </p>
              </div>
            </div>
          </div>

          {/* Información del cliente */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Cliente
            </h3>
            <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Nombre completo</p>
                <p className="text-lg font-semibold text-gray-900">{appointment.client_name}</p>
              </div>
              
              {appointment.client_email && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Email</p>
                  <a 
                    href={`mailto:${appointment.client_email}`}
                    className="text-indigo-600 hover:underline font-medium"
                  >
                    {appointment.client_email}
                  </a>
                </div>
              )}
              
              {appointment.client_phone && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Teléfono</p>
                  <a 
                    href={`https://wa.me/${appointment.client_phone.replace(/\D/g, '')}`}
                    target="_blank"
                    className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 font-medium"
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
                  <p className="text-sm text-gray-500 mb-1">Localidad</p>
                  <p className="text-gray-900 font-medium">{appointment.client_location}</p>
                </div>
              )}
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
            <div className="bg-gray-50 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Servicio</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {appointment.service_name || 'Turno general'}
                  </p>
                </div>
                {appointment.service_price > 0 && (
                  <div className="text-right">
                    <p className="text-sm text-gray-500 mb-1">Precio</p>
                    <p className="text-2xl font-bold text-indigo-600">
                      ${appointment.service_price.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
              {appointment.duration && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Duración</p>
                  <p className="text-gray-900 font-medium">{appointment.duration} minutos</p>
                </div>
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

          {/* Acciones rápidas */}
          <div className="border-t border-gray-200 pt-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Acciones rápidas</h3>
            
            {/* Toggle de notificación para turnos pendientes */}
            {appointment.status === 'pending' && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      Notificar al usuario al confirmar
                      {isPremium ? (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded">
                          PRO
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gray-400 text-white rounded">
                          PRO
                        </span>
                      )}
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Se enviará una notificación automática al cliente
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (isPremium) {
                        setNotifyOnConfirm(!notifyOnConfirm)
                      }
                    }}
                    disabled={!isPremium}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      !isPremium ? 'bg-gray-200 cursor-not-allowed opacity-50' : 
                      notifyOnConfirm ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${
                        notifyOnConfirm ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className="grid grid-cols-2 gap-3">
              {appointment.status === 'confirmed' && (
                <button
                  onClick={() => handleStatusChange('pending')}
                  disabled={updating}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-100 text-amber-700 rounded-xl font-semibold hover:bg-amber-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Marcar como pendiente
                </button>
              )}
              
              {appointment.status !== 'cancelled' && (
                <button
                  onClick={() => handleStatusChange('cancelled')}
                  disabled={updating}
                  className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancelar turno
                </button>
              )}
              
              {appointment.status === 'cancelled' && (
                <button
                  onClick={() => handleStatusChange('pending')}
                  disabled={updating}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-100 text-indigo-700 rounded-xl font-semibold hover:bg-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reactivar turno
                </button>
              )}
              
              <a
                href={`/dashboard/appointments/${appointment.id}`}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editar detalles
              </a>
            </div>

            {/* Botón eliminar */}
            <button
              onClick={() => {
                if (confirm('¿Estás seguro de eliminar este turno? Esta acción no se puede deshacer.')) {
                  onDelete()
                  onClose()
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-xl font-semibold hover:bg-red-100 transition-colors border border-red-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Eliminar turno
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
      `}</style>
    </div>
  )
}

