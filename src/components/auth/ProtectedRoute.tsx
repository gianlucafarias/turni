import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  children: React.ReactNode
  redirectTo?: string
}

export default function ProtectedRoute({ children, redirectTo = '/login' }: Props) {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session) {
          setAuthenticated(true)
        } else {
          window.location.href = redirectTo
        }
      } catch (error) {
        console.error('Error verificando autenticación:', error)
        window.location.href = redirectTo
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [redirectTo])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando sesión...</p>
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return null
  }

  return <>{children}</>
}



