import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  storeUserId: string | null | undefined
  storeName?: string | null
  storeSlug?: string | null
  storeId?: string
  profileImageUrl?: string | null
}

export default function StoreOwnerAvatar({ storeUserId, storeName, storeSlug, storeId, profileImageUrl }: Props) {
  const [showAvatar, setShowAvatar] = useState(false)
  const [userInitial, setUserInitial] = useState('U')
  const [userEmail, setUserEmail] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!storeUserId) return

    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session && session.user.id === storeUserId) {
          const email = session.user.email || ''
          const initial = email[0]?.toUpperCase() || 'U'
          setUserInitial(initial)
          setUserEmail(email)
          setShowAvatar(true)
        } else {
          setShowAvatar(false)
        }
      } catch (error) {
        console.error('Error verificando sesión:', error)
        setShowAvatar(false)
      }
    }

    checkSession()

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        checkSession()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [storeUserId])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && buttonRef.current && 
          !menuRef.current.contains(event.target as Node) && 
          !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

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

  const publicUrl = storeSlug ? `/${storeSlug}` : (storeId ? `/${storeId}` : null)

  if (!showAvatar) return null

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {profileImageUrl ? (
          <img 
            src={profileImageUrl} 
            alt={storeName || 'Usuario'} 
            className="h-8 w-8 rounded-full object-cover border-2 border-white shadow-sm"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-semibold shadow-sm">
            {userInitial}
          </div>
        )}
        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            <div className="px-4 py-3 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-900">{userEmail}</p>
              {storeName && (
                <p className="text-xs text-gray-500 mt-1">{storeName}</p>
              )}
            </div>

            <a
              href="/dashboard"
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </a>

            <a
              href="/dashboard/profile"
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Mi Perfil
            </a>

            {publicUrl && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Ver tienda
              </a>
            )}

            <div className="border-t border-gray-200"></div>

            <button
              onClick={handleLogout}
              disabled={loading}
              className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {loading ? 'Cerrando sesión...' : 'Cerrar sesión'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

