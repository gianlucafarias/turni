import { useState } from 'react'
import type { DashboardNotification } from '../../../types/notifications'

interface NotificationCenterProps {
  notifications: DashboardNotification[]
  unreadCount: number
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  onClearAll: () => void
  onRemove: (id: string) => void
}

// Implementación mínima para que la navbar y el dashboard se hidraten correctamente.
// Más adelante se puede reemplazar por un centro de notificaciones completo.
export function NotificationCenter({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onRemove,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false)

  const hasNotifications = notifications.length > 0

  return (
    <div className="relative">
      <button
        type="button"
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-xl border border-surface-200 bg-white text-surface-500 hover:text-brand-600 hover:border-brand-200 shadow-sm transition-colors"
        aria-label="Notificaciones"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <>
            {/* Ping animation para llamar la atención */}
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-400 animate-ping opacity-75" />
            {/* Badge con número */}
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 min-w-[1.25rem] h-5 rounded-full bg-red-500 text-white text-[10px] font-bold shadow-lg shadow-red-500/30">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 max-h-96 rounded-2xl shadow-xl bg-white border border-surface-200 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-surface-900">Notificaciones</p>
              <p className="text-[11px] text-surface-400">
                {unreadCount > 0
                  ? `${unreadCount} sin leer`
                  : hasNotifications
                  ? 'Todas leídas'
                  : 'Sin notificaciones todavía'}
              </p>
            </div>
            {hasNotifications && (
              <button
                onClick={onMarkAllAsRead}
                className="text-[11px] font-semibold text-brand-600 hover:text-brand-700"
              >
                Marcar todo leído
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {hasNotifications ? (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    onMarkAsRead(n.id)
                    if (n.data?.linkTo) {
                      window.location.href = n.data.linkTo
                    }
                  }}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-surface-50 transition-colors ${
                    n.read ? 'bg-white' : 'bg-brand-50/40'
                  }`}
                >
                  <div className="mt-1">
                    <span className="text-base">
                      {/* Icono simple según tipo */}
                      {n.type === 'new_appointment' && '📅'}
                      {n.type === 'appointment_cancelled_by_client' && '❌'}
                      {n.type === 'appointment_modified_by_client' && '✏️'}
                      {n.type === 'daily_summary' && '📊'}
                      {n.type === 'subscription_reminder' && '💳'}
                      {n.type === 'subscription_payment_succeeded' && '✅'}
                      {n.type === 'subscription_payment_failed' && '⚠️'}
                      {n.type === 'subscription_cancelled' && '🧾'}
                      {n.type === 'subscription_downgraded' && '⬇️'}
                      {['system', 'success', 'error', 'limit_warning', 'trial_ending', 'appointment_reminder', 'subscription_expired'].includes(
                        n.type
                      ) && '🔔'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-surface-900 line-clamp-1">
                      {n.title}
                    </p>
                    <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                    {n.data?.clientName && (
                      <p className="text-[11px] text-surface-400 mt-0.5">
                        {n.data.clientName}
                        {n.data.time && ` · ${n.data.time.substring(0, 5)}`}
                      </p>
                    )}
                  </div>
                  {!n.read && (
                    <span className="mt-1 w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />
                  )}
                </button>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm text-surface-400">
                <p>No tenés notificaciones por ahora.</p>
              </div>
            )}
          </div>

          {hasNotifications && (
            <div className="px-4 py-2 border-t border-surface-100 flex items-center justify-between text-[11px]">
              <button
                onClick={onClearAll}
                className="text-red-500 hover:text-red-600 font-semibold"
              >
                Borrar todo
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-surface-400 hover:text-surface-600 font-semibold"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

