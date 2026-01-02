import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import AppointmentDetailModal from './AppointmentDetailModal'
import NewAppointmentModal from './NewAppointmentModal'
import UpcomingAppointmentsEnhanced from './UpcomingAppointmentsEnhanced'

// Tipos para toast de confirmación
interface ConfirmToast {
  id: string
  type: 'success' | 'error' | 'warning' | 'upgrade'
  title: string
  message?: string
  action?: {
    label: string
    href: string
  }
}

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
  const [confirmToasts, setConfirmToasts] = useState<ConfirmToast[]>([])

  // Función para mostrar toast de confirmación
  const showConfirmToast = useCallback((toast: Omit<ConfirmToast, 'id'>) => {
    const id = `toast_${Date.now()}`
    setConfirmToasts(prev => [...prev, { ...toast, id }])
    
    // Auto-remover después de 6 segundos
    setTimeout(() => {
      setConfirmToasts(prev => prev.filter(t => t.id !== id))
    }, 6000)
  }, [])

  const removeConfirmToast = useCallback((id: string) => {
    setConfirmToasts(prev => prev.filter(t => t.id !== id))
  }, [])
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [appointmentsByDay, setAppointmentsByDay] = useState<{ day: string; count: number }[]>([])

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
          supabase.from('appointments').select('status, client_name, date').eq('store_id', storeData.id),
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

        // Procesar turnos por día de la semana
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
        const dayCounts: { [key: number]: number } = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
        
        all.forEach((apt: any) => {
          if (apt.date) {
            const date = new Date(apt.date + 'T12:00:00')
            const dayOfWeek = date.getDay()
            dayCounts[dayOfWeek] = (dayCounts[dayOfWeek] || 0) + 1
          }
        })

        // Convertir a array ordenado (Lun=1, Mar=2, ..., Dom=0)
        const appointmentsByDayData = [
          { day: dayNames[1], count: dayCounts[1] },
          { day: dayNames[2], count: dayCounts[2] },
          { day: dayNames[3], count: dayCounts[3] },
          { day: dayNames[4], count: dayCounts[4] },
          { day: dayNames[5], count: dayCounts[5] },
          { day: dayNames[6], count: dayCounts[6] },
          { day: dayNames[0], count: dayCounts[0] }
        ]

        setAppointmentsByDay(appointmentsByDayData)

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
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-surface-500 font-medium">Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  if (!store || !stats) return null

  const isAppointments = store.store_type === 'appointments'
  const publicUrl = store.slug ? `/${store.slug}` : `/${store.id}`
  const fullUrl = typeof window !== 'undefined' ? window.location.origin + publicUrl : ''
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
      pending: 'bg-amber-50 text-amber-700 border-amber-100',
      confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      cancelled: 'bg-red-50 text-red-700 border-red-100'
    }
    const labels = {
      pending: 'Pendiente',
      confirmed: 'Confirmado',
      cancelled: 'Cancelado'
    }
    return (
      <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold border uppercase tracking-wider ${styles[status as keyof typeof styles] || 'bg-surface-100 text-surface-700 border-surface-200'}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    )
  }

  // Verificar si hay configuración pendiente para turnos
  const needsSetup = isAppointments && (!stats.hasServices || !stats.hasSchedules)

  return (
    <div className="p-6 space-y-8">
      {/* Recordatorios de configuración para turnos */}
      {needsSetup && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/50 rounded-2xl p-6 shadow-sm shadow-amber-500/5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm border border-amber-100">
              <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-amber-900 text-lg">
                Configuración pendiente
              </h3>
              <p className="text-amber-700 mt-1 mb-6 text-sm">
                Tu agenda aún no es pública. Completá estos pasos para empezar a recibir turnos:
              </p>
              
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Alerta de servicios */}
                <div className={`p-4 rounded-xl border transition-all ${!stats.hasServices ? 'bg-white border-amber-200 shadow-sm' : 'bg-white/40 border-surface-200 opacity-60'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stats.hasServices ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                      {stats.hasServices ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="text-xs font-bold">1</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-surface-900">Crear servicios</p>
                      <p className="text-xs text-surface-500">¿Qué ofrecés hoy?</p>
                    </div>
                    {!stats.hasServices && (
                      <a href="/dashboard/services" className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-amber-700 transition-colors">
                        Ir
                      </a>
                    )}
                  </div>
                </div>
                
                {/* Alerta de horarios */}
                <div className={`p-4 rounded-xl border transition-all ${!stats.hasSchedules ? 'bg-white border-amber-200 shadow-sm' : 'bg-white/40 border-surface-200 opacity-60'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stats.hasSchedules ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                      {stats.hasSchedules ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="text-xs font-bold">2</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-surface-900">Tus horarios</p>
                      <p className="text-xs text-surface-500">¿Cuándo atendés?</p>
                    </div>
                    {!stats.hasSchedules && (
                      <a href="/dashboard/schedule" className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-amber-700 transition-colors">
                        Ir
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header de bienvenida */}
      <div className="bg-surface-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-surface-200">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-600/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-3">
           
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              👋 {greeting}, {store.name}!
              </h1>
              <p className="text-surface-400 text-sm font-medium mt-1">
                {isAppointments 
                  ? `Tenés ${stats.pendingAppointments} turno${stats.pendingAppointments !== 1 ? 's' : ''} para confirmar hoy.`
                  : `Tenés ${stats.activeProducts} producto${stats.activeProducts !== 1 ? 's' : ''} listos para vender.`
                }
              </p>
            </div>
          </div>
          
          {/* Quick actions */}
          <div className="flex flex-wrap gap-3 mt-8">
            <a
              href={publicUrl}
              target="_blank"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-xl px-5 py-2.5 rounded-xl font-bold text-sm transition-all border border-white/10 hover:border-white/20"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Ver página pública
            </a>
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Compartir link
            </button>
          </div>
        </div>
      </div>

      {/* Estadísticas principales */}
      {isAppointments ? (
        <>
          {/* Stats de turnos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white rounded-3xl p-6 border border-surface-200/60 shadow-sm hover:shadow-md transition-all group">
              <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-surface-900 leading-none">{stats.todayAppointments}</p>
              <p className="text-sm font-semibold text-surface-500 mt-2">Turnos hoy</p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-surface-200/60 shadow-sm hover:shadow-md transition-all group">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-surface-900 leading-none">{stats.pendingAppointments}</p>
              <p className="text-sm font-semibold text-surface-500 mt-2">Pendientes</p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-surface-200/60 shadow-sm hover:shadow-md transition-all group">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-surface-900 leading-none">{stats.confirmedAppointments}</p>
              <p className="text-sm font-semibold text-surface-500 mt-2">Confirmados</p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-surface-200/60 shadow-sm hover:shadow-md transition-all group">
              <div className="w-10 h-10 bg-surface-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-surface-900 leading-none">{stats.totalClients}</p>
              <p className="text-sm font-semibold text-surface-500 mt-2">Clientes únicos</p>
            </div>
          </div>

          {/* Segunda fila de stats + Próximos turnos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Métricas de rendimiento */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-3xl p-6 border border-surface-200/60 shadow-sm">
                <h3 className="font-bold text-surface-900 mb-6 flex items-center gap-2">
                  <div className="w-8 h-8 bg-surface-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  Distribución semanal
                </h3>
                
                {appointmentsByDay.length > 0 ? (
                  <div className="space-y-6">
                    {/* Gráfico de barras */}
                    <div className="flex items-end justify-between gap-2 h-40">
                      {appointmentsByDay.map((item, index) => {
                        const maxCount = Math.max(...appointmentsByDay.map(d => d.count), 1)
                        const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0
                        const today = new Date().getDay()
                        const dayIndex = index === 6 ? 0 : index + 1
                        const isToday = dayIndex === today
                        
                        return (
                          <div key={index} className="flex-1 flex flex-col items-center gap-2 h-full">
                            <div className="flex-1 w-full flex items-end justify-center relative group/bar">
                              <div
                                className={`w-full rounded-t-lg transition-all duration-300 ${
                                  isToday 
                                    ? 'bg-brand-600' 
                                    : 'bg-surface-200 hover:bg-brand-200'
                                }`}
                                style={{ height: `${height}%`, minHeight: item.count > 0 ? '4px' : '2px' }}
                              />
                              {item.count > 0 && (
                                <span className="absolute -top-6 text-[10px] font-bold text-surface-900 bg-surface-100 px-1.5 py-0.5 rounded-md opacity-0 group-hover/bar:opacity-100 transition-opacity">
                                  {item.count}
                                </span>
                              )}
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                              isToday ? 'text-brand-600' : 'text-surface-400'
                            }`}>
                              {item.day}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    
                    {/* Información adicional */}
                    <div className="pt-4 border-t border-surface-100">
                      <div className="flex justify-between items-center">
                        <span className="text-surface-500 text-xs font-bold uppercase tracking-wider">Total histórico</span>
                        <span className="text-xl font-bold text-surface-900">{stats.totalAppointments}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-surface-400 bg-surface-50 rounded-2xl border border-dashed border-surface-200">
                    <p className="text-xs font-medium">Sin datos aún</p>
                  </div>
                )}
              </div>

              {/* Servicios activos */}
              <div className="bg-white rounded-3xl p-6 border border-surface-200/60 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-surface-900">Servicios</h3>
                  <a href="/dashboard/services" className="text-brand-600 text-xs font-bold hover:text-brand-700 uppercase tracking-wider">
                    Ver todos
                  </a>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-3xl font-bold text-surface-900 leading-none">{stats.activeServices}</p>
                    <p className="text-xs font-semibold text-surface-500 mt-2">activos de {stats.totalServices}</p>
                  </div>
                  <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 border border-brand-100 transition-transform hover:scale-105">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Próximos turnos */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-surface-200/60 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-surface-900 flex items-center gap-2">
                  <div className="w-8 h-8 bg-surface-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  Próximos turnos
                </h3>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsNewAppointmentModalOpen(true)}
                    className="inline-flex items-center gap-1.5 bg-brand-600 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-600/10 active:scale-95"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Nuevo
                  </button>
                  <a href="/dashboard/appointments" className="text-surface-400 hover:text-surface-600 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </a>
                </div>
              </div>

              {upcomingAppointments.length > 0 ? (
                <div className="space-y-3">
                  {upcomingAppointments.map((apt) => (
                    <div 
                      key={apt.id}
                      className="flex items-center gap-4 p-4 bg-surface-50 rounded-2xl hover:bg-white border border-transparent hover:border-surface-200 hover:shadow-sm transition-all cursor-pointer group"
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
                      <div className="w-14 h-14 bg-white rounded-2xl flex flex-col items-center justify-center border border-surface-200 flex-shrink-0 group-hover:border-brand-200 transition-colors shadow-sm">
                        <span className="text-[10px] text-surface-400 font-bold uppercase tracking-widest">
                          {formatDate(apt.date).split(' ')[0]}
                        </span>
                        <span className="text-base font-bold text-surface-900 -mt-1">
                          {apt.time.substring(0, 5)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-surface-900 truncate group-hover:text-brand-600 transition-colors">{apt.client_name}</p>
                        <p className="text-xs font-semibold text-surface-500 truncate mt-0.5">{apt.service_name || 'Turno general'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="hidden sm:block">
                          {getStatusBadge(apt.status)}
                        </div>
                        {apt.status === 'pending' && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation()
                              
                              // Confirmar el turno
                              const { error: updateError } = await supabase
                                .from('appointments')
                                .update({ status: 'confirmed' })
                                .eq('id', apt.id)
                              
                              if (updateError) {
                                showConfirmToast({
                                  type: 'error',
                                  title: 'Error al confirmar',
                                  message: updateError.message
                                })
                                return
                              }
                              
                              // Verificar suscripción y enviar notificación
                              try {
                                const { data: subscription } = await supabase
                                  .from('subscriptions')
                                  .select('plan_id, status, trial_ends_at')
                                  .eq('store_id', store.id)
                                  .single()
                                
                                const premiumPlans = ['premium', 'premium_annual']
                                const isTrialActive = subscription?.status === 'trial' && 
                                  subscription?.trial_ends_at && 
                                  new Date(subscription.trial_ends_at) > new Date()
                                const isPremium = (subscription?.status === 'active' && premiumPlans.includes(subscription?.plan_id)) || isTrialActive
                                
                                if (isPremium) {
                                  // Usuario premium - enviar notificación por WhatsApp
                                  const response = await fetch('/api/notifications/send', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      type: 'appointment_confirmed',
                                      appointment_id: apt.id,
                                      store_id: store.id,
                                    }),
                                  })
                                  
                                  if (response.ok) {
                                    const result = await response.json()
                                    showConfirmToast({
                                      type: 'success',
                                      title: '✅ Turno confirmado',
                                      message: `${apt.client_name} fue notificado por WhatsApp`
                                    })
                                  } else {
                                    const errorData = await response.json().catch(() => ({}))
                                    showConfirmToast({
                                      type: 'warning',
                                      title: 'Turno confirmado',
                                      message: `⚠️ No se pudo notificar por WhatsApp: ${errorData.error || 'Error desconocido'}`
                                    })
                                  }
                                } else {
                                  // Usuario free - mostrar opción de upgrade
                                  showConfirmToast({
                                    type: 'upgrade',
                                    title: '✅ Turno confirmado',
                                    message: 'Notificá a tu cliente por WhatsApp automáticamente',
                                    action: {
                                      label: 'Activar notificaciones',
                                      href: '/dashboard/subscription'
                                    }
                                  })
                                }
                              } catch (error) {
                                console.error('Error verificando suscripción:', error)
                                showConfirmToast({
                                  type: 'success',
                                  title: '✅ Turno confirmado',
                                  message: `Se confirmó el turno de ${apt.client_name}`
                                })
                              }
                              
                              loadData()
                            }}
                            className="w-8 h-8 flex items-center justify-center bg-emerald-600 text-white rounded-lg shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-90"
                            title="Confirmar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                        <div className="p-2 text-surface-300 group-hover:text-brand-600 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-surface-50 rounded-3xl border border-dashed border-surface-200">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <svg className="w-8 h-8 text-surface-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-surface-500 font-medium mb-4 text-sm px-6">No tenés turnos próximos agendados.</p>
                  <button
                    onClick={() => setIsNewAppointmentModalOpen(true)}
                    className="inline-flex items-center gap-2 text-brand-600 font-bold hover:text-brand-700 text-sm px-4 py-2 bg-brand-50 rounded-xl transition-colors"
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white rounded-3xl p-6 border border-surface-200/60 shadow-sm hover:shadow-md transition-all group">
              <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-surface-900 leading-none">{stats.totalProducts}</p>
              <p className="text-sm font-semibold text-surface-500 mt-2">Productos totales</p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-surface-200/60 shadow-sm hover:shadow-md transition-all group">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-surface-900 leading-none">{stats.activeProducts}</p>
              <p className="text-sm font-semibold text-surface-500 mt-2">Activos</p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-surface-200/60 shadow-sm hover:shadow-md transition-all group">
              <div className="w-10 h-10 bg-surface-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-surface-900 leading-none">{stats.totalCategories}</p>
              <p className="text-sm font-semibold text-surface-500 mt-2">Categorías</p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-surface-200/60 shadow-sm hover:shadow-md transition-all group">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className={`w-5 h-5 ${stats.outOfStock > 0 ? 'text-red-600' : 'text-surface-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-surface-900 leading-none">{stats.outOfStock}</p>
              <p className="text-sm font-semibold text-surface-500 mt-2">Sin stock</p>
            </div>
          </div>

          {/* Acciones rápidas para productos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            <a 
              href="/dashboard/products/new"
              className="flex items-center gap-4 p-6 bg-white rounded-3xl border border-surface-200/60 shadow-sm hover:border-brand-200 hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 bg-brand-50 group-hover:bg-brand-600 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 shadow-sm group-hover:shadow-brand-500/20">
                <svg className="w-6 h-6 text-brand-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-surface-900">Agregar producto</h3>
                <p className="text-xs font-semibold text-surface-500 mt-0.5 uppercase tracking-wider">Nuevo ítem</p>
              </div>
            </a>

            <a 
              href="/dashboard/categories"
              className="flex items-center gap-4 p-6 bg-white rounded-3xl border border-surface-200/60 shadow-sm hover:border-brand-200 hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 bg-surface-100 group-hover:bg-surface-900 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 shadow-sm group-hover:shadow-surface-500/20">
                <svg className="w-6 h-6 text-surface-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-surface-900">Categorías</h3>
                <p className="text-xs font-semibold text-surface-500 mt-0.5 uppercase tracking-wider">Organizar</p>
              </div>
            </a>

            <a 
              href="/dashboard/products"
              className="flex items-center gap-4 p-6 bg-white rounded-3xl border border-surface-200/60 shadow-sm hover:border-brand-200 hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 bg-emerald-50 group-hover:bg-emerald-600 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 shadow-sm group-hover:shadow-emerald-500/20">
                <svg className="w-6 h-6 text-emerald-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-surface-900">Ver catálogo</h3>
                <p className="text-xs font-semibold text-surface-500 mt-0.5 uppercase tracking-wider">Gestionar</p>
              </div>
            </a>
          </div>
        </>
      )}

      {/* Tips y sugerencias */}
      <div className="bg-surface-900/5 rounded-3xl p-8 border border-surface-200/60 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-brand-500/10 transition-all duration-500" />
        <div className="flex items-start gap-6 relative z-10">
          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm border border-surface-200 group-hover:rotate-12 transition-transform duration-300">
            <svg className="w-7 h-7 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-surface-900 text-lg mb-1">Tip de crecimiento</h3>
            <p className="text-surface-600 leading-relaxed max-w-2xl">
              {isAppointments 
                ? 'Comparte el link de tu página en tus redes sociales y WhatsApp para que tus clientes puedan reservar fácilmente. ¡Más visibilidad = más turnos!'
                : 'Agrega fotos de calidad a tus productos y descripciones detalladas. Los productos con buenas imágenes reciben un 40% más de consultas.'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Acciones rápidas para turnos (al final si no es setup) */}
      {isAppointments && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
          <a 
            href="/dashboard/services"
            className="flex items-center gap-4 p-6 bg-white rounded-3xl border border-surface-200/60 shadow-sm hover:border-brand-200 hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 bg-brand-50 group-hover:bg-brand-600 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 shadow-sm group-hover:shadow-brand-500/20">
              <svg className="w-6 h-6 text-brand-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-surface-900">Mis servicios</h3>
              <p className="text-xs font-semibold text-surface-500 mt-0.5 uppercase tracking-wider">Configurar</p>
            </div>
          </a>

          <a 
            href="/dashboard/schedule"
            className="flex items-center gap-4 p-6 bg-white rounded-3xl border border-surface-200/60 shadow-sm hover:border-brand-200 hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 bg-purple-50 group-hover:bg-purple-600 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 shadow-sm group-hover:shadow-purple-500/20">
              <svg className="w-6 h-6 text-purple-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-surface-900">Mis horarios</h3>
              <p className="text-xs font-semibold text-surface-500 mt-0.5 uppercase tracking-wider">Disponibilidad</p>
            </div>
          </a>

          <a 
            href="/dashboard/store"
            className="flex items-center gap-4 p-6 bg-white rounded-3xl border border-surface-200/60 shadow-sm hover:border-brand-200 hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 bg-emerald-50 group-hover:bg-emerald-600 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 shadow-sm group-hover:shadow-emerald-500/20">
              <svg className="w-6 h-6 text-emerald-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-surface-900">Mi tienda</h3>
              <p className="text-xs font-semibold text-surface-500 mt-0.5 uppercase tracking-wider">Personalizar</p>
            </div>
          </a>
        </div>
      )}

      {/* Modales */}
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
          store={store}
        />
      )}

      <NewAppointmentModal
        isOpen={isNewAppointmentModalOpen}
        onClose={() => setIsNewAppointmentModalOpen(false)}
        onSuccess={loadData}
      />

      {/* Modal de compartir */}
      {isShareModalOpen && (
        <div 
          className="fixed inset-0 bg-surface-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn"
          onClick={() => setIsShareModalOpen(false)}
        >
          <div 
            className="bg-white rounded-[2.5rem] shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col border border-surface-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-8 py-8 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-surface-900">Compartir página</h2>
                <p className="text-surface-500 text-sm font-medium mt-1">Hacelo fácil para tus clientes</p>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="w-10 h-10 flex items-center justify-center hover:bg-surface-100 rounded-2xl transition-colors"
              >
                <svg className="w-6 h-6 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="px-8 pb-10 space-y-8 overflow-y-auto">
              {/* URL Input */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-surface-400 uppercase tracking-widest ml-1">Tu enlace público</label>
                <div className="flex items-center gap-2 p-2 bg-surface-50 rounded-2xl border border-surface-200 focus-within:border-brand-500 transition-all">
                  <div className="flex-1 px-3 py-2 text-sm font-bold text-surface-900 truncate">
                    {fullUrl}
                  </div>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(fullUrl)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                    className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap shadow-sm ${
                      copied 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-surface-900 text-white hover:bg-black'
                    }`}
                  >
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>

              {/* Botones de compartir */}
              <div className="grid grid-cols-2 gap-4">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent('¡Reservá tu turno aquí! ' + fullUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-3 p-6 bg-emerald-50 rounded-3xl border border-emerald-100 hover:bg-emerald-100 transition-all group"
                >
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </div>
                  <span className="text-sm font-bold text-emerald-900">WhatsApp</span>
                </a>

                <a
                  href={`mailto:?subject=${encodeURIComponent('Reservá tu turno')}&body=${encodeURIComponent('¡Reservá tu turno aquí! ' + fullUrl)}`}
                  className="flex flex-col items-center gap-3 p-6 bg-brand-50 rounded-3xl border border-brand-100 hover:bg-brand-100 transition-all group"
                >
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-brand-600 shadow-sm group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-bold text-brand-900">Email</span>
                </a>
              </div>
            </div>
          </div>

          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(10px) scale(0.98); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .animate-fadeIn { animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
          `}</style>
        </div>
      )}

      {/* Toast de confirmación de turno */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        {confirmToasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              transform transition-all duration-300 ease-out animate-slideIn
              ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200' : ''}
              ${toast.type === 'error' ? 'bg-red-50 border-red-200' : ''}
              ${toast.type === 'warning' ? 'bg-amber-50 border-amber-200' : ''}
              ${toast.type === 'upgrade' ? 'bg-gradient-to-r from-brand-50 to-purple-50 border-brand-200' : ''}
              border rounded-2xl shadow-xl overflow-hidden
            `}
          >
            {/* Barra de progreso */}
            <div className="h-1 bg-black/5 overflow-hidden">
              <div
                className={`h-full ${
                  toast.type === 'error' ? 'bg-red-500' : 
                  toast.type === 'warning' ? 'bg-amber-500' : 
                  toast.type === 'upgrade' ? 'bg-brand-500' : 
                  'bg-emerald-500'
                }`}
                style={{ animation: 'shrinkToast 6s linear forwards' }}
              />
            </div>

            <div className="p-4">
              <div className="flex items-start gap-3">
                {/* Icono */}
                <span className="text-xl flex-shrink-0">
                  {toast.type === 'success' && '✅'}
                  {toast.type === 'error' && '❌'}
                  {toast.type === 'warning' && '⚠️'}
                  {toast.type === 'upgrade' && '💬'}
                </span>

                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold ${
                    toast.type === 'success' ? 'text-emerald-800' : 
                    toast.type === 'error' ? 'text-red-800' : 
                    toast.type === 'warning' ? 'text-amber-800' : 
                    'text-brand-800'
                  }`}>
                    {toast.title}
                  </p>
                  {toast.message && (
                    <p className="text-sm text-gray-600 mt-0.5">{toast.message}</p>
                  )}

                  {/* Botón de acción (para upgrade) */}
                  {toast.action && (
                    <a
                      href={toast.action.href}
                      className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors"
                    >
                      {toast.action.label}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </a>
                  )}
                </div>

                {/* Botón cerrar */}
                <button
                  onClick={() => removeConfirmToast(toast.id)}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Estilos para animaciones de toast */}
      <style>{`
        @keyframes shrinkToast {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
      `}</style>
    </div>
  )
}
