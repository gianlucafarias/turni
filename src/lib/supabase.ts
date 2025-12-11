import { createClient } from '@supabase/supabase-js'
import type { Database } from './db/schema'

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan las variables de entorno de Supabase')
}

// Cliente público (respeta RLS)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

// Cliente admin (ignora RLS) - SOLO usar en servidor para operaciones del sistema
export const supabaseAdmin = supabaseServiceKey 
  ? createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    })
  : supabase // Fallback al cliente normal si no hay service key

// Función para iniciar sesión
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error

  return { user: data.user, session: data.session }
}

// Función para registrarse
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${import.meta.env.PUBLIC_SITE_URL || window?.location.origin || ''}/auth/callback`
    }
  })

  if (error && error.message?.includes('already registered')) {
    // Reenviar correo de confirmación si ya existe el usuario
    await supabase.auth.resend({ type: 'signup', email }).catch(() => {})
    return { user: null, session: null, confirmationSent: true, alreadyRegistered: true }
  }

  if (error) throw error

  return { user: data.user, session: data.session, confirmationSent: !!data.user && !data.session }
}

// Función para cerrar sesión (tolerante a ausencia de sesión local)
export async function signOut() {
  const { error } = await supabase.auth.signOut({ scope: 'global' })
  if (error && error.message !== 'Auth session missing!') {
    throw error
  }
  // Limpiar sesión local por si acaso
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  supabase.auth.onAuthStateChange(() => {}) // noop para forzar ciclo
}

// Función para obtener la tienda del usuario actual
export async function getCurrentStore() {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.user) return null

  const { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('user_id', session.user.id)
    .single()

  return store
} 