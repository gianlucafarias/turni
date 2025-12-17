import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useSubscriptionLimits } from '../../hooks/useSubscriptionLimits'

interface AppointmentsSettingsProps {
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

export default function AppointmentsSettings({
  isOpen,
  onClose,
  onUpdate
}: AppointmentsSettingsProps) {
  const [store, setStore] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { isPremium } = useSubscriptionLimits()

  // Estados para las configuraciones
  const [allowMultiple, setAllowMultiple] = useState(false)
  const [maxPerSlot, setMaxPerSlot] = useState(1)
  const [autoNotify, setAutoNotify] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadStore()
    }
  }, [isOpen, isPremium]) // Recargar cuando cambie el estado de premium

  async function loadStore() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) return

      const { data: storeData } = await supabase
        .from('stores')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (storeData) {
        setStore(storeData)
        setAllowMultiple(storeData.allow_multiple_appointments || false)
        setMaxPerSlot(storeData.max_appointments_per_slot || 1)
        
        // Por defecto autoNotify está activado solo para usuarios premium
        // Si es premium y no tiene un valor establecido (undefined/null), usar true por defecto
        if (isPremium) {
          setAutoNotify(storeData.auto_notify_users !== false) // true si es undefined/null, o si es explícitamente true
        } else {
          setAutoNotify(false) // Siempre false para usuarios no premium
        }
      }
    } catch (error) {
      console.error('Error cargando tienda:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!store) return

    setSaving(true)
    try {
      const updates: any = {
        allow_multiple_appointments: allowMultiple,
        max_appointments_per_slot: allowMultiple ? maxPerSlot : 1,
      }

      // Solo guardar auto_notify_users si es premium y la columna existe
      // Si el usuario es premium, guardar el valor; si no es premium, forzar a false
      if (isPremium) {
        updates.auto_notify_users = autoNotify
      } else {
        updates.auto_notify_users = false
      }

      const { error } = await supabase
        .from('stores')
        .update(updates)
        .eq('id', store.id)

      if (error) {
        // Si falla porque la columna no existe, intentar sin auto_notify_users
        if (error.message?.includes('auto_notify_users')) {
          delete updates.auto_notify_users
          const { error: retryError } = await supabase
            .from('stores')
            .update(updates)
            .eq('id', store.id)
          
          if (retryError) throw retryError
        } else {
          throw error
        }
      }

      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error guardando configuraciones:', error)
      alert('Error al guardar las configuraciones')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Ajustes de Citas</h2>
            <p className="text-sm text-gray-500 mt-0.5">Configura cómo se gestionan tus turnos</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Permitir múltiples turnos simultáneos */}
          <div className="bg-white border-2 border-gray-100 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="text-sm font-semibold text-gray-900 block mb-1">
                  Permitir múltiples turnos simultáneos
                </label>
                <p className="text-xs text-gray-500">
                  Permite que varios clientes reserven el mismo horario
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAllowMultiple(!allowMultiple)
                  if (!allowMultiple) {
                    setMaxPerSlot(2)
                  }
                }}
                className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
                  allowMultiple ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${
                    allowMultiple ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {allowMultiple && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cantidad máxima de turnos por horario
                </label>
                <input
                  type="number"
                  min="2"
                  max="20"
                  value={maxPerSlot}
                  onChange={(e) => setMaxPerSlot(Math.max(2, parseInt(e.target.value) || 2))}
                  className="w-full px-4 py-2.5 border-2 border-gray-100 rounded-xl focus:border-indigo-500 focus:ring-0 bg-white"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Ejemplo: Si es 3, hasta 3 clientes pueden reservar a las 10:00 hs
                </p>
              </div>
            )}
          </div>

          {/* Notificar a usuarios automáticamente */}
          <div className="bg-white border-2 border-gray-100 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-sm font-semibold text-gray-900">
                    Notificar a usuarios automáticamente
                  </label>
                  {isPremium ? (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded">
                      PRO
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gray-400 text-white rounded">
                      PRO
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Envía notificaciones automáticas cuando se confirme o cancele un turno
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isPremium) {
                    setAutoNotify(!autoNotify)
                  }
                }}
                disabled={!isPremium}
                className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
                  !isPremium ? 'bg-gray-200 cursor-not-allowed opacity-50' :
                  autoNotify ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${
                    autoNotify ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
            {!isPremium && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3">
                <p className="text-xs text-amber-700">
                  <strong>Función Premium:</strong> Esta función solo está disponible para usuarios Premium. 
                  Las notificaciones automáticas no se enviarán en el plan gratuito.{' '}
                  <a
                    href="/dashboard/subscription"
                    className="font-medium hover:underline text-amber-800"
                  >
                    Actualizar a Premium →
                  </a>
                </p>
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-200"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>

        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
          .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        `}</style>
      </div>
    </div>
  )
}


