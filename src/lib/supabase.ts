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
  })

  if (error) throw error

  return { user: data.user, session: data.session }
}

// Función para cerrar sesión
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
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