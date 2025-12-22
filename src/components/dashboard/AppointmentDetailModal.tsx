import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  appointment: any
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
  onDelete: () => void
  store?: any
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
  const [success, setSuccess] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

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

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointment.id)

      if (error) throw error

      setSuccess('Estado actualizado correctamente')
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

  const { style, label } = getStatusBadge(appointment.status)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <h2 className="text-xl font-bold text-gray-900">Detalles del turno</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <span className={`px-4 py-2 text-sm font-semibold rounded-xl border ${style}`}>
                {label}
              </span>
            </div>

            {/* Fecha y Hora */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-white rounded-xl flex flex-col items-center justify-center border-2 border-indigo-200 shadow-sm">
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

            {/* Información del cliente */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Cliente</h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div>
                  <p className="text-sm text-gray-600">Nombre</p>
                  <p className="font-semibold text-gray-900">{appointment.client_name}</p>
                </div>
                {appointment.client_email && (
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-semibold text-gray-900">{appointment.client_email}</p>
                  </div>
                )}
                {appointment.client_phone && (
                  <div>
                    <p className="text-sm text-gray-600">Teléfono</p>
                    <p className="font-semibold text-gray-900">{appointment.client_phone}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Servicio */}
            {appointment.service_name && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Servicio</h3>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="font-semibold text-gray-900">{appointment.service_name}</p>
                </div>
              </div>
            )}

            {/* Notas */}
            {appointment.notes && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Notas</h3>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{appointment.notes}</p>
                </div>
              </div>
            )}

            {/* Mensajes de error/success */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            )}

            {/* Acciones */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
              {appointment.status !== 'confirmed' && (
                <button
                  onClick={() => handleStatusChange('confirmed')}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Actualizando...' : 'Confirmar'}
                </button>
              )}
              {appointment.status !== 'cancelled' && (
                <button
                  onClick={() => handleStatusChange('cancelled')}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Actualizando...' : 'Cancelar'}
                </button>
              )}
              {appointment.status !== 'pending' && (
                <button
                  onClick={() => handleStatusChange('pending')}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Actualizando...' : 'Marcar como pendiente'}
                </button>
              )}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
                className="px-4 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Eliminar
              </button>
            </div>

            {/* Confirmación de eliminación */}
            {showDeleteConfirm && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-4">
                <p className="text-sm font-semibold text-red-900">
                  ¿Estás seguro de que deseas eliminar este turno?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Eliminando...' : 'Sí, eliminar'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
