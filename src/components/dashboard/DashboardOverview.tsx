import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import AppointmentDetailModal from './AppointmentDetailModal'
import NewAppointmentModal from './NewAppointmentModal'

interface Stats {
  // Turnos
  totalAppointments: number
  monthAppointments: number
  pendingAppointments: number
  confirmedAppointments: number
  cancelledAppointments: number
  todayAppointments: number
  weekAppointments: number
  confirmationRate: number
  totalClients: number
  
  // Productos
  totalProducts: number
  activeProducts: number
  totalCategories: number
  outOfStock: number
  
  // Servicios
  totalServices: number
  activeServices: number
  
  // Configuración (para recordatorios)
  hasSchedules: boolean
  hasServices: boolean
}

interface Appointment {
  id: string
  date: string
  time: string
  client_name: string
  service_name: string
  status: string
}

export default function DashboardOverview() {
  const [store, setStore] = useState<any>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isNewAppointmentModalOpen, setIsNewAppointmentModalOpen] = useState(false)

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
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (!storeData) {
        window.location.href = '/setup/store'
        return
      }

      setStore(storeData)

      // Cargar estadísticas según el tipo de tienda
      const now = new Date()
      const todayStr = now.toISOString().split('T')[0]
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay())).toISOString().split('T')[0]

      if (storeData.store_type === 'appointments') {
        // Cargar estadísticas de turnos
        const [
          allAppointments,
          monthAppointments,
          todayAppointments,
          weekAppointments,
          servicesData,
          schedulesData,
          upcomingData
        ] = await Promise.all([
          supabase.from('appointments').select('status, client_name').eq('store_id', storeData.id),
          supabase.from('appointments').select('id').eq('store_id', storeData.id).gte('date', monthStart),
          supabase.from('appointments').select('id').eq('store_id', storeData.id).eq('date', todayStr),
          supabase.from('appointments').select('id').eq('store_id', storeData.id).gte('date', weekStart),
          supabase.from('services').select('id, active').eq('store_id', storeData.id),
          supabase.from('schedules').select('id, enabled').eq('store_id', storeData.id),
          supabase.from('appointments')
            .select('id, date, time, client_name, service_name, status')
            .eq('store_id', storeData.id)
            .gte('date', todayStr)
            .in('status', ['pending', 'confirmed'])
            .order('date', { ascending: true })
            .order('time', { ascending: true })
            .limit(5)
        ])

        const all = allAppointments.data || []
        const pending = all.filter(a => a.status === 'pending').length
        const confirmed = all.filter(a => a.status === 'confirmed').length
        const cancelled = all.filter(a => a.status === 'cancelled').length
        const total = all.length
        const uniqueClients = new Set(all.map(a => a.client_name?.toLowerCase())).size
        const services = servicesData.data || []
        const schedules = schedulesData.data || []
        const activeSchedules = schedules.filter(s => s.enabled)

        setStats({
          totalAppointments: total,
          monthAppointments: monthAppointments.data?.length || 0,
          pendingAppointments: pending,
          confirmedAppointments: confirmed,
          cancelledAppointments: cancelled,
          todayAppointments: todayAppointments.data?.length || 0,
          weekAppointments: weekAppointments.data?.length || 0,
          confirmationRate: total > 0 ? Math.round((confirmed / total) * 100) : 0,
          totalClients: uniqueClients,
          totalProducts: 0,
          activeProducts: 0,
          totalCategories: 0,
          outOfStock: 0,
          totalServices: services.length,
          activeServices: services.filter(s => s.active).length,
          hasSchedules: activeSchedules.length > 0,
          hasServices: services.length > 0
        })

        setUpcomingAppointments(upcomingData.data || [])
      } else {
        // Cargar estadísticas de productos
        const [productsData, categoriesData] = await Promise.all([
          supabase.from('products').select('id, active, stock').eq('store_id', storeData.id),
          supabase.from('categories').select('id').eq('store_id', storeData.id)
        ])

        const products = productsData.data || []
        const categories = categoriesData.data || []

        setStats({
          totalAppointments: 0,
          monthAppointments: 0,
          pendingAppointments: 0,
          confirmedAppointments: 0,
          cancelledAppointments: 0,
          todayAppointments: 0,
          weekAppointments: 0,
          confirmationRate: 0,
          totalClients: 0,
          totalProducts: products.length,
          activeProducts: products.filter(p => p.active).length,
          totalCategories: categories.length,
          outOfStock: products.filter(p => p.stock === 0).length,
          totalServices: 0,
          activeServices: 0,
          hasSchedules: true, // No aplica para productos
          hasServices: true // No aplica para productos
        })
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  if (!store || !stats) return null

  const isAppointments = store.store_type === 'appointments'
  const publicUrl = store.slug ? `/${store.slug}` : `/${store.id}`
  const greeting = getGreeting()

  function getGreeting() {
    const hour = new Date().getHours()
    if (hour < 12) return '¡Buenos días'
    if (hour < 19) return '¡Buenas tardes'
    return '¡Buenas noches'
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr + 'T12:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date.toDateString() === today.toDateString()) return 'Hoy'
    if (date.toDateString() === tomorrow.toDateString()) return 'Mañana'
    return date.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  function getStatusBadge(status: string) {
    const styles = {
      pending: 'bg-amber-100 text-amber-700',
      confirmed: 'bg-emerald-100 text-emerald-700',
      cancelled: 'bg-red-100 text-red-700'
    }
    const labels = {
      pending: 'Pendiente',
      confirmed: 'Confirmado',
      cancelled: 'Cancelado'
    }
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700'}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    )
  }

  // Verificar si hay configuración pendiente para turnos
  const needsSetup = isAppointments && (!stats.hasServices || !stats.hasSchedules)

  return (
    <div className="space-y-8">
      {/* Recordatorios de configuración para turnos */}
      {needsSetup && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-amber-900 text-lg mb-2">
                ⚠️ Configuración pendiente
              </h3>
              <p className="text-amber-800 mb-4">
                Para que tus clientes puedan reservar turnos, necesitás completar la configuración inicial:
              </p>
              
              <div className="space-y-3">
                {/* Alerta de servicios */}
                {!stats.hasServices && (
                  <div className="flex items-center gap-3 bg-white/50 rounded-xl p-4 border border-amber-200">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${stats.hasServices ? 'bg-green-100' : 'bg-red-100'}`}>
                      {stats.hasServices ? (
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">Crear servicios</p>
                      <p className="text-sm text-gray-600">Definí qué servicios ofrecés (ej: Corte de pelo, Consulta, etc.)</p>
                    </div>
                    <a 
                      href="/dashboard/services"
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors text-sm"
                    >
                      Configurar
                    </a>
                  </div>
                )}
                
                {/* Alerta de horarios */}
                {!stats.hasSchedules && (
                  <div className="flex items-center gap-3 bg-white/50 rounded-xl p-4 border border-amber-200">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${stats.hasSchedules ? 'bg-green-100' : 'bg-red-100'}`}>
                      {stats.hasSchedules ? (
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">Definir horarios de trabajo</p>
                      <p className="text-sm text-gray-600">Indicá qué días y horarios atendés</p>
                    </div>
                    <a 
                      href="/dashboard/schedule"
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors text-sm"
                    >
                      Configurar
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header de bienvenida */}
      <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-3xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">👋</span>
            <h1 className="text-2xl sm:text-3xl font-bold">
              {greeting}, {store.name}!
            </h1>
          </div>
          <p className="text-white/80 text-lg">
            {isAppointments 
              ? `Tenés ${stats.pendingAppointments} turno${stats.pendingAppointments !== 1 ? 's' : ''} pendiente${stats.pendingAppointments !== 1 ? 's' : ''} de confirmar`
              : `Tu tienda tiene ${stats.activeProducts} producto${stats.activeProducts !== 1 ? 's' : ''} activo${stats.activeProducts !== 1 ? 's' : ''}`
            }
          </p>
          
          {/* Quick actions */}
          <div className="flex flex-wrap gap-3 mt-6">
            <a
              href={publicUrl}
              target="_blank"
              className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur px-4 py-2.5 rounded-xl font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Ver mi página
            </a>
            <button
              onClick={() => {
                const url = window.location.origin + publicUrl
                navigator.clipboard.writeText(url)
                alert('¡Enlace copiado!')
              }}
              className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur px-4 py-2.5 rounded-xl font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Compartir
            </button>
          </div>
        </div>
      </div>

      {/* Estadísticas principales */}
      {isAppointments ? (
        <>
          {/* Stats de turnos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.todayAppointments}</p>
              <p className="text-sm text-gray-500">Turnos hoy</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.pendingAppointments}</p>
              <p className="text-sm text-gray-500">Pendientes</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.confirmedAppointments}</p>
              <p className="text-sm text-gray-500">Confirmados</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.totalClients}</p>
              <p className="text-sm text-gray-500">Clientes únicos</p>
            </div>
          </div>

          {/* Segunda fila de stats + Próximos turnos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Métricas de rendimiento */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Resumen
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">Este mes</span>
                      <span className="font-semibold text-gray-900">{stats.monthAppointments} turnos</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (stats.monthAppointments / Math.max(stats.totalAppointments, 1)) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">Tasa de confirmación</span>
                      <span className="font-semibold text-gray-900">{stats.confirmationRate}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${stats.confirmationRate}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 text-sm">Total histórico</span>
                      <span className="text-2xl font-bold text-gray-900">{stats.totalAppointments}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Servicios activos */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">Servicios</h3>
                  <a href="/dashboard/services" className="text-indigo-600 text-sm font-medium hover:text-indigo-700">
                    Ver todos →
                  </a>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-3xl font-bold text-gray-900">{stats.activeServices}</p>
                    <p className="text-sm text-gray-500">activos de {stats.totalServices}</p>
                  </div>
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center text-white">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Próximos turnos */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Próximos turnos
                </h3>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsNewAppointmentModalOpen(true)}
                    className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Nueva
                  </button>
                  <a href="/dashboard/appointments" className="text-indigo-600 text-sm font-medium hover:text-indigo-700">
                    Ver todos →
                  </a>
                </div>
              </div>

              {upcomingAppointments.length > 0 ? (
                <div className="space-y-3">
                  {upcomingAppointments.map((apt) => (
                    <div 
                      key={apt.id}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 hover:shadow-sm transition-all cursor-pointer group"
                      onClick={async () => {
                        // Cargar datos completos del turno
                        const { data } = await supabase
                          .from('appointments')
                          .select('*')
                          .eq('id', apt.id)
                          .single()
                        if (data) {
                          setSelectedAppointment(data)
                          setIsModalOpen(true)
                        }
                      }}
                    >
                      <div className="w-12 h-12 bg-white rounded-xl flex flex-col items-center justify-center border border-gray-200 flex-shrink-0 group-hover:border-indigo-200 transition-colors">
                        <span className="text-xs text-gray-400 font-medium uppercase">
                          {formatDate(apt.date).split(' ')[0]}
                        </span>
                        <span className="text-lg font-bold text-gray-900 -mt-1">
                          {apt.time.substring(0, 5)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{apt.client_name}</p>
                        <p className="text-sm text-gray-500 truncate">{apt.service_name || 'Turno general'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(apt.status)}
                        {apt.status === 'pending' && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation()
                              await supabase.from('appointments').update({ status: 'confirmed' }).eq('id', apt.id)
                              
                              // Enviar notificación si es premium
                              try {
                                const { data: subscription } = await supabase
                                  .from('subscriptions')
                                  .select('plan_id, status')
                                  .eq('store_id', store.id)
                                  .single()
                                
                                const premiumPlans = ['premium', 'premium_annual', 'trial']
                                const isPremium = subscription?.status === 'active' && premiumPlans.includes(subscription?.plan_id)
                                
                                if (isPremium) {
                                  const response = await fetch('/api/notifications/send', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      type: 'appointment_confirmed',
                                      appointment_id: apt.id,
                                      store_id: store.id,
                                    }),
                                  })
                                  if (!response.ok) {
                                    console.error('Error enviando notificación:', await response.text())
                                  }
                                }
                              } catch (error) {
                                console.error('Error verificando suscripción:', error)
                              }
                              
                              loadData()
                            }}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors"
                            title="Confirmar rápidamente"
                          >
                            ✓
                          </button>
                        )}
                        <div className="p-2 text-gray-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 rounded-lg transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 mb-3">No hay turnos próximos</p>
                  <button
                    onClick={() => setIsNewAppointmentModalOpen(true)}
                    className="inline-flex items-center gap-2 text-indigo-600 font-medium hover:text-indigo-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Crear turno manual
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Stats de productos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.totalProducts}</p>
              <p className="text-sm text-gray-500">Productos totales</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.activeProducts}</p>
              <p className="text-sm text-gray-500">Activos</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.totalCategories}</p>
              <p className="text-sm text-gray-500">Categorías</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  stats.outOfStock > 0 ? 'bg-red-100' : 'bg-gray-100'
                }`}>
                  <svg className={`w-5 h-5 ${stats.outOfStock > 0 ? 'text-red-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.outOfStock}</p>
              <p className="text-sm text-gray-500">Sin stock</p>
            </div>
          </div>

          {/* Acciones rápidas para productos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <a 
              href="/dashboard/products/new"
              className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 bg-indigo-100 group-hover:bg-indigo-500 rounded-xl flex items-center justify-center transition-colors">
                <svg className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Agregar producto</h3>
                <p className="text-sm text-gray-500">Publica un nuevo producto</p>
              </div>
            </a>

            <a 
              href="/dashboard/categories"
              className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 bg-purple-100 group-hover:bg-purple-500 rounded-xl flex items-center justify-center transition-colors">
                <svg className="w-6 h-6 text-purple-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Gestionar categorías</h3>
                <p className="text-sm text-gray-500">Organiza tus productos</p>
              </div>
            </a>

            <a 
              href="/dashboard/products"
              className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 bg-emerald-100 group-hover:bg-emerald-500 rounded-xl flex items-center justify-center transition-colors">
                <svg className="w-6 h-6 text-emerald-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Ver catálogo</h3>
                <p className="text-sm text-gray-500">Gestiona tus productos</p>
              </div>
            </a>
          </div>
        </>
      )}

      {/* Tips y sugerencias */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-100">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-amber-900 mb-1">💡 Tip para mejorar tu negocio</h3>
            <p className="text-amber-700 text-sm">
              {isAppointments 
                ? 'Comparte el link de tu página en tus redes sociales y WhatsApp para que tus clientes puedan reservar fácilmente. ¡Más visibilidad = más turnos!'
                : 'Agrega fotos de calidad a tus productos y descripciones detalladas. Los productos con buenas imágenes reciben un 40% más de consultas.'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Acciones rápidas para turnos */}
      {isAppointments && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <a 
            href="/dashboard/services"
            className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 bg-indigo-100 group-hover:bg-indigo-500 rounded-xl flex items-center justify-center transition-colors">
              <svg className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Mis servicios</h3>
              <p className="text-sm text-gray-500">Configura qué ofreces</p>
            </div>
          </a>

          <a 
            href="/dashboard/schedule"
            className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 bg-purple-100 group-hover:bg-purple-500 rounded-xl flex items-center justify-center transition-colors">
              <svg className="w-6 h-6 text-purple-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Mis horarios</h3>
              <p className="text-sm text-gray-500">Define tu disponibilidad</p>
            </div>
          </a>

          <a 
            href="/dashboard/store"
            className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 bg-emerald-100 group-hover:bg-emerald-500 rounded-xl flex items-center justify-center transition-colors">
              <svg className="w-6 h-6 text-emerald-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Mi tienda</h3>
              <p className="text-sm text-gray-500">Personaliza tu perfil</p>
            </div>
          </a>
        </div>
      )}

      {/* Modal de detalles */}
      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedAppointment(null)
          }}
          onUpdate={loadData}
          onDelete={async () => {
            await supabase.from('appointments').delete().eq('id', selectedAppointment.id)
            setIsModalOpen(false)
            setSelectedAppointment(null)
            loadData()
          }}
        />
      )}

      {/* Modal de nueva cita */}
      <NewAppointmentModal
        isOpen={isNewAppointmentModalOpen}
        onClose={() => setIsNewAppointmentModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  )
}
