import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function NewAppointmentForm() {
  const [store, setStore] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadStore() {
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

        setStore(storeData)
      } catch (error) {
        console.error('Error cargando tienda:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStore()
  }, [])

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
        service_price: 0,
        status: 'pending'
      }

      const { error: insertError } = await supabase
        .from('appointments')
        .insert(data)

      if (insertError) throw insertError

      window.location.href = '/dashboard/appointments'
    } catch (error: any) {
      console.error('Error:', error)
      setError(error.message || 'Error al crear la cita')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Nueva Cita</h1>
        <p className="mt-2 text-gray-600">Agenda una nueva cita para un cliente</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
        <div>
          <label htmlFor="client_name" className="block text-sm font-medium text-gray-700">
            Nombre del cliente *
          </label>
          <input
            type="text"
            name="client_name"
            id="client_name"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="client_email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              name="client_email"
              id="client_email"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="client_phone" className="block text-sm font-medium text-gray-700">
              Teléfono
            </label>
            <input
              type="tel"
              name="client_phone"
              id="client_phone"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700">
            Fecha *
          </label>
          <input
            type="date"
            name="date"
            id="date"
            required
            min={new Date().toISOString().split('T')[0]}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="start_time" className="block text-sm font-medium text-gray-700">
              Hora de inicio *
            </label>
            <input
              type="time"
              name="start_time"
              id="start_time"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="end_time" className="block text-sm font-medium text-gray-700">
              Hora de fin *
            </label>
            <input
              type="time"
              name="end_time"
              id="end_time"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="service_name" className="block text-sm font-medium text-gray-700">
            Servicio
          </label>
          <input
            type="text"
            name="service_name"
            id="service_name"
            placeholder="Ej: Corte de cabello, Consulta, etc."
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Notas
          </label>
          <textarea
            name="notes"
            id="notes"
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="Notas adicionales sobre la cita..."
          />
        </div>

        <div className="flex justify-end space-x-4 pt-4 border-t">
          <a
            href="/dashboard/appointments"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancelar
          </a>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Crear Cita'}
          </button>
        </div>
      </form>
    </div>
  )
}

