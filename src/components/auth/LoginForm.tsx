import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      })

      if (error) {
        const errorMessage = error.message || error.error_description || '';
        
        if (!import.meta.env.PROD && (errorMessage.includes('Email not confirmed') || errorMessage.includes('email_not_confirmed'))) {
          setError('La verificación de email está activada en Supabase. Por favor desactívala en Authentication → Settings → "Enable email confirmations" para desarrollo.')
          setEmailNotConfirmed(true)
          return
        }
        
        throw error
      }

      if (!data.session) {
        throw new Error('No se pudo obtener la sesión')
      }

      await new Promise(resolve => setTimeout(resolve, 500))

      const { data: { session: verifySession } } = await supabase.auth.getSession()
      if (!verifySession) {
        throw new Error('La sesión no se guardó correctamente')
      }

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('user_id', data.user.id)
        .single()

      const redirectUrl = store ? '/dashboard' : '/setup/store'
      window.location.replace(redirectUrl)
      
    } catch (err: any) {
      console.error('Error de login:', err)
      if (err instanceof Error || err?.message) {
        const errorMessage = err.message || err.error_description || '';
        
        if (errorMessage.includes('Invalid login credentials')) {
          setError('Email o contraseña incorrectos')
          setEmailNotConfirmed(false)
        } else if (errorMessage.includes('Email not confirmed') || errorMessage.includes('email_not_confirmed')) {
          if (import.meta.env.PROD) {
            setError('Por favor confirma tu email antes de iniciar sesión. Revisa tu bandeja de entrada.')
            setEmailNotConfirmed(true)
          } else {
            setError('Error al iniciar sesión. Verifica que la verificación de email esté desactivada en Supabase.')
            setEmailNotConfirmed(false)
          }
        } else {
          setError(errorMessage || 'Error al iniciar sesión')
          setEmailNotConfirmed(false)
        }
      } else {
        setError('Error al iniciar sesión')
        setEmailNotConfirmed(false)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    if (!email) {
      setError('Por favor ingresa tu email primero')
      return
    }

    setResendLoading(true)
    setResendSuccess(false)
    setError(null)

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim()
      })

      if (resendError) {
        throw resendError
      }

      setResendSuccess(true)
      setError(null)
    } catch (err: any) {
      console.error('Error al reenviar email:', err)
      setError(err.message || 'Error al reenviar el email de confirmación')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {resendSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
          Email de confirmación reenviado. Por favor revisa tu bandeja de entrada.
        </div>
      )}

      {emailNotConfirmed && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl text-sm">
          <p className="mb-2">Tu email no ha sido confirmado.</p>
          <button
            type="button"
            onClick={handleResendConfirmation}
            disabled={resendLoading}
            className="text-sm underline hover:no-underline disabled:opacity-50 font-medium text-yellow-900"
          >
            {resendLoading ? 'Enviando...' : 'Reenviar email de confirmación'}
          </button>
        </div>
      )}
      
      <div>
        <label htmlFor="email" className="block text-sm font-semibold text-surface-900 mb-2">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-xl border border-surface-300 px-4 py-3 text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
          placeholder="tu@email.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-semibold text-surface-900 mb-2">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-xl border border-surface-300 px-4 py-3 text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !email || !password}
        className="w-full bg-brand-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 disabled:transform-none"
      >
        {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
      </button>
    </form>
  )
}
