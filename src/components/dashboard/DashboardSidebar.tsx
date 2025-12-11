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

  useEffect(() => {
    async function loadStore() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          return
        }

        const { data: storeData } = await supabase
          .from('stores')
          .select('*')
          .eq('user_id', session.user.id)
          .single()

        setStore(storeData)
        
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

  if (!store) {
    return null
  }

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
      const { error } = await supabase.auth.signOut()
      if (error) throw error
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
        className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
          currentPath === '/dashboard'
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        Inicio
      </a>

      {/* Sección catálogo/turnos */}
      <div className="pt-4">
        <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {store.store_type === 'products' ? 'Catálogo' : 'Turnos'}
        </p>
      </div>

      {store.store_type === 'products' ? (
        <>
          <a
            href="/dashboard/products"
            onClick={handleLinkClick}
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              currentPath === '/dashboard/products'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            Productos
          </a>
          <a
            href="/dashboard/categories"
            onClick={handleLinkClick}
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              currentPath === '/dashboard/categories'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Categorías
          </a>
        </>
      ) : (
        <>
          <a
            href="/dashboard/services"
            onClick={handleLinkClick}
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              currentPath === '/dashboard/services'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Mis Servicios
          </a>
          <a
            href="/dashboard/schedule"
            onClick={handleLinkClick}
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              currentPath === '/dashboard/schedule'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Mis Horarios
          </a>
          <a
            href="/dashboard/appointments"
            onClick={handleLinkClick}
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              currentPath === '/dashboard/appointments'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Mis Citas
          </a>
          <a
            href="/dashboard/clients"
            onClick={handleLinkClick}
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              currentPath === '/dashboard/clients' || currentPath.startsWith('/dashboard/clients/')
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Mis Clientes
            {!isPremium && <PremiumBadge />}
          </a>
        </>
      )}
    </nav>
  )

  // Links de configuración y cerrar sesión (abajo)
  const bottomLinks = (
    <div className="border-t border-gray-200 pt-4 space-y-1">
      <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Configuración
      </p>
      
      <a
        href="/dashboard/store"
        onClick={handleLinkClick}
        className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
          currentPath === '/dashboard/store'
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Mi Tienda
      </a>
      <a
        href="/dashboard/subscription"
        onClick={handleLinkClick}
        className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
          currentPath === '/dashboard/subscription' || currentPath.startsWith('/dashboard/subscription/')
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
        Mi Plan
      </a>

      {/* Cerrar sesión */}
      <button
        onClick={handleLogout}
        disabled={loading}
        className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
      >
        <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        {loading ? 'Cerrando sesión...' : 'Cerrar sesión'}
      </button>
    </div>
  )

  return (
    <>
      {/* Overlay mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Desktop - altura completa */}
      <aside className="hidden md:block w-64 flex-shrink-0">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 h-full flex flex-col justify-between">
          {mainLinks}
          {bottomLinks}
        </div>
      </aside>

      {/* Sidebar Mobile - Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out md:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{store?.name || 'Menú'}</h2>
            <button
              onClick={() => setIsMobileOpen(false)}
              className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 flex flex-col justify-between p-4 overflow-y-auto">
            {mainLinks}
            {bottomLinks}
          </div>
        </div>
      </aside>
    </>
  )
}
