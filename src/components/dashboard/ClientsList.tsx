import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSubscriptionLimits } from '../../hooks/useSubscriptionLimits'
import { PremiumFeatureBlock } from './UpgradePrompt'
import * as XLSX from 'xlsx'

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
  tags?: Tag[]
  services_used?: string[] // IDs de servicios usados
}

interface Tag {
  id: string
  name: string
  color: string
}

interface Service {
  id: string
  name: string
}

type FilterType = 'all' | 'recent' | 'inactive' | 'vip' | 'new'
type SortType = 'recent' | 'name' | 'appointments' | 'spent'

export default function ClientsList() {
  const [storeId, setStoreId] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Límites de suscripción
  const { canAccessClients, loading: limitsLoading } = useSubscriptionLimits()

  // Filtros y búsqueda
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortType>('recent')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Selección y acciones masivas
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set())
  const [showMassActions, setShowMassActions] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Gestión de etiquetas
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#6366f1')
  const [editingTag, setEditingTag] = useState<Tag | null>(null)

  // Modales para importar/exportar y agregar cliente
  const [showImportModal, setShowImportModal] = useState(false)
  const [showAddClientModal, setShowAddClientModal] = useState(false)
  const [showEditClientModal, setShowEditClientModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [importing, setImporting] = useState(false)
  
  // Formulario para agregar cliente
  const [newClient, setNewClient] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    location: '',
    notes: ''
  })

  // Formulario para editar cliente
  const [editClientForm, setEditClientForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    location: '',
    notes: ''
  })

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
        .select('id, store_type')
        .eq('user_id', session.user.id)
        .single()

      if (!storeData || storeData.store_type !== 'appointments') {
        window.location.href = '/dashboard'
        return
      }

      setStoreId(storeData.id)

      // Cargar clientes con sus etiquetas y appointments (para servicios)
      let { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select(`
          *,
          client_tag_relations (
            tag_id,
            client_tags (id, name, color)
          ),
          appointments (
            service_id
          )
        `)
        .eq('store_id', storeData.id)
        .order('last_appointment_date', { ascending: false, nullsFirst: false })

      // Generar tokens si no existen
      const clientsWithoutTokens = (clientsData || []).filter(c => !c.edit_token || !c.booking_token)
      if (clientsWithoutTokens.length > 0) {
        for (const client of clientsWithoutTokens) {
          const updates: any = {}
          if (!client.edit_token) {
            updates.edit_token = generateToken()
          }
          if (!client.booking_token) {
            updates.booking_token = generateToken()
          }
          await supabase.from('clients').update(updates).eq('id', client.id)
        }
        // Recargar datos después de generar tokens
        const { data: refreshedData } = await supabase
          .from('clients')
          .select(`
            *,
            client_tag_relations (
              tag_id,
              client_tags (id, name, color)
            ),
            appointments (
              service_id
            )
          `)
          .eq('store_id', storeData.id)
          .order('last_appointment_date', { ascending: false, nullsFirst: false })
        
        if (refreshedData) {
          clientsData = refreshedData
        }
      }

      if (clientsError) throw clientsError

      // Procesar clientes con etiquetas y servicios usados
      const processedClients = (clientsData || []).map(client => {
        // Obtener IDs de servicios únicos usados por el cliente
        const serviceIds = [...new Set(
          (client.appointments || [])
            .map((apt: any) => apt.service_id)
            .filter(Boolean)
        )]
        
        return {
          ...client,
          tags: client.client_tag_relations?.map((rel: any) => rel.client_tags).filter(Boolean) || [],
          services_used: serviceIds
        }
      })

      setClients(processedClients)

      // Cargar etiquetas
      const { data: tagsData } = await supabase
        .from('client_tags')
        .select('*')
        .eq('store_id', storeData.id)
        .order('name')

      setTags(tagsData || [])

      // Cargar servicios para filtro
      const { data: servicesData } = await supabase
        .from('services')
        .select('id, name')
        .eq('store_id', storeData.id)
        .order('name')

      setServices(servicesData || [])

    } catch (err: any) {
      console.error('Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Filtrar y ordenar clientes
  const filteredClients = clients
    .filter(client => {
      // Búsqueda
      if (search) {
        const searchLower = search.toLowerCase()
        const fullName = `${client.first_name} ${client.last_name || ''}`.toLowerCase()
        const matchesSearch = 
          fullName.includes(searchLower) ||
          client.email?.toLowerCase().includes(searchLower) ||
          client.phone?.includes(search)
        if (!matchesSearch) return false
      }

      // Filtro por tipo
      const today = new Date()
      const thirtyDaysAgo = new Date(today.setDate(today.getDate() - 30)).toISOString().split('T')[0]
      const ninetyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().split('T')[0]

      switch (filterType) {
        case 'recent':
          if (!client.last_appointment_date || client.last_appointment_date < thirtyDaysAgo) return false
          break
        case 'inactive':
          if (client.last_appointment_date && client.last_appointment_date > ninetyDaysAgo) return false
          break
        case 'vip':
          if (client.total_appointments < 5) return false
          break
        case 'new':
          if (client.total_appointments > 1) return false
          break
      }

      // Filtro por etiqueta
      if (selectedTag) {
        if (!client.tags?.some(t => t.id === selectedTag)) return false
      }

      // Filtro por servicio
      if (selectedService) {
        if (!client.services_used?.includes(selectedService)) return false
      }

      // Filtro por fecha
      if (dateFrom && client.last_appointment_date && client.last_appointment_date < dateFrom) return false
      if (dateTo && client.last_appointment_date && client.last_appointment_date > dateTo) return false

      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
        case 'appointments':
          return b.total_appointments - a.total_appointments
        case 'spent':
          return b.total_spent - a.total_spent
        case 'recent':
        default:
          if (!a.last_appointment_date) return 1
          if (!b.last_appointment_date) return -1
          return b.last_appointment_date.localeCompare(a.last_appointment_date)
      }
    })

  // Toggle selección
  function toggleSelect(clientId: string) {
    const newSelected = new Set(selectedClients)
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId)
    } else {
      newSelected.add(clientId)
    }
    setSelectedClients(newSelected)
  }

  function selectAll() {
    if (selectedClients.size === filteredClients.length) {
      setSelectedClients(new Set())
    } else {
      setSelectedClients(new Set(filteredClients.map(c => c.id)))
    }
  }

  // Gestión de etiquetas
  async function createTag() {
    if (!newTagName.trim() || !storeId) return

    try {
      const { data, error } = await supabase
        .from('client_tags')
        .insert({
          store_id: storeId,
          name: newTagName.trim(),
          color: newTagColor
        })
        .select()
        .single()

      if (error) throw error

      setTags([...tags, data])
      setNewTagName('')
      setNewTagColor('#6366f1')
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function deleteTag(tagId: string) {
    if (!confirm('¿Eliminar esta etiqueta?')) return

    try {
      await supabase.from('client_tags').delete().eq('id', tagId)
      setTags(tags.filter(t => t.id !== tagId))
      if (selectedTag === tagId) setSelectedTag(null)
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function assignTagToSelected(tagId: string) {
    if (selectedClients.size === 0) return

    try {
      // Insertar cada relación individualmente para evitar problemas con upsert
      const clientIds = Array.from(selectedClients)
      let assigned = 0
      
      for (const clientId of clientIds) {
        // Verificar si ya existe
        const { data: existing } = await supabase
          .from('client_tag_relations')
          .select('id')
          .eq('client_id', clientId)
          .eq('tag_id', tagId)
          .maybeSingle()
        
        if (!existing) {
          const { error } = await supabase
            .from('client_tag_relations')
            .insert({ client_id: clientId, tag_id: tagId })
          
          if (error) {
            console.error('Error asignando etiqueta:', error)
          } else {
            assigned++
          }
        }
      }

      await loadData()
      setShowTagModal(false)
      
      const tagName = tags.find(t => t.id === tagId)?.name || 'etiqueta'
      if (assigned > 0) {
        alert(`✅ Etiqueta "${tagName}" asignada a ${assigned} cliente${assigned !== 1 ? 's' : ''}`)
      } else {
        alert(`Los clientes seleccionados ya tienen la etiqueta "${tagName}"`)
      }
      
      setSelectedClients(new Set()) // Limpiar selección después de asignar
    } catch (err: any) {
      console.error('Error:', err)
      alert('Error al asignar etiqueta: ' + err.message)
    }
  }

  async function removeTagFromSelected(tagId: string) {
    if (selectedClients.size === 0) return

    try {
      await supabase
        .from('client_tag_relations')
        .delete()
        .in('client_id', Array.from(selectedClients))
        .eq('tag_id', tagId)

      await loadData()
    } catch (err: any) {
      alert(err.message)
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return 'Nunca'
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function getDaysSinceLastVisit(dateStr: string | null) {
    if (!dateStr) return null
    const last = new Date(dateStr)
    const today = new Date()
    const diff = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  const TAG_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e'
  ]

  // Exportar clientes a Excel
  function handleExportToExcel() {
    if (!storeId || filteredClients.length === 0) {
      alert('No hay clientes para exportar')
      return
    }

    // Preparar datos para Excel
    const excelData = filteredClients.map(client => ({
      'Nombre': client.first_name,
      'Apellido': client.last_name || '',
      'Email': client.email || '',
      'Teléfono': client.phone || '',
      'Localidad': client.location || '',
      'Notas': client.notes || '',
      'Total Turnos': client.total_appointments,
      'Turnos Completados': client.completed_appointments,
      'Turnos Cancelados': client.cancelled_appointments,
      'Primera Visita': client.first_appointment_date || '',
      'Última Visita': client.last_appointment_date || '',
      'Total Gastado': client.total_spent,
      'Etiquetas': client.tags?.map(t => t.name).join(', ') || '',
      'Activo': client.is_active ? 'Sí' : 'No'
    }))

    // Crear workbook y worksheet
    const ws = XLSX.utils.json_to_sheet(excelData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes')

    // Ajustar ancho de columnas
    const colWidths = [
      { wch: 15 }, // Nombre
      { wch: 15 }, // Apellido
      { wch: 25 }, // Email
      { wch: 15 }, // Teléfono
      { wch: 20 }, // Localidad
      { wch: 30 }, // Notas
      { wch: 12 }, // Total Turnos
      { wch: 18 }, // Turnos Completados
      { wch: 18 }, // Turnos Cancelados
      { wch: 15 }, // Primera Visita
      { wch: 15 }, // Última Visita
      { wch: 15 }, // Total Gastado
      { wch: 25 }, // Etiquetas
      { wch: 10 }  // Activo
    ]
    ws['!cols'] = colWidths

    // Generar nombre de archivo con fecha
    const date = new Date().toISOString().split('T')[0]
    const fileName = `clientes_${date}.xlsx`

    // Descargar archivo
    XLSX.writeFile(wb, fileName)
  }

  // Importar clientes desde Excel
  async function handleImportFromExcel(file: File) {
    if (!storeId) return

    setImporting(true)
    try {
      const reader = new FileReader()
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          const jsonData = XLSX.utils.sheet_to_json(firstSheet) as any[]

          if (jsonData.length === 0) {
            alert('El archivo Excel está vacío')
            setImporting(false)
            return
          }

          // Mapear columnas (flexible con diferentes nombres)
          const clientsToImport = jsonData.map(row => {
            if (!row) return null
            
            const firstName = row['Nombre'] || row['nombre'] || row['Nombre'] || row['first_name'] || ''
            const lastName = row['Apellido'] || row['apellido'] || row['Apellido'] || row['last_name'] || ''
            const email = row['Email'] || row['email'] || row['Email'] || ''
            const phone = row['Teléfono'] || row['telefono'] || row['Teléfono'] || row['phone'] || ''
            const location = row['Localidad'] || row['localidad'] || row['Localidad'] || row['location'] || ''
            const notes = row['Notas'] || row['notas'] || row['Notas'] || row['notes'] || ''

            if (!firstName.trim()) {
              return null
            }

            return {
              store_id: storeId,
              first_name: firstName.trim(),
              last_name: lastName?.trim() || null,
              email: email?.trim() || null,
              phone: phone?.trim() || null,
              location: location?.trim() || null,
              notes: notes?.trim() || null,
              is_active: true
            }
          }).filter((client): client is NonNullable<typeof client> => client !== null)

          if (clientsToImport.length === 0) {
            alert('No se encontraron datos válidos en el archivo. Asegúrate de que la primera fila contenga los nombres de las columnas.')
            setImporting(false)
            return
          }

          // Insertar clientes (usar upsert para evitar duplicados)
          let imported = 0
          let updated = 0
          let errors = 0

          for (const clientData of clientsToImport) {
            if (!clientData) continue
            
            try {
              // Buscar cliente existente por email o teléfono
              let existingClient = null
              
              if (clientData.email) {
                const { data } = await supabase
                  .from('clients')
                  .select('id')
                  .eq('store_id', storeId)
                  .eq('email', clientData.email)
                  .maybeSingle()
                existingClient = data
              }
              
              if (!existingClient && clientData.phone) {
                const { data } = await supabase
                  .from('clients')
                  .select('id')
                  .eq('store_id', storeId)
                  .eq('phone', clientData.phone)
                  .maybeSingle()
                existingClient = data
              }

              if (existingClient) {
                // Actualizar cliente existente
                const { error } = await supabase
                  .from('clients')
                  .update({
                    first_name: clientData.first_name,
                    last_name: clientData.last_name,
                    email: clientData.email || undefined,
                    phone: clientData.phone || undefined,
                    location: clientData.location || undefined,
                    notes: clientData.notes || undefined,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', existingClient.id)
                
                if (error) throw error
                updated++
              } else {
                // Crear nuevo cliente
                const { error } = await supabase
                  .from('clients')
                  .insert(clientData)
                
                if (error) throw error
                imported++
              }
            } catch (err: any) {
              console.error('Error importando cliente:', err)
              errors++
            }
          }

          await loadData()
          setShowImportModal(false)
          
          alert(`✅ Importación completada:\n- ${imported} cliente(s) nuevo(s)\n- ${updated} cliente(s) actualizado(s)${errors > 0 ? `\n- ${errors} error(es)` : ''}`)
        } catch (err: any) {
          console.error('Error procesando archivo:', err)
          alert('Error al procesar el archivo: ' + err.message)
        } finally {
          setImporting(false)
        }
      }

      reader.readAsArrayBuffer(file)
    } catch (err: any) {
      console.error('Error:', err)
      alert('Error al importar: ' + err.message)
      setImporting(false)
    }
  }

  // Generar token único
  function generateToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let token = ''
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return token
  }

  // Copiar link del cliente
  function copyClientLink(token: string | null, type: 'edit' | 'booking') {
    if (!token) {
      alert('El cliente no tiene token. Por favor, recarga la página.')
      return
    }

    const baseUrl = window.location.origin
    const path = type === 'edit' ? `/client/edit/${token}` : `/client/booking/${token}`
    const fullUrl = `${baseUrl}${path}`

    navigator.clipboard.writeText(fullUrl).then(() => {
      const message = type === 'edit' 
        ? '✅ Link para editar perfil copiado al portapapeles'
        : '✅ Link para reservar turno copiado al portapapeles'
      alert(message)
    }).catch(() => {
      // Fallback para navegadores que no soportan clipboard API
      const textArea = document.createElement('textarea')
      textArea.value = fullUrl
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      const message = type === 'edit' 
        ? '✅ Link para editar perfil copiado al portapapeles'
        : '✅ Link para reservar turno copiado al portapapeles'
      alert(message)
    })
  }

  // Abrir modal de edición
  function openEditModal(client: Client) {
    setEditingClient(client)
    setEditClientForm({
      first_name: client.first_name,
      last_name: client.last_name || '',
      email: client.email || '',
      phone: client.phone || '',
      location: client.location || '',
      notes: client.notes || ''
    })
    setShowEditClientModal(true)
  }

  // Editar cliente
  async function handleEditClient() {
    if (!storeId || !editingClient || !editClientForm.first_name.trim()) {
      alert('El nombre es obligatorio')
      return
    }

    try {
      const { error } = await supabase
        .from('clients')
        .update({
          first_name: editClientForm.first_name.trim(),
          last_name: editClientForm.last_name.trim() || null,
          email: editClientForm.email.trim() || null,
          phone: editClientForm.phone.trim() || null,
          location: editClientForm.location.trim() || null,
          notes: editClientForm.notes.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingClient.id)

      if (error) {
        if (error.code === '23505') {
          alert('Ya existe otro cliente con ese email o teléfono')
        } else {
          throw error
        }
        return
      }

      setShowEditClientModal(false)
      setEditingClient(null)
      await loadData()
      alert('✅ Cliente actualizado correctamente')
    } catch (err: any) {
      console.error('Error:', err)
      alert('Error al actualizar cliente: ' + err.message)
    }
  }

  // Agregar cliente manualmente
  async function handleAddClient() {
    if (!storeId || !newClient.first_name.trim()) {
      alert('El nombre es obligatorio')
      return
    }

    try {
      const { error } = await supabase
        .from('clients')
        .insert({
          store_id: storeId,
          first_name: newClient.first_name.trim(),
          last_name: newClient.last_name.trim() || null,
          email: newClient.email.trim() || null,
          phone: newClient.phone.trim() || null,
          location: newClient.location.trim() || null,
          notes: newClient.notes.trim() || null,
          is_active: true
        })

      if (error) {
        if (error.code === '23505') {
          alert('Ya existe un cliente con ese email o teléfono')
        } else {
          throw error
        }
        return
      }

      // Limpiar formulario
      setNewClient({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        location: '',
        notes: ''
      })
      
      setShowAddClientModal(false)
      await loadData()
      alert('✅ Cliente agregado correctamente')
    } catch (err: any) {
      console.error('Error:', err)
      alert('Error al agregar cliente: ' + err.message)
    }
  }

  if (loading || limitsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  // Si no tiene acceso premium, mostrar preview con overlay
  const isPreviewMode = !canAccessClients

  return (
    <div className="space-y-6 relative">
      {/* Overlay premium para usuarios free */}
      {isPreviewMode && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-white/98 via-white/95 to-white/98 backdrop-blur-[2px] pointer-events-auto" />
          <div className="relative z-10 max-w-md mx-auto p-8 text-center bg-white rounded-3xl shadow-2xl border-2 border-indigo-100 pointer-events-auto">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full mb-6">
              <span className="text-4xl">👥</span>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Función Premium
            </h2>
            <p className="text-gray-600 mb-6">
              La gestión de clientes es una función Premium. Actualizá tu plan para acceder a gestión completa de clientes y mucho más.
            </p>

            <a
              href="/dashboard/subscription"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Ver planes Premium
            </a>
          </div>
        </div>
      )}

      {/* Contenido de la página (siempre visible, pero bloqueado si no es premium) */}
      <div className={isPreviewMode ? 'pointer-events-none opacity-60' : ''}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Clientes</h1>
          <p className="text-gray-500 mt-1">
            {clients.length} cliente{clients.length !== 1 ? 's' : ''} registrado{clients.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowAddClientModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Agregar Cliente
          </button>
          <button
            onClick={handleExportToExcel}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar Excel
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Importar Excel
          </button>
        </div>
      </div>

      {/* Barra de búsqueda y filtros */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
        {/* Búsqueda y botón de filtros (mobile) */}
        <div className="flex gap-2 sm:gap-4">
          {/* Búsqueda */}
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por nombre, email o teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Botón de filtros (solo mobile) */}
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="sm:hidden flex items-center justify-center w-12 h-11 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors relative"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {(filterType !== 'all' || selectedTag || selectedService || dateFrom || dateTo) && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-600 rounded-full border-2 border-white"></span>
            )}
          </button>
        </div>

        {/* Filtros principales (desktop siempre visible, mobile solo si está abierto) */}
        <div className={`${filtersOpen ? 'block' : 'hidden'} sm:block space-y-4`}>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Filtro rápido */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FilterType)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white"
            >
              <option value="all">Todos los clientes</option>
              <option value="recent">Últimos 30 días</option>
              <option value="inactive">Inactivos (+90 días)</option>
              <option value="vip">VIP (5+ turnos)</option>
              <option value="new">Nuevos (1 turno)</option>
            </select>

            {/* Ordenar */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortType)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white"
            >
              <option value="recent">Más recientes</option>
              <option value="name">Por nombre</option>
              <option value="appointments">Por turnos</option>
              <option value="spent">Por facturación</option>
            </select>

            {/* Filtrar por servicio */}
            {services.length > 0 && (
              <select
                value={selectedService || ''}
                onChange={(e) => setSelectedService(e.target.value || null)}
                className="px-4 py-2.5 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white"
              >
                <option value="">Todos los servicios</option>
                {services.map(service => (
                  <option key={service.id} value={service.id}>{service.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Filtros adicionales */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
            {/* Etiquetas */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-sm text-gray-500">Etiqueta:</span>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    !selectedTag ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Todas
                </button>
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => setSelectedTag(selectedTag === tag.id ? null : tag.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                      selectedTag === tag.id 
                        ? 'ring-2 ring-offset-1' 
                        : 'hover:opacity-80'
                    }`}
                    style={{ 
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                      ...(selectedTag === tag.id ? { ringColor: tag.color } : {})
                    }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </button>
                ))}
                <button
                  onClick={() => setShowTagModal(true)}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  + Nueva
                </button>
              </div>
            </div>

            {/* Rango de fechas */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:ml-auto">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-500 whitespace-nowrap">Desde:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="flex-1 sm:flex-none min-w-0 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-indigo-500 max-w-full"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-500 whitespace-nowrap">Hasta:</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="flex-1 sm:flex-none min-w-0 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-indigo-500 max-w-full"
                />
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => { setDateFrom(''); setDateTo('') }}
                    className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Acciones masivas */}
      {selectedClients.size > 0 && (
        <div className="bg-indigo-50 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-indigo-900">
              {selectedClients.size} cliente{selectedClients.size !== 1 ? 's' : ''} seleccionado{selectedClients.size !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setSelectedClients(new Set())}
              className="text-indigo-600 text-sm hover:text-indigo-800"
            >
              Deseleccionar
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTagModal(true)}
              className="px-4 py-2 bg-white text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors border border-gray-200 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Etiquetar
            </button>
            <button
              onClick={() => setShowReminderModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Enviar recordatorio
            </button>
          </div>
        </div>
      )}

      {/* Lista de clientes */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {filteredClients.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No hay clientes</h3>
            <p className="text-gray-500">
              {search || filterType !== 'all' || selectedTag 
                ? 'No se encontraron clientes con estos filtros'
                : 'Los clientes se crearán automáticamente cuando reserven turnos'
              }
            </p>
          </div>
        ) : (
          <>
            {/* Header de tabla */}
            <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <div className="col-span-1">
                <input
                  type="checkbox"
                  checked={selectedClients.size === filteredClients.length && filteredClients.length > 0}
                  onChange={selectAll}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
              <div className="col-span-3">Cliente</div>
              <div className="col-span-2">Contacto</div>
              <div className="col-span-2">Última visita</div>
              <div className="col-span-2">Turnos</div>
              <div className="col-span-2 text-right">Acciones</div>
            </div>

            {/* Filas */}
            <div className="divide-y divide-gray-100">
              {filteredClients.map(client => {
                const daysSince = getDaysSinceLastVisit(client.last_appointment_date)
                const isInactive = daysSince !== null && daysSince > 90
                const isRecent = daysSince !== null && daysSince <= 7

                return (
                  <div
                    key={client.id}
                    className={`grid grid-cols-1 sm:grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 transition-colors ${
                      selectedClients.has(client.id) ? 'bg-indigo-50' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="hidden sm:flex col-span-1 items-center">
                      <input
                        type="checkbox"
                        checked={selectedClients.has(client.id)}
                        onChange={() => toggleSelect(client.id)}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Cliente */}
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                        {client.first_name.charAt(0)}{client.last_name?.charAt(0) || ''}
                      </div>
                      <div className="min-w-0">
                        <a 
                          href={`/dashboard/clients/${client.id}`}
                          className="font-semibold text-gray-900 hover:text-indigo-600 truncate block"
                        >
                          {client.first_name} {client.last_name || ''}
                        </a>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {client.tags?.map(tag => (
                            <span
                              key={tag.id}
                              className="px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Contacto */}
                    <div className="col-span-2 flex flex-col justify-center text-sm">
                      {client.email && (
                        <span className="text-gray-600 truncate">{client.email}</span>
                      )}
                      {client.phone && (
                        <span className="text-gray-500">{client.phone}</span>
                      )}
                    </div>

                    {/* Última visita */}
                    <div className="col-span-2 flex flex-col justify-center text-sm">
                      {client.last_appointment_date ? (
                        <>
                          <span className="text-gray-900 font-medium">
                            {formatDate(client.last_appointment_date)}
                          </span>
                          {daysSince !== null && (
                            <span className={`text-xs mt-0.5 ${
                              isRecent ? 'text-green-600' : 
                              isInactive ? 'text-red-600' : 
                              'text-gray-500'
                            }`}>
                              {daysSince === 0 ? 'Hoy' : 
                               daysSince === 1 ? 'Ayer' : 
                               `${daysSince} días`}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-400 italic">Sin visitas</span>
                      )}
                    </div>

                    {/* Estadísticas */}
                    <div className="col-span-2 flex items-center gap-4">
                      <div className="text-center">
                        <span className="text-lg font-bold text-gray-900">{client.total_appointments}</span>
                        <span className="block text-xs text-gray-400">turnos</span>
                      </div>
                      {client.total_spent > 0 && (
                        <div className="text-center">
                          <span className="text-sm font-semibold text-green-600">${client.total_spent.toLocaleString()}</span>
                          <span className="block text-xs text-gray-400">total</span>
                        </div>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <a
                        href={`/dashboard/clients/${client.id}`}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Ver perfil"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </a>
                      <button
                        onClick={() => openEditModal(client)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar cliente"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {(client as any).booking_token && (
                        <button
                          onClick={() => copyClientLink((client as any).booking_token, 'booking')}
                          className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Copiar link para reservar turno"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </button>
                      )}
                      {client.phone && (
                        <a
                          href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="WhatsApp"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal de etiquetas */}
      {showTagModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowTagModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Gestionar etiquetas</h3>
            
            {/* Crear nueva etiqueta */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Nueva etiqueta</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Nombre de etiqueta"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <div className="relative">
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-gray-200"
                  />
                </div>
                <button
                  onClick={createTag}
                  disabled={!newTagName.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Crear
                </button>
              </div>
            </div>

            {/* Lista de etiquetas existentes */}
            {tags.length > 0 && (
              <div className="space-y-2 mb-6">
                <p className="text-sm font-medium text-gray-700">
                  {selectedClients.size > 0 ? 'Asignar etiqueta a seleccionados:' : 'Etiquetas existentes:'}
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {tags.map(tag => (
                    <div key={tag.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />
                        <span className="font-medium text-gray-900">{tag.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {selectedClients.size > 0 && (
                          <button
                            onClick={() => assignTagToSelected(tag.id)}
                            className="px-3 py-1 text-xs bg-indigo-100 text-indigo-700 rounded-full hover:bg-indigo-200"
                          >
                            Asignar
                          </button>
                        )}
                        <button
                          onClick={() => deleteTag(tag.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setShowTagModal(false)}
              className="w-full py-2 text-gray-600 hover:text-gray-900"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal de recordatorio */}
      {showReminderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowReminderModal(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Enviar recordatorio</h3>
            <p className="text-gray-500 mb-6">
              Se enviará un recordatorio a {selectedClients.size} cliente{selectedClients.size !== 1 ? 's' : ''}
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mensaje</label>
                <textarea
                  rows={4}
                  defaultValue={`¡Hola! 👋\n\nTe extrañamos en ${storeId ? 'nuestro negocio' : ''}. ¿Te gustaría agendar un nuevo turno?\n\nReservá desde nuestra página o contactanos por WhatsApp.`}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="channel" value="whatsapp" defaultChecked className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm text-gray-700">WhatsApp</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer opacity-50">
                  <input type="radio" name="channel" value="email" disabled className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm text-gray-400">Email (próximamente)</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowReminderModal(false)}
                className="flex-1 py-3 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  alert('Función de envío masivo disponible próximamente. Por ahora puedes contactar individualmente desde WhatsApp.')
                  setShowReminderModal(false)
                }}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
              >
                Enviar recordatorio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de importar Excel */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !importing && setShowImportModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Importar Clientes desde Excel</h3>
            <p className="text-gray-500 mb-6 text-sm">
              El archivo Excel debe tener las siguientes columnas: Nombre, Apellido, Email, Teléfono, Localidad, Notas
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar archivo Excel (.xlsx)
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      handleImportFromExcel(file)
                    }
                  }}
                  disabled={importing}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
                />
              </div>

              {importing && (
                <div className="flex items-center gap-2 text-indigo-600">
                  <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Importando clientes...</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowImportModal(false)}
                disabled={importing}
                className="flex-1 py-3 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de agregar cliente */}
      {showAddClientModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddClientModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Agregar Nuevo Cliente</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newClient.first_name}
                  onChange={(e) => setNewClient({ ...newClient, first_name: e.target.value })}
                  placeholder="Juan"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apellido
                </label>
                <input
                  type="text"
                  value={newClient.last_name}
                  onChange={(e) => setNewClient({ ...newClient, last_name: e.target.value })}
                  placeholder="Pérez"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  placeholder="juan@ejemplo.com"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  placeholder="+5491112345678"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Localidad
                </label>
                <input
                  type="text"
                  value={newClient.location}
                  onChange={(e) => setNewClient({ ...newClient, location: e.target.value })}
                  placeholder="Ciudad o barrio"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  value={newClient.notes}
                  onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
                  placeholder="Notas adicionales sobre el cliente..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowAddClientModal(false)
                  setNewClient({
                    first_name: '',
                    last_name: '',
                    email: '',
                    phone: '',
                    location: '',
                    notes: ''
                  })
                }}
                className="flex-1 py-3 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddClient}
                disabled={!newClient.first_name.trim()}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Agregar Cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de editar cliente */}
      {showEditClientModal && editingClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEditClientModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Editar Cliente</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editClientForm.first_name}
                  onChange={(e) => setEditClientForm({ ...editClientForm, first_name: e.target.value })}
                  placeholder="Juan"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apellido
                </label>
                <input
                  type="text"
                  value={editClientForm.last_name}
                  onChange={(e) => setEditClientForm({ ...editClientForm, last_name: e.target.value })}
                  placeholder="Pérez"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editClientForm.email}
                  onChange={(e) => setEditClientForm({ ...editClientForm, email: e.target.value })}
                  placeholder="juan@ejemplo.com"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={editClientForm.phone}
                  onChange={(e) => setEditClientForm({ ...editClientForm, phone: e.target.value })}
                  placeholder="+5491112345678"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Localidad
                </label>
                <input
                  type="text"
                  value={editClientForm.location}
                  onChange={(e) => setEditClientForm({ ...editClientForm, location: e.target.value })}
                  placeholder="Ciudad o barrio"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  value={editClientForm.notes}
                  onChange={(e) => setEditClientForm({ ...editClientForm, notes: e.target.value })}
                  placeholder="Notas adicionales sobre el cliente..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowEditClientModal(false)
                  setEditingClient(null)
                }}
                className="flex-1 py-3 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditClient}
                disabled={!editClientForm.first_name.trim()}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

