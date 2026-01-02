// =============================================================================
// Componente Toast para notificaciones emergentes
// Estilo moderno con animaciones suaves
// =============================================================================

import { useEffect, useState } from 'react';
import type { DashboardNotification } from '../../../types/notifications';
import { NOTIFICATION_ICONS, NOTIFICATION_COLORS, NOTIFICATION_CONFIG } from '../../../types/notifications';

interface ToastProps {
  notification: DashboardNotification;
  onClose: () => void;
  onMarkAsRead: () => void;
  index: number;
}

export function Toast({ notification, onClose, onMarkAsRead, index }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const colors = NOTIFICATION_COLORS[notification.type];
  const icon = NOTIFICATION_ICONS[notification.type];
  const duration = notification.duration ?? NOTIFICATION_CONFIG.toastDuration[notification.priority];

  useEffect(() => {
    // Animar entrada
    const enterTimer = setTimeout(() => setIsVisible(true), 50);

    // Auto-cerrar si tiene duración
    let closeTimer: ReturnType<typeof setTimeout>;
    if (duration > 0) {
      closeTimer = setTimeout(() => {
        handleClose();
      }, duration);
    }

    return () => {
      clearTimeout(enterTimer);
      if (closeTimer) clearTimeout(closeTimer);
    };
  }, [duration]);

  const handleClose = () => {
    setIsLeaving(true);
    onMarkAsRead(); // Marcar como leída al cerrar
    setTimeout(onClose, 300); // Esperar animación de salida
  };

  const handleClick = () => {
    onMarkAsRead(); // Marcar como leída
    if (notification.data?.linkTo) {
      window.location.href = notification.data.linkTo;
    }
    handleClose();
  };

  return (
    <div
      className={`
        fixed right-4 z-[100] w-full max-w-sm cursor-pointer
        transform transition-all duration-300 ease-out
        ${isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
      style={{ bottom: `${24 + index * 110}px` }}
      role="alert"
      aria-live="polite"
      onClick={handleClick}
    >
      <div
        className={`
          ${colors.bg} ${colors.border} border
          rounded-2xl shadow-xl backdrop-blur-sm
          overflow-hidden hover:shadow-2xl transition-shadow
        `}
      >
        {/* Barra de progreso para toasts con duración */}
        {duration > 0 && (
          <div className="h-1 bg-black/5 overflow-hidden">
            <div
              className={`h-full ${notification.type === 'error' ? 'bg-red-500' : 'bg-indigo-500'}`}
              style={{
                animation: `shrink ${duration}ms linear forwards`,
              }}
            />
          </div>
        )}

        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icono */}
            <div className={`
              flex-shrink-0 w-10 h-10 rounded-xl
              flex items-center justify-center text-xl
              ${notification.type === 'new_appointment' ? 'bg-blue-100' : ''}
              ${notification.type === 'success' ? 'bg-emerald-100' : ''}
              ${notification.type === 'error' ? 'bg-red-100' : ''}
              ${notification.type === 'subscription_reminder' ? 'bg-orange-100' : ''}
              ${notification.type === 'daily_summary' ? 'bg-indigo-100' : ''}
              ${!['new_appointment', 'success', 'error', 'subscription_reminder', 'daily_summary'].includes(notification.type) ? 'bg-gray-100' : ''}
            `}>
              {icon}
            </div>

            {/* Contenido */}
            <div className="flex-1 min-w-0">
              <p className={`font-semibold ${colors.text}`}>
                {notification.title}
              </p>
              <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                {notification.message}
              </p>

              {/* Datos adicionales */}
              {notification.data?.clientName && (
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                  <span className="font-medium">{notification.data.clientName}</span>
                  {notification.data.time && (
                    <>
                      <span>·</span>
                      <span>{notification.data.time}</span>
                    </>
                  )}
                </div>
              )}

              {/* Acción */}
              {notification.action && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    notification.action!.onClick();
                    handleClose();
                  }}
                  className="mt-3 px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {notification.action.label}
                </button>
              )}

              {/* Link indicador */}
              {notification.data?.linkTo && !notification.action && (
                <span className="inline-block mt-3 text-sm font-medium text-indigo-600">
                  Click para ver detalles →
                </span>
              )}
            </div>

            {/* Botón cerrar */}
            <button
              onClick={(e) => {
                e.stopPropagation(); // Evitar que el click cierre Y navegue
                handleClose();
              }}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Cerrar notificación"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Animación de la barra de progreso */}
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

// Contenedor de toasts
interface ToastContainerProps {
  toasts: DashboardNotification[];
  removeToast: (id: string) => void;
  onMarkAsRead: (id: string) => void;
}

export function ToastContainer({ toasts, removeToast, onMarkAsRead }: ToastContainerProps) {
  return (
    <>
      {toasts.map((toast, index) => (
        <Toast
          key={toast.id}
          notification={toast}
          onClose={() => removeToast(toast.id)}
          onMarkAsRead={() => onMarkAsRead(toast.id)}
          index={index}
        />
      ))}
    </>
  );
}