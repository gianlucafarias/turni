import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  clientId: string
}

interface Client {
  id: string
  first_name: string
  last_name: string | null
  email: string | null
  phone: string | null
  location: string | null
  notes: string | null
  total_appointments: number
  completed_appointments: number
  cancelled_appointments: number
  last_appointment_date: string | null
  first_appointment_date: string | null
  total_spent: number
  is_active: boolean
  created_at: string
}

interface Appointment {
  id: string
  date: string
  time: string
  duration: number
  status: string
  service_name: string | null
  service_price: number | null
  notes: string | null
  created_at: string
}

interface Tag {
  id: string
  name: string
  color: string
}

export default function ClientProfile({ clientId }: Props) {
  const [client, setClient] = useState<Client | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [clientTags, setClientTags] = useState<Tag[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState('')
  const [showTagSelector, setShowTagSelector] = useState(false)

  useEffect(() => {
    loadData()
  }, [clientId])

  async function loadData() {
    try {
      // Cargar cliente
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()

      if (clientError) throw clientError
      setClient(clientData)
      setNotes(clientData.notes || '')

      // Cargar turnos del cliente
      const { data: appointmentsData } = await supabase
        .from('appointments')
        .select('*')
        .eq('client_id', clientId)
        .order('date', { ascending: false })
        .order('time', { ascending: false })

      setAppointments(appointmentsData || [])

      // Cargar etiquetas del cliente
      const { data: tagRelations } = await supabase
        .from('client_tag_relations')
        .select('tag_id, client_tags (id, name, color)')
        .eq('client_id', clientId)

      const clientTagsList = tagRelations?.map((r: any) => r.client_tags).filter(Boolean) || []
      setClientTags(clientTagsList)

      // Cargar todas las etiquetas disponibles
      const { data: allTagsData } = await supabase
        .from('client_tags')
        .select('*')
        .eq('store_id', clientData.store_id)
        .order('name')

      setAllTags(allTagsData || [])

    } catch (err: any) {
      console.error('Error:', err)
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function saveNotes() {
    if (!client) return
    setSaving(true)

    try {
      const { error } = await supabase
        .from('clients')
        .update({ notes })
        .eq('id', client.id)

      if (error) throw error
      setClient({ ...client, notes })
      setEditingNotes(false)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleTag(tagId: string) {
    const hasTag = clientTags.some(t => t.id === tagId)

    try {
      if (hasTag) {
        await supabase
          .from('client_tag_relations')
          .delete()
          .eq('client_id', clientId)
          .eq('tag_id', tagId)

        setClientTags(clientTags.filter(t => t.id !== tagId))
      } else {
        await supabase
          .from('client_tag_relations')
          .insert({ client_id: clientId, tag_id: tagId })

        const tag = allTags.find(t => t.id === tagId)
        if (tag) setClientTags([...clientTags, tag])
      }
    } catch (err: any) {
      alert(err.message)
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  function formatTime(timeStr: string) {
    return timeStr.substring(0, 5) + ' hs'
  }

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700',
      confirmed: 'bg-emerald-100 text-emerald-700',
      cancelled: 'bg-red-100 text-red-700'
    }
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      confirmed: 'Confirmado',
      cancelled: 'Cancelado'
    }
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {labels[status] || status}
      </span>
    )
  }

  function getDaysSince(dateStr: string | null) {
    if (!dateStr) return null
    const date = new Date(dateStr)
    const today = new Date()
    return Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-gray-900">Cliente no encontrado</h2>
        <a href="/dashboard/clients" className="text-indigo-600 hover:text-indigo-700 mt-2 inline-block">
          ← Volver a clientes
        </a>
      </div>
    )
  }

  const daysSinceFirst = getDaysSince(client.first_appointment_date)
  const daysSinceLast = getDaysSince(client.last_appointment_date)
  const avgDaysBetweenVisits = client.total_appointments > 1 && daysSinceFirst
    ? Math.round(daysSinceFirst / (client.total_appointments - 1))
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <a 
          href="/dashboard/clients"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {client.first_name} {client.last_name || ''}
          </h1>
          <p className="text-gray-500">Cliente desde {formatDate(client.created_at.split('T')[0])}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda - Información */}
        <div className="lg:col-span-1 space-y-6">
          {/* Datos de contacto */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Información de contacto
            </h2>
            
            <div className="space-y-3">
              {client.email && (
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a href={`mailto:${client.email}`} className="text-gray-900 hover:text-indigo-600">
                    {client.email}
                  </a>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="text-gray-900">{client.phone}</span>
                  <a
                    href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    className="p-1.5 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                    title="WhatsApp"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </a>
                </div>
              )}
              {client.location && (
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-gray-900">{client.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Etiquetas */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Etiquetas
              </span>
              <button
                onClick={() => setShowTagSelector(!showTagSelector)}
                className="text-indigo-600 text-sm hover:text-indigo-700"
              >
                {showTagSelector ? 'Cerrar' : 'Editar'}
              </button>
            </h2>

            <div className="flex flex-wrap gap-2">
              {clientTags.map(tag => (
                <span
                  key={tag.id}
                  className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1"
                  style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                >
                  {tag.name}
                  {showTagSelector && (
                    <button onClick={() => toggleTag(tag.id)} className="ml-1 hover:opacity-70">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </span>
              ))}
              {clientTags.length === 0 && !showTagSelector && (
                <span className="text-gray-400 text-sm">Sin etiquetas</span>
              )}
            </div>

            {showTagSelector && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-2">Agregar etiqueta:</p>
                <div className="flex flex-wrap gap-2">
                  {allTags.filter(t => !clientTags.some(ct => ct.id === t.id)).map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className="px-3 py-1 rounded-full text-sm font-medium border-2 border-dashed hover:border-solid transition-all"
                      style={{ borderColor: tag.color, color: tag.color }}
                    >
                      + {tag.name}
                    </button>
                  ))}
                  {allTags.filter(t => !clientTags.some(ct => ct.id === t.id)).length === 0 && (
                    <span className="text-gray-400 text-sm">No hay más etiquetas</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notas */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Notas
              </span>
              {!editingNotes && (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="text-indigo-600 text-sm hover:text-indigo-700"
                >
                  Editar
                </button>
              )}
            </h2>

            {editingNotes ? (
              <div className="space-y-3">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none"
                  placeholder="Agrega notas sobre este cliente..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveNotes}
                    disabled={saving}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button
                    onClick={() => { setNotes(client.notes || ''); setEditingNotes(false) }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-gray-600 whitespace-pre-wrap">
                {client.notes || <span className="text-gray-400">Sin notas</span>}
              </p>
            )}
          </div>
        </div>

        {/* Columna derecha - Estadísticas e historial */}
        <div className="lg:col-span-2 space-y-6">
          {/* Estadísticas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <p className="text-3xl font-bold text-gray-900">{client.total_appointments}</p>
              <p className="text-sm text-gray-500">Turnos totales</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <p className="text-3xl font-bold text-emerald-600">{client.completed_appointments}</p>
              <p className="text-sm text-gray-500">Completados</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <p className="text-3xl font-bold text-green-600">${client.total_spent.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Total gastado</p>
            </div>
            
          </div>

          {/* Insights */}
          {avgDaysBetweenVisits && (
            <div className="bg-indigo-50 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-indigo-900">
                  Este cliente viene en promedio cada {avgDaysBetweenVisits} días
                </p>
                {daysSinceLast !== null && daysSinceLast > avgDaysBetweenVisits * 1.5 && (
                  <p className="text-sm text-indigo-600">
                    ¡Ya pasaron {daysSinceLast - avgDaysBetweenVisits} días de su frecuencia habitual!
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Historial de turnos */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Historial de turnos</h2>
            </div>

            {appointments.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Sin turnos registrados</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {appointments.map(apt => (
                  <div key={apt.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 capitalize">
                          {formatDate(apt.date)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatTime(apt.time)} · {apt.service_name || 'Turno general'}
                        </p>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(apt.status)}
                        {apt.service_price && apt.service_price > 0 && (
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            ${apt.service_price.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    {apt.notes && (
                      <p className="text-sm text-gray-500 mt-2 italic">"{apt.notes}"</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}













