// =============================================================================
// Provider de Notificaciones
// Maneja el estado global de notificaciones y la conexión con Supabase Realtime
// =============================================================================

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '../../../lib/supabase';
import type { 
  DashboardNotification, 
  NotificationContextType, 
  NotificationType 
} from '../../../types/notifications';
import { NOTIFICATION_CONFIG } from '../../../types/notifications';
import { ToastContainer } from './Toast';

const NotificationContext = createContext<NotificationContextType | null>(null);

// Hook para usar el contexto
export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext debe usarse dentro de NotificationProvider');
  }
  return context;
}

interface NotificationProviderProps {
  children: ReactNode;
  storeId?: string;
}

export function NotificationProvider({ children, storeId }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [toasts, setToasts] = useState<DashboardNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generar ID único
  const generateId = () => `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Agregar notificación
  const addNotification = useCallback((notification: Omit<DashboardNotification, 'id' | 'createdAt' | 'read'>) => {
    const newNotification: DashboardNotification = {
      ...notification,
      id: generateId(),
      createdAt: new Date(),
      read: false,
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      // Mantener solo las últimas N notificaciones
      return updated.slice(0, NOTIFICATION_CONFIG.maxNotifications);
    });

    // Guardar en localStorage para persistencia
    saveToLocalStorage(newNotification);
  }, []);

  // Mostrar toast
  const showToast = useCallback((notification: Omit<DashboardNotification, 'id' | 'createdAt' | 'read'>) => {
    const newNotification: DashboardNotification = {
      ...notification,
      id: generateId(),
      createdAt: new Date(),
      read: false,
    };

    // Agregar a la lista de notificaciones también
    addNotification(notification);

    // Mostrar toast
    setToasts(prev => [...prev, newNotification]);
  }, [addNotification]);

  // Remover toast
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Remover notificación
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    removeFromLocalStorage(id);
  }, []);

  // Marcar como leída
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    updateInLocalStorage(id, { read: true });
  }, []);

  // Marcar todas como leídas
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    markAllReadInLocalStorage();
  }, []);

  // Limpiar todas
  const clearAll = useCallback(() => {
    setNotifications([]);
    clearLocalStorage();
  }, []);

  // Calcular no leídas
  const unreadCount = notifications.filter(n => !n.read).length;

  // Suscribirse a cambios en turnos (Supabase Realtime)
  useEffect(() => {
    if (!storeId) return;

    // Cargar notificaciones guardadas
    loadFromLocalStorage();
    setIsLoading(false);

    // Suscribirse a nuevos turnos
    const channel = supabase
      .channel(`appointments:${storeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments',
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          const appointment = payload.new as {
            id: string;
            client_name: string;
            service_name?: string;
            date: string;
            time: string;
          };

          // Mostrar toast de nuevo turno
          showToast({
            type: 'new_appointment',
            title: '¡Nuevo turno!',
            message: `${appointment.client_name} reservó un turno`,
            priority: 'high',
            data: {
              appointmentId: appointment.id,
              clientName: appointment.client_name,
              serviceName: appointment.service_name,
              date: appointment.date,
              time: appointment.time,
              linkTo: `/dashboard/appointments/${appointment.id}`,
            },
          });

          // Reproducir sonido de notificación
          playNotificationSound();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          const oldData = payload.old as { status: string; date: string; time: string; modified_by_client?: boolean }
          const newData = payload.new as { status: string; id: string; client_name: string; date: string; time: string; modified_by_client?: boolean; service_name?: string }
          
          // Detectar si fue modificado por el cliente
          if (newData.modified_by_client) {
            const oldStatus = oldData.status
            const newStatus = newData.status
            
            // Cliente canceló el turno
            if (oldStatus !== 'cancelled' && newStatus === 'cancelled') {
              showToast({
                type: 'appointment_cancelled_by_client',
                title: 'Turno cancelado por cliente',
                message: `${newData.client_name} canceló su turno`,
                priority: 'high',
                data: {
                  appointmentId: newData.id,
                  clientName: newData.client_name,
                  serviceName: newData.service_name,
                  date: oldData.date,
                  time: oldData.time,
                  linkTo: `/dashboard/appointments/${newData.id}`,
                },
              })
              playNotificationSound()
            }
            // Cliente modificó fecha/hora
            else if (oldData.date !== newData.date || oldData.time !== newData.time) {
              // Formatear fechas y horas para el mensaje
              const formatDate = (dateStr: string) => {
                if (!dateStr) return 'fecha desconocida';
                const date = new Date(dateStr + 'T12:00:00');
                return date.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
              };
              const formatTime = (timeStr: string) => {
                if (!timeStr) return 'hora desconocida';
                return timeStr.substring(0, 5);
              };
              
              showToast({
                type: 'appointment_modified_by_client',
                title: 'Turno modificado por cliente',
                message: `${newData.client_name} cambió su turno del ${formatDate(oldData.date || '')} ${formatTime(oldData.time || '')} al ${formatDate(newData.date)} ${formatTime(newData.time)}`,
                priority: 'high',
                data: {
                  appointmentId: newData.id,
                  clientName: newData.client_name,
                  serviceName: newData.service_name,
                  oldDate: oldData.date || '',
                  oldTime: oldData.time || '',
                  newDate: newData.date,
                  newTime: newData.time,
                  linkTo: `/dashboard/appointments/${newData.id}`,
                },
              })
              playNotificationSound()
            }
          }
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    // Verificar notificaciones programadas periódicamente
    checkScheduledNotifications(storeId, addNotification, showToast);
    checkIntervalRef.current = setInterval(
      () => checkScheduledNotifications(storeId, addNotification, showToast),
      NOTIFICATION_CONFIG.checkInterval
    );

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [storeId, showToast, addNotification]);

  const contextValue: NotificationContextType = {
    notifications,
    unreadCount,
    isLoading,
    addNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    showToast,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} onMarkAsRead={markAsRead} />
    </NotificationContext.Provider>
  );
}

// =============================================================================
// Funciones auxiliares
// =============================================================================

const STORAGE_KEY = 'dashboard_notifications';

function loadFromLocalStorage(): DashboardNotification[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    return parsed.map((n: DashboardNotification) => ({
      ...n,
      createdAt: new Date(n.createdAt),
    }));
  } catch {
    return [];
  }
}

function saveToLocalStorage(notification: DashboardNotification) {
  try {
    const existing = loadFromLocalStorage();
    const updated = [notification, ...existing].slice(0, NOTIFICATION_CONFIG.maxNotifications);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignorar errores de storage
  }
}

function removeFromLocalStorage(id: string) {
  try {
    const existing = loadFromLocalStorage();
    const updated = existing.filter(n => n.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignorar
  }
}

function updateInLocalStorage(id: string, updates: Partial<DashboardNotification>) {
  try {
    const existing = loadFromLocalStorage();
    const updated = existing.map(n => n.id === id ? { ...n, ...updates } : n);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignorar
  }
}

function markAllReadInLocalStorage() {
  try {
    const existing = loadFromLocalStorage();
    const updated = existing.map(n => ({ ...n, read: true }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignorar
  }
}

function clearLocalStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignorar
  }
}

function playNotificationSound() {
  try {
    // Crear un sonido simple de notificación
    const audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.1;

    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      audioContext.close();
    }, 150);
  } catch {
    // Ignorar si no se puede reproducir sonido
  }
}

// Verificar notificaciones programadas
async function checkScheduledNotifications(
  storeId: string,
  addNotification: (n: Omit<DashboardNotification, 'id' | 'createdAt' | 'read'>) => void,
  showToast: (n: Omit<DashboardNotification, 'id' | 'createdAt' | 'read'>) => void
) {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const currentHour = today.getHours();

    // Solo mostrar resumen del día a las 8-9 AM
    const lastDailySummary = localStorage.getItem(`daily_summary_${storeId}_${todayStr}`);
    
    if (currentHour >= 8 && currentHour < 10 && !lastDailySummary) {
      // Obtener turnos del día
      const { data: todayAppointments } = await supabase
        .from('appointments')
        .select('id, client_name, time, service_name, status')
        .eq('store_id', storeId)
        .eq('date', todayStr)
        .in('status', ['pending', 'confirmed'])
        .order('time', { ascending: true });

      if (todayAppointments && todayAppointments.length > 0) {
        const pendingCount = todayAppointments.filter(a => a.status === 'pending').length;
        const confirmedCount = todayAppointments.filter(a => a.status === 'confirmed').length;
        
        showToast({
          type: 'daily_summary',
          title: '📅 Turnos de hoy',
          message: `Tenés ${todayAppointments.length} turno${todayAppointments.length !== 1 ? 's' : ''} hoy${pendingCount > 0 ? ` (${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''})` : ''}`,
          priority: 'medium',
          data: {
            linkTo: '/dashboard/appointments',
          },
        });

        localStorage.setItem(`daily_summary_${storeId}_${todayStr}`, 'shown');
      }
    }

    // Verificar suscripción próxima a vencer
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan_id, status, current_period_end')
      .eq('store_id', storeId)
      .single();

    if (subscription && subscription.current_period_end && subscription.status === 'active') {
      const endDate = new Date(subscription.current_period_end);
      const daysUntilEnd = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      const lastPaymentReminder = localStorage.getItem(`payment_reminder_${storeId}_${subscription.current_period_end}`);
      
      if (daysUntilEnd <= NOTIFICATION_CONFIG.subscriptionReminderDays && daysUntilEnd > 0 && !lastPaymentReminder) {
        showToast({
          type: 'subscription_reminder',
          title: '💳 Próximo pago',
          message: `Tu suscripción se renueva en ${daysUntilEnd} día${daysUntilEnd !== 1 ? 's' : ''}`,
          priority: 'medium',
          data: {
            daysRemaining: daysUntilEnd,
            linkTo: '/dashboard/subscription',
          },
        });

        localStorage.setItem(`payment_reminder_${storeId}_${subscription.current_period_end}`, 'shown');
      }
    }

    // Verificar trial por terminar
    const { data: trial } = await supabase
      .from('subscriptions')
      .select('plan_id, status, trial_ends_at')
      .eq('store_id', storeId)
      .eq('status', 'trial')
      .single();

    if (trial && trial.trial_ends_at) {
      const trialEnd = new Date(trial.trial_ends_at);
      const daysUntilTrialEnd = Math.ceil((trialEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      const lastTrialReminder = localStorage.getItem(`trial_reminder_${storeId}_${daysUntilTrialEnd}`);
      
      if (daysUntilTrialEnd <= 3 && daysUntilTrialEnd > 0 && !lastTrialReminder) {
        showToast({
          type: 'trial_ending',
          title: '⏳ Tu prueba termina pronto',
          message: `Quedan ${daysUntilTrialEnd} día${daysUntilTrialEnd !== 1 ? 's' : ''} de prueba gratuita`,
          priority: 'high',
          data: {
            daysRemaining: daysUntilTrialEnd,
            linkTo: '/dashboard/subscription',
          },
        });

        localStorage.setItem(`trial_reminder_${storeId}_${daysUntilTrialEnd}`, 'shown');
      }
    }

  } catch (error) {
    console.error('Error checking scheduled notifications:', error);
  }
}

