import { useState } from 'react'
import { signIn, signUp, getCurrentStore } from '../../lib/supabase'

interface AuthFormProps {
  type: 'login' | 'register'
}

export default function AuthForm({ type }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    
    if (!email || !password) {
      setError('Por favor completa todos los campos')
      return
    }

    try {
      setLoading(true)

      if (type === 'login') {
        // Iniciar sesión
        const { user } = await signIn(email, password)
        if (!user) throw new Error('No se pudo obtener la información del usuario')

        // Verificar si tiene tienda
        const store = await getCurrentStore()
        
        // Redirigir según corresponda
        window.location.href = store ? '/dashboard/products' : '/setup/store'
      } else {
        // Registrar usuario
        const { user, session, confirmationSent, alreadyRegistered } = await signUp(email, password)
        if (!user && !session && !confirmationSent) throw new Error('No se pudo crear el usuario')

        if (alreadyRegistered) {
          setSuccess('Ya hay una cuenta con este email. Te reenviamos el correo de confirmación.')
        } else if (confirmationSent) {
          setSuccess('Te hemos enviado un email de confirmación. Por favor revisa tu bandeja de entrada.')
        } else {
          setSuccess('Cuenta creada. Puedes iniciar sesión.')
        }
      }
    } catch (error: any) {
      console.error('Error en AuthForm:', error)
      if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        fetch('http://127.0.0.1:7242/ingest/b0f55e3a-8eac-449f-96b7-3ed570a5511d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'auth',hypothesisId:'H-signup',location:'AuthForm:submit',message:'Error en auth',data:{type,errorMessage:error?.message,errorName:error?.name},timestamp:Date.now()})}).catch(()=>{})
      }
      if (error.message.includes('Invalid login credentials')) {
        setError('Email o contraseña incorrectos')
      } else if (error.message.includes('Email not confirmed')) {
        setError('Por favor confirma tu email antes de iniciar sesión')
      } else if (error.message.includes('already registered') || error.message.includes('User already registered')) {
        setError('Ya existe una cuenta con este email')
      } else {
        setError(error.message || 'Ocurrió un error inesperado')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900">
          {type === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
        </h2>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            required
            minLength={6}
          />
          {type === 'register' && (
            <p className="mt-1 text-xs text-gray-500">
              La contraseña debe tener al menos 6 caracteres
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {type === 'login' ? 'Iniciando sesión...' : 'Creando cuenta...'}
            </>
          ) : (
            type === 'login' ? 'Iniciar sesión' : 'Crear cuenta'
          )}
        </button>

        <div className="text-sm text-center">
          {type === 'login' ? (
            <p className="text-gray-600">
              ¿No tienes una cuenta?{' '}
              <a href="/registro" className="font-medium text-blue-600 hover:text-blue-500">
                Regístrate
              </a>
            </p>
          ) : (
            <p className="text-gray-600">
              ¿Ya tienes una cuenta?{' '}
              <a href="/login" className="font-medium text-blue-600 hover:text-blue-500">
                Inicia sesión
              </a>
            </p>
          )}
        </div>
      </form>
    </div>
  )
} 