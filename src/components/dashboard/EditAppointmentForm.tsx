import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  appointmentId: string
}

export default function EditAppointmentForm({ appointmentId }: Props) {
  const [appointment, setAppointment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    async function loadAppointment() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          window.location.href = '/login'
          return
        }

        const { data: appointmentData, error: appointmentError } = await supabase
          .from('appointments')
          .select('*, stores!inner(*)')
          .eq('id', appointmentId)
          .eq('stores.user_id', session.user.id)
          .single()

        if (appointmentError || !appointmentData) {
          window.location.href = '/dashboard/appointments'
          return
        }

        setAppointment(appointmentData)
      } catch (error) {
        console.error('Error cargando cita:', error)
      } finally {
        setLoading(false)
      }
    }

    loadAppointment()
  }, [appointmentId])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const formData = new FormData(e.currentTarget)
      
      const startDate = formData.get('date') as string
      const startTime = formData.get('start_time') as string
      const endTime = formData.get('end_time') as string

      // Calcular duración en minutos
      const startDateTime = new Date(`${startDate}T${startTime}`)
      const endDateTime = new Date(`${startDate}T${endTime}`)
      const durationMinutes = Math.round((endDateTime.getTime() - startDateTime.getTime()) / 60000)

      const data = {
        client_name: formData.get('client_name'),
        client_email: formData.get('client_email') || '',
        client_phone: formData.get('client_phone') || '',
        date: startDate,
        time: startTime,
        duration: durationMinutes > 0 ? durationMinutes : 30,
        start_time: `${startDate}T${startTime}:00`,
        end_time: `${startDate}T${endTime}:00`,
        notes: formData.get('notes') || '',
        service_name: formData.get('service_name') || 'Cita general',
        status: formData.get('status')
      }

      const { error: updateError } = await supabase
        .from('appointments')
        .update(data)
        .eq('id', appointmentId)

      if (updateError) throw updateError

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (error: any) {
      console.error('Error:', error)
      setError(error.message || 'Error al actualizar la cita')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentId)

      if (error) throw error

      window.location.href = '/dashboard/appointments'
    } catch (error: any) {
      console.error('Error:', error)
      setError(error.message || 'Error al eliminar la cita')
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!appointment) return null

  // Usar start_time si existe, sino construir desde date/time
  const startDate = appointment.start_time 
    ? new Date(appointment.start_time)
    : new Date(`${appointment.date}T${appointment.time}`)
  const endDate = appointment.end_time 
    ? new Date(appointment.end_time)
    : new Date(startDate.getTime() + (appointment.duration || 30) * 60000)

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

  const { style: statusStyle, label: statusLabel } = getStatusBadge(appointment.status)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Editar Cita</h1>
        <p className="text-gray-500 mt-1">Modifica los datos de la cita</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border-2 border-red-200 text-red-600 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border-2 border-green-200 text-green-600 px-4 py-3 rounded-xl flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Cita actualizada correctamente
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div>
          <label htmlFor="client_name" className="block text-sm font-medium text-gray-700 mb-2">
            Nombre del cliente *
          </label>
          <input
            type="text"
            name="client_name"
            id="client_name"
            required
            defaultValue={appointment.client_name}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 focus:ring-0 transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="client_email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              name="client_email"
              id="client_email"
              defaultValue={appointment.client_email || ''}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 focus:ring-0 transition-colors"
              placeholder="email@ejemplo.com"
            />
          </div>

          <div>
            <label htmlFor="client_phone" className="block text-sm font-medium text-gray-700 mb-2">
              Teléfono
            </label>
            <input
              type="tel"
              name="client_phone"
              id="client_phone"
              defaultValue={appointment.client_phone || ''}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 focus:ring-0 transition-colors"
              placeholder="+54 9 11 1234-5678"
            />
          </div>
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
            Estado *
          </label>
          <select
            name="status"
            id="status"
            defaultValue={appointment.status}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 focus:ring-0 transition-colors"
          >
            <option value="pending">Pendiente</option>
            <option value="confirmed">Confirmada</option>
            <option value="cancelled">Cancelada</option>
          </select>
          <div className="mt-2">
            <span className={`px-3 py-1 text-xs font-medium rounded-full ${statusStyle}`}>
              Estado actual: {statusLabel}
            </span>
          </div>
        </div>

        <div>
          <label htmlFor="service_name" className="block text-sm font-medium text-gray-700 mb-2">
            Servicio
          </label>
          <input
            type="text"
            name="service_name"
            id="service_name"
            defaultValue={appointment.service_name || ''}
            placeholder="Ej: Corte de cabello, Consulta, etc."
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 focus:ring-0 transition-colors"
          />
        </div>

        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
            Fecha *
          </label>
          <input
            type="date"
            name="date"
            id="date"
            required
            defaultValue={startDate.toISOString().split('T')[0]}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 focus:ring-0 transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="start_time" className="block text-sm font-medium text-gray-700 mb-2">
              Hora de inicio *
            </label>
            <input
              type="time"
              name="start_time"
              id="start_time"
              required
              defaultValue={startDate.toTimeString().slice(0, 5)}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 focus:ring-0 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="end_time" className="block text-sm font-medium text-gray-700 mb-2">
              Hora de fin *
            </label>
            <input
              type="time"
              name="end_time"
              id="end_time"
              required
              defaultValue={endDate.toTimeString().slice(0, 5)}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 focus:ring-0 transition-colors"
            />
          </div>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
            Notas
          </label>
          <textarea
            name="notes"
            id="notes"
            rows={3}
            defaultValue={appointment.notes || ''}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 focus:ring-0 transition-colors resize-none"
            placeholder="Notas adicionales sobre la cita..."
          />
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
            className="px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 rounded-xl hover:bg-red-100 disabled:opacity-50 transition-colors"
          >
            Eliminar Cita
          </button>

          <div className="flex gap-3">
            <a
              href="/dashboard/appointments"
              className="px-6 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </a>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-200"
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </form>

      {/* Modal de confirmación de eliminación */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8 animate-fadeIn">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
              ¿Eliminar esta cita?
            </h3>
            
            <p className="text-gray-600 text-center mb-6">
              Esta acción no se puede deshacer. La cita será eliminada permanentemente.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

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
