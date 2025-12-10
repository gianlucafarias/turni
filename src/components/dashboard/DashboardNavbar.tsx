import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  currentPath: string
  onMenuClick?: () => void
}

export default function DashboardNavbar({ currentPath, onMenuClick }: Props) {
  const [store, setStore] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    async function loadStore() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          window.location.href = '/login'
          return
        }

        setUser(session.user)

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session && event === 'SIGNED_OUT') {
        window.location.href = '/login'
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && buttonRef.current && 
          !menuRef.current.contains(event.target as Node) && 
          !buttonRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }

    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [userMenuOpen])

  const handleMenuClick = () => {
    setSidebarOpen(!sidebarOpen)
    window.dispatchEvent(new CustomEvent('toggle-sidebar', { detail: { open: !sidebarOpen } }))
    if (onMenuClick) onMenuClick()
  }

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault()
    try {
      setLogoutLoading(true)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      window.location.href = '/login'
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
      setLogoutLoading(false)
    }
  }

  if (loading) {
    return (
      <nav className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
            <span className="ml-3 text-lg font-semibold text-gray-400">Cargando...</span>
          </div>
        </div>
      </nav>
    )
  }

  const userEmail = user?.email || ''
  const userInitial = userEmail[0]?.toUpperCase() || 'U'

  return (
    <nav className="px-6">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Izquierda: Logo y nombre */}
          <div className="flex items-center">
            <button
              onClick={handleMenuClick}
              className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 mr-3"
              aria-label="Abrir menú"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <a href="/dashboard" className="flex items-center">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                {store?.name?.charAt(0).toUpperCase() || 'T'}
              </div>
              <span className="ml-3 text-xl font-bold text-gray-900">{store?.name || 'Mi Tienda'}</span>
            </a>
          </div>

          {/* Derecha: usuario */}
          <div className="flex items-center gap-4">
           

            {/* Ver tienda */}
            <a
              href={`/${store?.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Ver tienda
            </a>

            {/* Usuario */}
            <div className="relative" ref={menuRef}>
              <button
                ref={buttonRef}
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold">
                  {userInitial}
                </div>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                  <div className="py-1">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <p className="text-sm font-medium text-gray-900">{userEmail}</p>
                      <p className="text-xs text-gray-500 mt-1">{store?.name}</p>
                    </div>
                    <a
                      href="/dashboard/profile"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Mi Perfil
                    </a>
                    <a
                      href={`/${store?.id}`}
                      target="_blank"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 sm:hidden"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Ver tienda
                    </a>
                    <div className="border-t border-gray-200"></div>
                    <button
                      onClick={handleLogout}
                      disabled={logoutLoading}
                      className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      {logoutLoading ? 'Cerrando...' : 'Cerrar sesión'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
