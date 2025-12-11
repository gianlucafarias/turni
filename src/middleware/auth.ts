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

// No requerimos verificación de email en ningún entorno por ahora
const REQUIRE_EMAIL_VERIFICATION = false

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

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b0f55e3a-8eac-449f-96b7-3ed570a5511d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H-cookie',location:'src/middleware/auth.ts:63',message:'Incoming cookie keys',data:{keys:cookieEntries.map(c=>c.split('=')[0])},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      
      for (const cookie of cookieEntries) {
        const [rawKey, rawValue] = cookie.split('=')
        if (!rawKey || !rawValue) continue
        const key = rawKey.trim()
        if (!key || !key.includes('auth-token')) continue

        try {
          const decodedValue = decodeURIComponent(rawValue)
          const cookieData = JSON.parse(decodedValue)

          const accessToken =
            cookieData.access_token ||
            cookieData?.currentSession?.access_token ||
            cookieData?.user?.access_token
          const refreshToken =
            cookieData.refresh_token ||
            cookieData?.currentSession?.refresh_token ||
            cookieData?.user?.refresh_token

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/b0f55e3a-8eac-449f-96b7-3ed570a5511d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H-auth2',location:'src/middleware/auth.ts:73',message:'Found auth-token cookie',data:{cookieKey:key,hasAccess:!!accessToken},timestamp:Date.now()})}).catch(()=>{});
          // #endregion

          if (accessToken) {
            const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
              global: {
                headers: {
                  Authorization: `Bearer ${accessToken}`
                }
              },
              auth: {
                persistSession: false,
                autoRefreshToken: false
              }
            })
            
            const { data: { user } } = await supabaseClient.auth.getUser(accessToken)
            
            if (user) {
              session = {
                user,
                access_token: accessToken,
                refresh_token: refreshToken
              }
              break
            }
          }
        } catch (e) {
          continue
        }
      }
    } catch (error) {
      console.error('Error al leer cookies de sesión:', error)
    }
  }

  // Guardar sesión en locals para uso posterior
  ;(locals as any).session = session

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/b0f55e3a-8eac-449f-96b7-3ed570a5511d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H-auth',location:'src/middleware/auth.ts:106',message:'Middleware session check',data:{path:url.pathname,isPublic:isPublicRoute,requiresVerification,hasSession:!!session,emailConfirmed:session?.user?.email_confirmed_at},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  // En desarrollo, no hacer redirecciones automáticas desde el middleware
  // Dejar que el cliente maneje la autenticación
  if (import.meta.env.PROD) {
    // Solo en producción hacer verificaciones de sesión en el middleware
    if (isPublicRoute && session?.user && url.pathname !== '/login') {
      const isEmailVerified = REQUIRE_EMAIL_VERIFICATION 
        ? session.user.email_confirmed_at 
        : true
      
      if (isEmailVerified && url.pathname !== '/') {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b0f55e3a-8eac-449f-96b7-3ed570a5511d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H-auth',location:'src/middleware/auth.ts:118',message:'Redirecting public→dashboard',data:{path:url.pathname},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return redirect('/dashboard')
      }
    }

    if (requiresVerification && !session) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b0f55e3a-8eac-449f-96b7-3ed570a5511d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H-auth',location:'src/middleware/auth.ts:123',message:'Bypass redirect (no session, allow client)',data:{path:url.pathname},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      // No redirigimos; el cliente decidirá
    }

    if (requiresVerification && REQUIRE_EMAIL_VERIFICATION && session && !session.user.email_confirmed_at) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b0f55e3a-8eac-449f-96b7-3ed570a5511d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H-auth',location:'src/middleware/auth.ts:128',message:'Bypass redirect verify-email (disabled)',data:{path:url.pathname},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      // No redirigimos; verificación de email deshabilitada
    }
  }

  // Continuar con la siguiente función/página
  return next()
}) 