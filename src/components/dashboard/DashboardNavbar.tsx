import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { NotificationBell } from './notifications/NotificationBell'

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
      await supabase.auth.signOut({ scope: 'global' }).catch(() => {})
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
      window.location.href = '/login'
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
      setLogoutLoading(false)
    }
  }

  if (loading) {
    return (
      <nav className="bg-white border-b border-surface-200 top-0 z-30">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3">
      <div className="flex items-center">
            <div className="h-8 w-8 bg-surface-100 rounded animate-pulse"></div>
          </div>
        </div>
      </nav>
    )
  }

  const userEmail = user?.email || ''
  const userInitial = userEmail[0]?.toUpperCase() || 'U'
  const publicUrl = store?.slug ? `/${store.slug}` : (store?.id ? `/${store.id}` : '')

  return (
    <nav className="bg-white border-b border-surface-200/60 sticky top-0 z-30">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Izquierda: Logo y nombre */}
          <div className="flex items-center">
            <button
              onClick={handleMenuClick}
              className="md:hidden p-2 rounded-xl text-surface-500 hover:text-surface-700 hover:bg-surface-100 mr-2 transition-colors"
              aria-label="Abrir menú"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <a href="/dashboard" className="flex items-center group">
              <div className="h-9 w-9 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform duration-200">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-3 flex flex-col">
                <span className="text-sm font-semibold text-surface-900 leading-tight">{store?.name || 'Mi Tienda'}</span>
                <span className="text-[10px] font-medium text-brand-600 uppercase tracking-wider">Dashboard</span>
              </div>
            </a>
          </div>

          {/* Derecha: notificaciones y usuario */}
          <div className="flex items-center gap-2 sm:gap-4">
            
            {/* Centro de Notificaciones */}
            {store?.id && (
              <NotificationBell storeId={store.id} />
            )}

            {/* Ver tienda */}
            {publicUrl && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-surface-700 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all border border-transparent hover:border-brand-100"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span>Ver tienda</span>
              </a>
            )}

            {/* Divisor vertical */}
            <div className="h-8 w-px bg-surface-200 mx-1 hidden sm:block"></div>

            {/* Usuario */}
            <div className="relative" ref={menuRef}>
              <button
                ref={buttonRef}
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1 rounded-xl hover:bg-surface-50 transition-all border border-transparent "
              >
                <div className="h-8 w-8 rounded-lg bg-surface-900 flex items-center justify-center text-white text-xs font-bold">
                  {userInitial}
                </div>
                <div className="hidden lg:flex flex-col items-start pr-1">
                  <svg className={`h-3 w-3 text-surface-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-3 w-64 rounded-2xl shadow-xl bg-white border border-surface-200 overflow-hidden z-50 origin-top-right">
                  <div className="p-2">
                    <div className="px-4 py-3 bg-surface-50 rounded-xl mb-1">
                      <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-1">Sesión iniciada como</p>
                      <p className="text-sm font-bold text-surface-900 truncate">{userEmail}</p>
                    </div>
                    
                    <a
                      href="/dashboard/profile"
                      className="flex items-center px-4 py-2.5 text-sm text-surface-700 hover:bg-brand-50 hover:text-brand-700 rounded-xl transition-colors group"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <div className="p-1.5 bg-surface-100 rounded-lg mr-3 group-hover:bg-brand-100 transition-colors">
                        <svg className="h-4 w-4 text-surface-500 group-hover:text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      Mi Perfil
                    </a>
                    
                    {publicUrl && (
                      <a
                        href={publicUrl}
                        target="_blank"
                        className="flex items-center px-4 py-2.5 text-sm text-surface-700 hover:bg-brand-50 hover:text-brand-700 rounded-xl transition-colors group sm:hidden"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <div className="p-1.5 bg-surface-100 rounded-lg mr-3 group-hover:bg-brand-100 transition-colors">
                          <svg className="h-4 w-4 text-surface-500 group-hover:text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </div>
                        Ver tienda
                      </a>
                    )}

                    <div className="h-px bg-surface-100 my-1 mx-2"></div>
                    
                    <button
                      onClick={handleLogout}
                      disabled={logoutLoading}
                      className="w-full flex items-center px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors group"
                    >
                      <div className="p-1.5 bg-red-50 rounded-lg mr-3 group-hover:bg-red-100 transition-colors">
                        <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </div>
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
