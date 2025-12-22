import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useSubscriptionLimits } from '../../hooks/useSubscriptionLimits'
import ClientAutocomplete from './ClientAutocomplete'

interface Client {
  id: string
  first_name: string
  last_name: string | null
  email: string | null
  phone: string | null
}

interface NewAppointmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialDate?: string
  initialTime?: string
}

export default function NewAppointmentModal({
  isOpen,
  onClose,
  onSuccess,
  initialDate,
  initialTime
}: NewAppointmentModalProps) {
  const [store, setStore] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const { isPremium } = useSubscriptionLimits()

  useEffect(() => {
    if (isOpen) {
      loadStore()
    }
  }, [isOpen])

  async function loadStore() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) return

      const { data: storeData } = await supabase
        .from('stores')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      setStore(storeData)
    } catch (error) {
      console.error('Error cargando tienda:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClientSelect = (client: Client) => {
    setClientName(`${client.first_name}${client.last_name ? ' ' + client.last_name : ''}`)
    setClientEmail(client.email || '')
    setClientPhone(client.phone || '')
  }

  const handleClose = () => {
    // Resetear formulario al cerrar
    setClientName('')
    setClientEmail('')
    setClientPhone('')
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

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
        store_id: store.id,
        client_name: clientName || formData.get('client_name'),
        client_email: clientEmail || formData.get('client_email') || '',
        client_phone: clientPhone || formData.get('client_phone') || '',
        date: startDate,
        time: startTime,
        duration: durationMinutes > 0 ? durationMinutes : 30,
        start_time: `${startDate}T${startTime}:00`,
        end_time: `${startDate}T${endTime}:00`,
        notes: formData.get('notes') || '',
        service_name: formData.get('service_name') || 'Cita general',
        service_price: 0,
        status: 'pending'
      }

      const { data: insertedAppointment, error: insertError } = await supabase
        .from('appointments')
        .insert(data)
        .select()
        .single()

      if (insertError) throw insertError

      // Sincronizar con Google Calendar si está conectado
      if (insertedAppointment) {
        try {
          const response = await fetch('/api/google-calendar/create-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              appointmentId: insertedAppointment.id,
              storeId: insertedAppointment.store_id,
            }),
          })
          if (!response.ok) {
            console.error('Error sincronizando con Google Calendar')
          }
        } catch (error) {
          console.error('Error sincronizando con Google Calendar:', error)
          // No fallar la creación del turno si falla la sincronización
        }
      }

      onSuccess()
      handleClose()
      
      // Reset form
      const form = e.currentTarget
      form.reset()
      setClientName('')
      setClientEmail('')
      setClientPhone('')
    } catch (error: any) {
      console.error('Error:', error)
      setError(error.message || 'Error al crear la cita')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Nueva Cita</h2>
            <p className="text-sm text-gray-500 mt-0.5">Agenda una nueva cita para un cliente</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-600 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="client_name" className="block text-sm font-medium text-gray-700 mb-2">
              Nombre del cliente *
            </label>
            {store && isPremium ? (
              <>
                <ClientAutocomplete
                  storeId={store.id}
                  value={clientName}
                  onChange={setClientName}
                  onClientSelect={handleClientSelect}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 focus:ring-0 transition-colors"
                  placeholder="Nombre completo"
                  required
                />
                <input type="hidden" name="client_name" value={clientName} />
              </>
            ) : (
              <input
                type="text"
                name="client_name"
                id="client_name"
                required
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 focus:ring-0 transition-colors"
                placeholder="Nombre completo"
              />
            )}
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
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
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
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 focus:ring-0 transition-colors"
                placeholder="+54 9 11 1234-5678"
              />
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
              defaultValue={initialDate}
              min={new Date().toISOString().split('T')[0]}
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
                defaultValue={initialTime}
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
                defaultValue={initialTime ? (() => {
                  const [hours, minutes] = initialTime.split(':').map(Number)
                  const endHours = (hours + 1) % 24
                  return `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
                })() : undefined}
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
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 focus:ring-0 transition-colors resize-none"
              placeholder="Notas adicionales sobre la cita..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="px-6 py-3 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-200"
            >
              {saving ? 'Guardando...' : 'Crear Cita'}
            </button>
          </div>
        </form>

        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
          .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        `}</style>
      </div>
    </div>
  )
}





