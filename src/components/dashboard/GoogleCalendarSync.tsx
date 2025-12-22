import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useSubscriptionLimits } from '../../hooks/useSubscriptionLimits'
import GoogleCalendarUpgradeModal from './GoogleCalendarUpgradeModal'
import GoogleCalendarSuccessModal from './GoogleCalendarSuccessModal'

export default function GoogleCalendarSync() {
  const { isPremium, loading: subscriptionLoading } = useSubscriptionLimits()
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [store, setStore] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStoreAndConnectionStatus()
  }, [])

  async function loadStoreAndConnectionStatus() {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return
      }

      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('id, google_calendar_connected')
        .eq('user_id', session.user.id)
        .single()

      if (storeError) {
        console.error('Error obteniendo store:', storeError)
        setLoading(false)
        return
      }

      if (storeData) {
        console.log('Store data cargada:', storeData)
        setStore(storeData)
        const isConnectedValue = storeData.google_calendar_connected === true
        console.log('Setting isConnected to:', isConnectedValue)
        setIsConnected(isConnectedValue)
      }
    } catch (error) {
      console.error('Error cargando estado de conexión:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSyncClick() {
    if (!isPremium) {
      setShowUpgradeModal(true)
      return
    }

    if (isConnected) {
      // Desconectar
      if (confirm('¿Estás seguro de que quieres desconectar Google Calendar?')) {
        await disconnectGoogleCalendar()
      }
      return
    }

    // Conectar
    setIsConnecting(true)
    try {
      // Redirigir a endpoint de OAuth
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        alert('Debes iniciar sesión')
        setIsConnecting(false)
        return
      }

      // Obtener el access token de la sesión
      const accessToken = session.access_token

      // Obtener la URL de autorización del servidor
      const response = await fetch('/api/google-calendar/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ storeId: store?.id }),
      })

      if (!response.ok) {
        throw new Error('Error al iniciar la autenticación')
      }

      const { authUrl } = await response.json()
      
      // Guardar el store_id en sessionStorage para después de la redirección
      sessionStorage.setItem('google_calendar_store_id', store?.id)
      
      // Redirigir a Google OAuth
      window.location.href = authUrl
    } catch (error) {
      console.error('Error conectando con Google Calendar:', error)
      alert('Error al conectar con Google Calendar. Por favor, intenta nuevamente.')
    } finally {
      setIsConnecting(false)
    }
  }

  async function syncBidirectional(storeIdToUse?: string) {
    const targetStoreId = storeIdToUse || store?.id
    
    if (!targetStoreId) {
      console.log('No store ID available for sync')
      return
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.log('No session available for sync')
        return
      }

      const accessToken = session.access_token

      console.log('Iniciando sincronización bidireccional para store:', targetStoreId)

      const response = await fetch('/api/google-calendar/sync-bidirectional', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ storeId: targetStoreId }),
      })
      
      if (response.ok) {
        const { exported, imported, message } = await response.json()
        console.log(message)
        console.log(`Exportados: ${exported}, Importados: ${imported}`)
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Error en sincronización bidireccional:', errorData, 'Status:', response.status)
      }
    } catch (error) {
      console.error('Error en sincronización bidireccional:', error)
    }
  }

  async function syncExistingAppointments(storeIdToUse?: string) {
    const targetStoreId = storeIdToUse || store?.id
    
    if (!targetStoreId) {
      console.log('No store ID available for sync')
      return
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.log('No session available for sync')
        return
      }

      const accessToken = session.access_token

      console.log('Sincronizando turnos existentes para store:', targetStoreId)

      const response = await fetch('/api/google-calendar/sync-existing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ storeId: targetStoreId }),
      })
      
      if (response.ok) {
        const { synced } = await response.json()
        console.log(`Se sincronizaron ${synced} turnos existentes con Google Calendar`)
        alert(`Se sincronizaron ${synced} turnos existentes con Google Calendar`)
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Error sincronizando turnos existentes:', errorData, 'Status:', response.status)
        alert(`Error: ${errorData.error || 'Error desconocido'}`)
      }
    } catch (error) {
      console.error('Error sincronizando turnos existentes:', error)
      alert('Error al sincronizar turnos existentes')
    }
  }

  async function importGoogleCalendarEvents() {
    if (!store?.id) {
      alert('No se pudo obtener la información de la tienda')
      return
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        alert('Debes iniciar sesión para importar eventos')
        return
      }

      const accessToken = session.access_token

      const response = await fetch('/api/google-calendar/import-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ storeId: store.id, daysAhead: 90 }),
      })
      
      if (response.ok) {
        const { imported, total } = await response.json()
        alert(`Se importaron ${imported} eventos de Google Calendar (de ${total} encontrados)`)
        // Recargar la página para ver los nuevos turnos
        window.location.reload()
      } else {
        const error = await response.json().catch(() => ({ error: 'Error desconocido' }))
        console.error('Error response:', error)
        alert(`Error al importar eventos: ${error.error || 'Error desconocido'}`)
      }
    } catch (error) {
      console.error('Error importando eventos de Google Calendar:', error)
      alert('Error al importar eventos de Google Calendar')
    }
  }

  async function disconnectGoogleCalendar() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || !store) return

      const accessToken = session.access_token

      const response = await fetch('/api/google-calendar/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ storeId: store.id }),
      })

      if (response.ok) {
        setIsConnected(false)
        // Actualizar en la base de datos
        await supabase
          .from('stores')
          .update({ google_calendar_connected: false })
          .eq('id', store.id)
      }
    } catch (error) {
      console.error('Error desconectando Google Calendar:', error)
      alert('Error al desconectar Google Calendar')
    }
  }

  // Verificar si venimos de una redirección exitosa de OAuth
  useEffect(() => {
    async function handleOAuthReturn() {
      const urlParams = new URLSearchParams(window.location.search)
      const success = urlParams.get('google_calendar_success')
      const error = urlParams.get('google_calendar_error')

      console.log('Checking OAuth return:', { success, error, subscriptionLoading, loading })

      if (success === 'true') {
        console.log('OAuth success detected, reloading store status...')
        setIsConnecting(false)
        
        // Limpiar URL primero
        window.history.replaceState({}, document.title, window.location.pathname)
        
        // Esperar un momento para que la BD se actualice
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Recargar estado de conexión (esto actualizará isConnected)
        await loadStoreAndConnectionStatus()
        
        // Esperar un poco más y verificar de nuevo
        await new Promise(resolve => setTimeout(resolve, 500))
        await loadStoreAndConnectionStatus()
        
        // Mostrar modal de éxito después de recargar
        setShowSuccessModal(true)
        
        // Sincronización bidireccional automática después de conectar
        // Obtener el storeId directamente de la sesión para evitar problemas de timing
        setTimeout(async () => {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) return
          
          // Obtener storeId directamente de la BD
          const { data: storeData } = await supabase
            .from('stores')
            .select('id')
            .eq('user_id', session.user.id)
            .single()
          
          if (storeData?.id) {
            // Ejecutar sincronización bidireccional automática
            syncBidirectional(storeData.id)
          }
        }, 2000)
      } else if (error) {
        setIsConnecting(false)
        alert('Error al conectar con Google Calendar. Por favor, intenta nuevamente.')
        
        // Limpiar URL
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    }
    
    // Solo ejecutar si no está cargando la suscripción
    if (!subscriptionLoading) {
      handleOAuthReturn()
    }
  }, [subscriptionLoading])

  if (loading || subscriptionLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-10 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/>
              </svg>
              Sincronizar con Google Calendar
            </h2>
            <p className="text-sm text-gray-500">
              {isConnected 
                ? 'Tu cuenta está conectada. Los turnos se sincronizan automáticamente.'
                : 'Conecta tu cuenta de Google Calendar para sincronizar tus turnos automáticamente.'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {isConnected ? (
            <>
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">Conectado a Google Calendar</p>
                  <p className="text-xs text-green-700 mt-1">
                    Los turnos se guardan automáticamente en tu calendario
                  </p>
                </div>
                <button
                  onClick={handleSyncClick}
                  className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Desconectar
                </button>
              </div>
              
              <div className="space-y-2">
                {/* Botón para sincronización bidireccional completa */}
                <button
                  onClick={async () => {
                    if (store?.id) {
                      const { data: { session } } = await supabase.auth.getSession()
                      if (!session) {
                        alert('Debes iniciar sesión')
                        return
                      }

                      const accessToken = session.access_token

                      try {
                        const response = await fetch('/api/google-calendar/sync-bidirectional', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`,
                          },
                          body: JSON.stringify({ storeId: store.id }),
                        })

                        if (response.ok) {
                          const { exported, imported, message } = await response.json()
                          alert(message)
                          // Recargar la página para ver los nuevos turnos
                          window.location.reload()
                        } else {
                          const error = await response.json().catch(() => ({ error: 'Error desconocido' }))
                          alert(`Error: ${error.error || 'Error desconocido'}`)
                        }
                      } catch (error) {
                        console.error('Error en sincronización bidireccional:', error)
                        alert('Error al sincronizar')
                      }
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sincronizar todo (Exportar e Importar)
                </button>
                
                <div className="text-xs text-gray-500 text-center">
                  O sincronizar por separado:
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  {/* Botón para sincronizar turnos existentes */}
                  <button
                    onClick={async () => {
                      if (store?.id) {
                        await syncExistingAppointments(store.id)
                      }
                    }}
                    className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Exportar
                  </button>
                  
                  {/* Botón para importar eventos de Google Calendar */}
                  <button
                    onClick={importGoogleCalendarEvents}
                    className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Importar
                  </button>
                </div>
              </div>
            </>
          ) : (
            <button
              onClick={handleSyncClick}
              disabled={isConnecting}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border-2 border-gray-200 rounded-xl font-medium text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Conectando...</span>
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/>
                  </svg>
                  <span>Sincronizar con Google Calendar</span>
                </>
              )}
            </button>
          )}

          {!isPremium && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-sm text-amber-800">
                <span className="font-medium">Función Premium:</span> Actualiza a Pro para sincronizar tus turnos con Google Calendar.
              </p>
            </div>
          )}
        </div>
      </div>

      {showUpgradeModal && (
        <GoogleCalendarUpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}

      {showSuccessModal && (
        <GoogleCalendarSuccessModal
          isOpen={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
        />
      )}
    </>
  )
}

