import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PremiumBadge } from './UpgradePrompt'

interface Props {
  currentPath: string
  isOpen?: boolean
  onClose?: () => void
}

export default function DashboardSidebar({ currentPath, isOpen, onClose }: Props) {
  const [store, setStore] = useState<any>(null)
  const [isPremium, setIsPremium] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(isOpen ?? false)
  const [loading, setLoading] = useState(false)
  const storeType = store?.store_type ?? 'products'

  const logDebug = (payload: Record<string, unknown>) => {
    if (typeof window !== 'undefined') {
      const h = window.location.hostname
      if (h !== 'localhost' && h !== '127.0.0.1') return
    }
    fetch('http://127.0.0.1:7242/ingest/b0f55e3a-8eac-449f-96b7-3ed570a5511d',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    }).catch(()=>{})
  }

  useEffect(() => {
    async function loadStore() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          logDebug({sessionId:'debug-session',runId:'sidebar',hypothesisId:'H-sidebar',location:'DashboardSidebar:loadStore',message:'No session in sidebar',data:{},timestamp:Date.now()})
          return
        }

        logDebug({sessionId:'debug-session',runId:'sidebar',hypothesisId:'H-sidebar',location:'DashboardSidebar:loadStore',message:'Session found',data:{userId:session.user.id},timestamp:Date.now()})

        const { data: storeData } = await supabase
          .from('stores')
          .select('*, profile_image_url')
          .eq('user_id', session.user.id)
          .single()

        setStore(storeData)
        
        if (!storeData) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/b0f55e3a-8eac-449f-96b7-3ed570a5511d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'sidebar',hypothesisId:'H-sidebar',location:'DashboardSidebar:loadStore',message:'No store for user',data:{userId:session.user.id},timestamp:Date.now()})}).catch(()=>{})
          // #endregion
          return
        }
        
        logDebug({sessionId:'debug-session',runId:'sidebar',hypothesisId:'H-sidebar',location:'DashboardSidebar:loadStore',message:'Store loaded',data:{storeId:storeData.id,storeType:storeData.store_type},timestamp:Date.now()})
        
        if (storeData) {
          const { data: subscription } = await supabase
            .from('subscriptions')
            .select('plan_id, status')
            .eq('store_id', storeData.id)
            .single()
          
          const premiumPlans = ['premium', 'premium_annual', 'trial']
          setIsPremium(subscription?.status === 'active' && premiumPlans.includes(subscription?.plan_id))
        }
      } catch (error) {
        logDebug({sessionId:'debug-session',runId:'sidebar',hypothesisId:'H-sidebar',location:'DashboardSidebar:loadStore',message:'Error loading sidebar',data:{error: String(error)},timestamp:Date.now()})
        console.error('Error cargando tienda:', error)
      }
    }

    loadStore()

    const handleToggle = (e: CustomEvent) => {
      setIsMobileOpen(e.detail.open)
    }
    window.addEventListener('toggle-sidebar', handleToggle as EventListener)

    return () => {
      window.removeEventListener('toggle-sidebar', handleToggle as EventListener)
    }
  }, [])

  // Sincronizar estado externo si se proporciona
  useEffect(() => {
    if (isOpen !== undefined) {
      setIsMobileOpen(isOpen)
    }
  }, [isOpen])

  const handleLinkClick = () => {
    if (window.innerWidth < 768) {
      if (onClose) {
        onClose()
      } else {
        setIsMobileOpen(false)
      }
    }
  }

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      await supabase.auth.signOut({ scope: 'global' }).catch(() => {})
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
      window.location.href = '/login'
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
      setLoading(false)
    }
  }

  // Links principales (arriba)
  const mainLinks = (
    <nav className="space-y-1">
      {/* Inicio */}
      <a
        href="/dashboard"
        onClick={handleLinkClick}
        className={`flex items-center px-3 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 group ${
          currentPath === '/dashboard'
            ? 'bg-brand-50 text-brand-700 shadow-sm shadow-brand-500/5'
            : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
        }`}
      >
        <div className={`p-1.5 rounded-lg mr-3 transition-colors ${
          currentPath === '/dashboard' ? 'bg-brand-100 text-brand-600' : 'bg-surface-100 text-surface-400 group-hover:bg-surface-200 group-hover:text-surface-600'
        }`}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </div>
        Inicio
      </a>

      {/* Sección catálogo/turnos */}
      <div className="pt-6 pb-2 px-3">
        <p className="text-[10px] font-bold text-surface-400 uppercase tracking-[0.1em]">
          {storeType === 'products' ? 'Catálogo' : 'Gestión de Turnos'}
        </p>
      </div>

      {storeType === 'products' ? (
        <div className="space-y-1">
          <a
            href="/dashboard/products"
            onClick={handleLinkClick}
            className={`flex items-center px-3 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 group ${
              currentPath === '/dashboard/products'
                ? 'bg-brand-50 text-brand-700 shadow-sm shadow-brand-500/5'
                : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
            }`}
          >
            <div className={`p-1.5 rounded-lg mr-3 transition-colors ${
              currentPath === '/dashboard/products' ? 'bg-brand-100 text-brand-600' : 'bg-surface-100 text-surface-400 group-hover:bg-surface-200 group-hover:text-surface-600'
            }`}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            Productos
          </a>
          <a
            href="/dashboard/categories"
            onClick={handleLinkClick}
            className={`flex items-center px-3 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 group ${
              currentPath === '/dashboard/categories'
                ? 'bg-brand-50 text-brand-700 shadow-sm shadow-brand-500/5'
                : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
            }`}
          >
            <div className={`p-1.5 rounded-lg mr-3 transition-colors ${
              currentPath === '/dashboard/categories' ? 'bg-brand-100 text-brand-600' : 'bg-surface-100 text-surface-400 group-hover:bg-surface-200 group-hover:text-surface-600'
            }`}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            Categorías
          </a>
        </div>
      ) : (
        <div className="space-y-1">
          <a
            href="/dashboard/services"
            onClick={handleLinkClick}
            className={`flex items-center px-3 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 group ${
              currentPath === '/dashboard/services'
                ? 'bg-brand-50 text-brand-700 shadow-sm shadow-brand-500/5'
                : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
            }`}
          >
            <div className={`p-1.5 rounded-lg mr-3 transition-colors ${
              currentPath === '/dashboard/services' ? 'bg-brand-100 text-brand-600' : 'bg-surface-100 text-surface-400 group-hover:bg-surface-200 group-hover:text-surface-600'
            }`}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            Mis Servicios
          </a>
          <a
            href="/dashboard/schedule"
            onClick={handleLinkClick}
            className={`flex items-center px-3 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 group ${
              currentPath === '/dashboard/schedule'
                ? 'bg-brand-50 text-brand-700 shadow-sm shadow-brand-500/5'
                : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
            }`}
          >
            <div className={`p-1.5 rounded-lg mr-3 transition-colors ${
              currentPath === '/dashboard/schedule' ? 'bg-brand-100 text-brand-600' : 'bg-surface-100 text-surface-400 group-hover:bg-surface-200 group-hover:text-surface-600'
            }`}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            Mis Horarios
          </a>
          <a
            href="/dashboard/appointments"
            onClick={handleLinkClick}
            className={`flex items-center px-3 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 group ${
              currentPath === '/dashboard/appointments'
                ? 'bg-brand-50 text-brand-700 shadow-sm shadow-brand-500/5'
                : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
            }`}
          >
            <div className={`p-1.5 rounded-lg mr-3 transition-colors ${
              currentPath === '/dashboard/appointments' ? 'bg-brand-100 text-brand-600' : 'bg-surface-100 text-surface-400 group-hover:bg-surface-200 group-hover:text-surface-600'
            }`}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            Mis Citas
          </a>
          <a
            href="/dashboard/calendar"
            onClick={handleLinkClick}
            className={`flex items-center px-3 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 group ${
              currentPath === '/dashboard/calendar'
                ? 'bg-brand-50 text-brand-700 shadow-sm shadow-brand-500/5'
                : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
            }`}
          >
            <div className={`p-1.5 rounded-lg mr-3 transition-colors ${
              currentPath === '/dashboard/calendar' ? 'bg-brand-100 text-brand-600' : 'bg-surface-100 text-surface-400 group-hover:bg-surface-200 group-hover:text-surface-600'
            }`}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            Calendario
          </a>
          <a
            href="/dashboard/clients"
            onClick={handleLinkClick}
            className={`flex items-center px-3 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 group ${
              currentPath === '/dashboard/clients' || currentPath.startsWith('/dashboard/clients/')
                ? 'bg-brand-50 text-brand-700 shadow-sm shadow-brand-500/5'
                : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
            }`}
          >
            <div className={`p-1.5 rounded-lg mr-3 transition-colors ${
              currentPath === '/dashboard/clients' || currentPath.startsWith('/dashboard/clients/') ? 'bg-brand-100 text-brand-600' : 'bg-surface-100 text-surface-400 group-hover:bg-surface-200 group-hover:text-surface-600'
            }`}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <span className="flex-1">Mis Clientes</span>
            {!isPremium && <PremiumBadge />}
          </a>
        </div>
      )}
    </nav>
  )

  // Links de configuración y cerrar sesión (abajo)
  const bottomLinks = (
    <div className="border-t border-surface-200 pt-6 mt-4 space-y-1">
      <div className="px-3 mb-2">
        <p className="text-[10px] font-bold text-surface-400 uppercase tracking-[0.1em]">
          Configuración
        </p>
      </div>
      
      <a
        href="/dashboard/store"
        onClick={handleLinkClick}
        className={`flex items-center px-3 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 group ${
          currentPath === '/dashboard/store'
            ? 'bg-brand-50 text-brand-700 shadow-sm shadow-brand-500/5'
            : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
        }`}
      >
        <div className={`p-1.5 rounded-lg mr-3 transition-colors ${
          currentPath === '/dashboard/store' ? 'bg-brand-100 text-brand-600' : 'bg-surface-100 text-surface-400 group-hover:bg-surface-200 group-hover:text-surface-600'
        }`}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        Mi Tienda
      </a>
      <a
        href="/dashboard/subscription"
        onClick={handleLinkClick}
        className={`flex items-center px-3 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 group ${
          currentPath === '/dashboard/subscription' || currentPath.startsWith('/dashboard/subscription/')
            ? 'bg-brand-50 text-brand-700 shadow-sm shadow-brand-500/5'
            : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
        }`}
      >
        <div className={`p-1.5 rounded-lg mr-3 transition-colors ${
          currentPath === '/dashboard/subscription' || currentPath.startsWith('/dashboard/subscription/') ? 'bg-brand-100 text-brand-600' : 'bg-surface-100 text-surface-400 group-hover:bg-surface-200 group-hover:text-surface-600'
        }`}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        Mi Plan
      </a>

      {/* Cerrar sesión */}
      <button
        onClick={handleLogout}
        disabled={loading}
        className="w-full flex items-center px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-all group disabled:opacity-50 mt-2"
      >
        <div className="p-1.5 bg-red-50 rounded-lg mr-3 group-hover:bg-red-100 transition-colors">
          <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </div>
        {loading ? 'Cerrando...' : 'Cerrar sesión'}
      </button>
    </div>
  )

  return (
    <>
      {/* Overlay mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Desktop - altura completa */}
      <aside className="hidden md:block w-72 flex-shrink-0 h-full">
        <div className="bg-white rounded-2xl border border-surface-200/60 p-4 h-full flex flex-col justify-between shadow-sm">
          {store ? (
            <div className="flex flex-col h-full overflow-y-auto custom-scrollbar pr-1">
              {/* Avatar y nombre de tienda en la parte superior */}
              <div className="mb-6 pb-6 border-b border-surface-200">
                <div className="flex items-center gap-3">
                  {store.profile_image_url ? (
                    <img 
                      src={store.profile_image_url} 
                      alt={store.name} 
                      className="w-12 h-12 rounded-xl object-cover border-2 border-surface-200 shadow-sm"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                      {store.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-surface-900 truncate">{store.name}</p>
                    <p className="text-xs text-surface-500 truncate">Mi tienda</p>
                  </div>
                </div>
              </div>
              {mainLinks}
              <div className="mt-auto">
                {bottomLinks}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-10 bg-surface-100 rounded-xl animate-pulse w-full"></div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Sidebar Mobile - Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out md:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-5 border-b border-surface-200">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {store?.profile_image_url ? (
                <img 
                  src={store.profile_image_url} 
                  alt={store.name} 
                  className="w-10 h-10 rounded-xl object-cover border-2 border-surface-200 flex-shrink-0"
                />
              ) : (
                <div className="h-10 w-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {store?.name ? store.name.charAt(0).toUpperCase() : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
              )}
              <h2 className="text-lg font-bold text-surface-900 truncate">{store?.name || 'Menú'}</h2>
            </div>
            <button
              onClick={() => setIsMobileOpen(false)}
              className="p-2 rounded-xl text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 flex flex-col justify-between p-4 overflow-y-auto">
            {store ? (
              <>
                <div className="flex flex-col">
                  {mainLinks}
                </div>
                <div className="mt-auto">
                  {bottomLinks}
                </div>
              </>
            ) : (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-10 bg-surface-100 rounded-xl animate-pulse w-full"></div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
