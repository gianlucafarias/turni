// =============================================================================
// Centro de Notificaciones (Campanita)
// Dropdown con todas las notificaciones y acciones
// =============================================================================

import { useState, useRef, useEffect } from 'react';
import type { DashboardNotification } from '../../../types/notifications';
import { NOTIFICATION_ICONS, NOTIFICATION_COLORS } from '../../../types/notifications';

interface NotificationCenterProps {
  notifications: DashboardNotification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onRemove: (id: string) => void;
}

export function NotificationCenter({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onRemove,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Formatear tiempo relativo
  function formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Ahora';
    if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón campanita */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
        aria-label={`Notificaciones ${unreadCount > 0 ? `(${unreadCount} sin leer)` : ''}`}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" 
          />
        </svg>
        
        {/* Badge de notificaciones no leídas */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <span>🔔</span>
              Notificaciones
              {unreadCount > 0 && (
                <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                  {unreadCount} nuevas
                </span>
              )}
            </h3>
            
            {notifications.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={onMarkAllAsRead}
                  className="text-xs text-white/80 hover:text-white transition-colors"
                >
                  Marcar leídas
                </button>
                <span className="text-white/40">|</span>
                <button
                  onClick={onClearAll}
                  className="text-xs text-white/80 hover:text-white transition-colors"
                >
                  Limpiar
                </button>
              </div>
            )}
          </div>

          {/* Lista de notificaciones */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <p className="text-gray-500 font-medium">Sin notificaciones</p>
                <p className="text-sm text-gray-400 mt-1">Te avisaremos cuando llegue algo nuevo</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => {
                  const colors = NOTIFICATION_COLORS[notification.type];
                  const icon = NOTIFICATION_ICONS[notification.type];
                  const createdAt = notification.createdAt instanceof Date 
                    ? notification.createdAt 
                    : new Date(notification.createdAt);

                  return (
                    <div
                      key={notification.id}
                      className={`
                        relative px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer
                        ${!notification.read ? 'bg-indigo-50/50' : ''}
                      `}
                      onClick={() => {
                        onMarkAsRead(notification.id);
                        if (notification.data?.linkTo) {
                          window.location.href = notification.data.linkTo;
                        }
                      }}
                    >
                      {/* Indicador de no leída */}
                      {!notification.read && (
                        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2 h-2 bg-indigo-500 rounded-full" />
                      )}

                      <div className="flex gap-3">
                        {/* Icono */}
                        <div className={`
                          flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg
                          ${colors.bg}
                        `}>
                          {icon}
                        </div>

                        {/* Contenido */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`font-medium text-sm ${colors.text}`}>
                              {notification.title}
                            </p>
                            <span className="text-xs text-gray-400 whitespace-nowrap">
                              {formatTimeAgo(createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>

                          {/* Info adicional */}
                          {notification.data && (
                            <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                              {notification.data.clientName && (
                                <span className="font-medium">{notification.data.clientName}</span>
                              )}
                              {notification.data.time && (
                                <>
                                  <span>·</span>
                                  <span>{notification.data.time}</span>
                                </>
                              )}
                              {notification.data.daysRemaining !== undefined && (
                                <span className="text-orange-600 font-medium">
                                  {notification.data.daysRemaining} días
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Botón eliminar */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemove(notification.id);
                          }}
                          className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
              <a
                href="/dashboard/notifications"
                className="block text-center text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                Ver todas las notificaciones →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


