// =============================================================================
// Hook useNotifications
// Proporciona acceso al sistema de notificaciones y funciones útiles
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { DashboardNotification, NotificationType } from '../types/notifications';

interface UseNotificationsOptions {
  storeId?: string;
  autoConnect?: boolean;
}

interface UseNotificationsReturn {
  // Estado
  notifications: DashboardNotification[];
  unreadCount: number;
  isConnected: boolean;
  
  // Acciones
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  notify: (type: NotificationType, title: string, message: string, data?: DashboardNotification['data']) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  
  // Para integración con el contexto
  addNotification: (notification: Omit<DashboardNotification, 'id' | 'createdAt' | 'read'>) => void;
}

// Hook simplificado para uso sin provider (standalone)
export function useNotificationsStandalone(options: UseNotificationsOptions = {}): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  const generateId = () => `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addNotification = useCallback((notification: Omit<DashboardNotification, 'id' | 'createdAt' | 'read'>) => {
    const newNotification: DashboardNotification = {
      ...notification,
      id: generateId(),
      createdAt: new Date(),
      read: false,
    };

    setNotifications(prev => [newNotification, ...prev].slice(0, 50));
  }, []);

  const showSuccess = useCallback((message: string, title = '¡Listo!') => {
    addNotification({
      type: 'success',
      title,
      message,
      priority: 'low',
      duration: 3000,
    });
  }, [addNotification]);

  const showError = useCallback((message: string, title = 'Error') => {
    addNotification({
      type: 'error',
      title,
      message,
      priority: 'high',
      duration: 5000,
    });
  }, [addNotification]);

  const showInfo = useCallback((message: string, title = 'Información') => {
    addNotification({
      type: 'system',
      title,
      message,
      priority: 'medium',
      duration: 4000,
    });
  }, [addNotification]);

  const notify = useCallback((
    type: NotificationType,
    title: string,
    message: string,
    data?: DashboardNotification['data']
  ) => {
    addNotification({
      type,
      title,
      message,
      priority: 'medium',
      data,
    });
  }, [addNotification]);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Suscripción a Supabase Realtime
  useEffect(() => {
    if (!options.storeId || !options.autoConnect) return;

    const channel = supabase
      .channel(`notifications:${options.storeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments',
          filter: `store_id=eq.${options.storeId}`,
        },
        (payload) => {
          const appointment = payload.new as {
            id: string;
            client_name: string;
            service_name?: string;
            date: string;
            time: string;
          };

          addNotification({
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
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [options.storeId, options.autoConnect, addNotification]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    isConnected,
    showSuccess,
    showError,
    showInfo,
    notify,
    markAsRead,
    markAllAsRead,
    clearAll,
    addNotification,
  };
}

// Hook para usar con store ID dinámico (obtiene store del usuario actual)
export function useStoreNotifications() {
  const [storeId, setStoreId] = useState<string | null>(null);
  const notifications = useNotificationsStandalone({ 
    storeId: storeId || undefined, 
    autoConnect: !!storeId 
  });

  useEffect(() => {
    async function getStoreId() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      if (store) {
        setStoreId(store.id);
      }
    }

    getStoreId();
  }, []);

  return { ...notifications, storeId };
}

// Función helper para obtener el conteo de turnos del día
export async function getTodayAppointmentsSummary(storeId: string) {
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('appointments')
    .select('id, status')
    .eq('store_id', storeId)
    .eq('date', today);

  if (error) throw error;

  const appointments = data || [];
  
  return {
    total: appointments.length,
    pending: appointments.filter(a => a.status === 'pending').length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
  };
}

// Función helper para obtener info de próximo pago
export async function getSubscriptionPaymentInfo(storeId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan_id, status, current_period_end, trial_ends_at')
    .eq('store_id', storeId)
    .single();

  if (error) return null;

  const today = new Date();
  let daysUntilPayment = null;
  let daysUntilTrialEnd = null;

  if (data.current_period_end) {
    const endDate = new Date(data.current_period_end);
    daysUntilPayment = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  if (data.trial_ends_at && data.status === 'trial') {
    const trialEnd = new Date(data.trial_ends_at);
    daysUntilTrialEnd = Math.ceil((trialEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  return {
    planId: data.plan_id,
    status: data.status,
    daysUntilPayment,
    daysUntilTrialEnd,
    isPremium: ['premium', 'premium_annual'].includes(data.plan_id) && data.status === 'active',
    isTrialActive: data.status === 'trial' && daysUntilTrialEnd !== null && daysUntilTrialEnd > 0,
  };
}

