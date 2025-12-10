import { defineMiddleware } from 'astro:middleware'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../lib/db/schema'

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

// Rutas que no requieren autenticación (exactas)
const PUBLIC_ROUTES = [
  '/', 
  '/login', 
  '/registro', 
  '/auth/callback', 
  '/auth/verify-email',
  '/pricing',
  '/dashboard/subscription/callback', // Callback de Mercado Pago (no tiene sesión al volver)
]

// Prefijos de rutas públicas (cualquier ruta que empiece con estos)
const PUBLIC_PREFIXES = [
  '/api/',           // APIs públicas
  '/_',              // Astro internal
]

// Rutas que requieren email verificado
const PROTECTED_ROUTES = ['/dashboard', '/setup']

// Función para verificar si es ruta pública
function isPublicPath(pathname: string): boolean {
  // Rutas exactas
  if (PUBLIC_ROUTES.includes(pathname)) return true
  
  // Prefijos
  if (PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))) return true
  
  // Rutas de tiendas públicas (UUID) - /[storeId] y /[storeId]/[productId]
  const uuidPattern = /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  if (uuidPattern.test(pathname)) return true
  
  return false
}

// En desarrollo, no requerir verificación de email
// En producción, cambiar a false para requerir verificación
const REQUIRE_EMAIL_VERIFICATION = import.meta.env.PROD

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, locals, redirect } = context
  const url = new URL(request.url)
  const isPublicRoute = isPublicPath(url.pathname)
  const requiresVerification = PROTECTED_ROUTES.some(route => url.pathname.startsWith(route))

  // En desarrollo, no verificar sesión en el servidor (dejar que el cliente lo maneje)
  // En producción, intentar leer la sesión de las cookies
  let session = null

  if (import.meta.env.PROD) {
    // En producción, intentar leer la sesión de las cookies
    try {
      const cookieHeader = request.headers.get('Cookie') || ''
      const cookieEntries = cookieHeader.split(';').map(c => c.trim())
      
      for (const cookie of cookieEntries) {
        if (cookie.includes('auth-token')) {
          const [key, value] = cookie.split('=')
          try {
            const decodedValue = decodeURIComponent(value)
            const cookieData = JSON.parse(decodedValue)
            
            if (cookieData.access_token) {
              const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
                global: {
                  headers: {
                    Authorization: `Bearer ${cookieData.access_token}`
                  }
                },
                auth: {
                  persistSession: false,
                  autoRefreshToken: false
                }
              })
              
              const { data: { user } } = await supabaseClient.auth.getUser(cookieData.access_token)
              
              if (user) {
                session = {
                  user,
                  access_token: cookieData.access_token,
                  refresh_token: cookieData.refresh_token
                }
                break
              }
            }
          } catch (e) {
            continue
          }
        }
      }
    } catch (error) {
      console.error('Error al leer cookies de sesión:', error)
    }
  }

  // Guardar sesión en locals para uso posterior
  locals.session = session

  // En desarrollo, no hacer redirecciones automáticas desde el middleware
  // Dejar que el cliente maneje la autenticación
  if (import.meta.env.PROD) {
    // Solo en producción hacer verificaciones de sesión en el middleware
    if (isPublicRoute && session?.user && url.pathname !== '/login') {
      const isEmailVerified = REQUIRE_EMAIL_VERIFICATION 
        ? session.user.email_confirmed_at 
        : true
      
      if (isEmailVerified && url.pathname !== '/') {
        return redirect('/dashboard')
      }
    }

    if (requiresVerification && !session) {
      return redirect('/login')
    }

    if (requiresVerification && REQUIRE_EMAIL_VERIFICATION && session && !session.user.email_confirmed_at) {
      return redirect('/auth/verify-email')
    }
  }

  // Continuar con la siguiente función/página
  return next()
}) 