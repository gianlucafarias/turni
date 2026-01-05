// =============================================================================
// Tipos para el sistema de notificaciones en tiempo real del dashboard
// =============================================================================

export type NotificationType = 
  | 'new_appointment'                // Nuevo turno recibido
  | 'appointment_reminder'           // Recordatorio de turno próximo
  | 'appointment_modified_by_client' // Cliente modificó su turno
  | 'appointment_cancelled_by_client'// Cliente canceló su turno
  | 'daily_summary'                  // Resumen de turnos del día
  | 'subscription_reminder'          // Recordatorio de pago de suscripción
  | 'subscription_expired'           // Suscripción expirada
  | 'subscription_payment_succeeded' // Pago de suscripción aprobado
  | 'subscription_payment_failed'    // Pago de suscripción fallido
  | 'subscription_cancelled'         // Suscripción cancelada
  | 'subscription_downgraded'        // Bajada a plan free
  | 'trial_ending'                   // Trial por terminar
  | 'limit_warning'                  // Cerca del límite (productos, turnos, etc.)
  | 'system'                         // Notificación del sistema
  | 'success'                        // Operación exitosa
  | 'error';                         // Error

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface DashboardNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  read: boolean;
  createdAt: Date;
  
  // Datos adicionales según el tipo
  data?: {
    appointmentId?: string;
    clientName?: string;
    serviceName?: string;
    date?: string;
    time?: string;
    oldDate?: string;
    oldTime?: string;
    newDate?: string;
    newTime?: string;
    changeType?: string;
    daysRemaining?: number;
    currentCount?: number;
    limit?: number;
    linkTo?: string;
  };
  
  // Para toasts
  duration?: number; // ms, 0 = persistente
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface NotificationState {
  notifications: DashboardNotification[];
  unreadCount: number;
  isLoading: boolean;
}

export interface NotificationContextType extends NotificationState {
  // Acciones
  addNotification: (notification: Omit<DashboardNotification, 'id' | 'createdAt' | 'read'>) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  
  // Toast específico
  showToast: (notification: Omit<DashboardNotification, 'id' | 'createdAt' | 'read'>) => void;
}

// Configuración de notificaciones
export const NOTIFICATION_CONFIG = {
  // Duración de toasts por prioridad (ms)
  toastDuration: {
    low: 3000,
    medium: 5000,
    high: 8000,
    urgent: 0, // Persistente hasta que se cierre
  },
  
  // Máximo de notificaciones en el centro
  maxNotifications: 50,
  
  // Intervalo para verificar notificaciones programadas (ms)
  checkInterval: 60000, // 1 minuto
  
  // Días antes del pago para recordatorio
  subscriptionReminderDays: 5,
  
  // Porcentaje del límite para advertencia
  limitWarningThreshold: 0.8, // 80%
} as const;

// Iconos por tipo de notificación
export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  new_appointment: '📅',
  appointment_reminder: '⏰',
  appointment_modified_by_client: '✏️',
  appointment_cancelled_by_client: '❌',
  daily_summary: '📊',
  subscription_reminder: '💳',
  subscription_expired: '⚠️',
  subscription_payment_succeeded: '✅',
  subscription_payment_failed: '⚠️',
  subscription_cancelled: '🧾',
  subscription_downgraded: '⬇️',
  trial_ending: '⏳',
  limit_warning: '📈',
  system: '🔔',
  success: '✅',
  error: '❌',
};

// Colores por tipo
export const NOTIFICATION_COLORS: Record<NotificationType, { bg: string; border: string; text: string }> = {
  new_appointment: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800' },
  appointment_reminder: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' },
  appointment_modified_by_client: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800' },
  appointment_cancelled_by_client: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800' },
  daily_summary: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800' },
  subscription_reminder: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800' },
  subscription_expired: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800' },
   subscription_payment_succeeded: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
   subscription_payment_failed: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800' },
   subscription_cancelled: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800' },
   subscription_downgraded: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800' },
  trial_ending: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800' },
  limit_warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800' },
  system: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800' },
  success: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
  error: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800' },
};

