// =============================================================================
// NotificationBell - Componente wrapper que maneja su propio estado
// Incluye la conexión a Supabase Realtime automáticamente
// =============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import type { DashboardNotification } from '../../../types/notifications';
import { NOTIFICATION_CONFIG } from '../../../types/notifications';
import { NotificationCenter } from './NotificationCenter';
import { ToastContainer } from './Toast';

interface NotificationBellProps {
  storeId: string;
}

const STORAGE_KEY = 'dashboard_notifications';
const DEBUG = true; // Activar para ver logs en consola

function debugLog(...args: unknown[]) {
  if (DEBUG) {
    console.log('[NotificationBell]', ...args);
  }
}

export function NotificationBell({ storeId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [toasts, setToasts] = useState<DashboardNotification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAppointmentCountRef = useRef<number | null>(null);

  // Generar ID único
  const generateId = () => `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Cargar notificaciones desde localStorage
  const loadFromStorage = useCallback((): DashboardNotification[] => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}_${storeId}`);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return parsed.map((n: DashboardNotification) => ({
        ...n,
        createdAt: new Date(n.createdAt),
      }));
    } catch {
      return [];
    }
  }, [storeId]);

  // Guardar en localStorage
  const saveToStorage = useCallback((notifs: DashboardNotification[]) => {
    try {
      localStorage.setItem(
        `${STORAGE_KEY}_${storeId}`,
        JSON.stringify(notifs.slice(0, NOTIFICATION_CONFIG.maxNotifications))
      );
    } catch {
      // Ignorar errores de storage
    }
  }, [storeId]);

  // Agregar notificación y mostrar toast
  const addNotification = useCallback((notification: Omit<DashboardNotification, 'id' | 'createdAt' | 'read'>) => {
    const newNotification: DashboardNotification = {
      ...notification,
      id: generateId(),
      createdAt: new Date(),
      read: false,
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev].slice(0, NOTIFICATION_CONFIG.maxNotifications);
      saveToStorage(updated);
      return updated;
    });

    // Mostrar toast
    setToasts(prev => [...prev, newNotification]);

    // Reproducir sonido
    playNotificationSound();
  }, [saveToStorage]);

  // Remover toast
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Remover notificación
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Marcar como leída
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Marcar todas como leídas
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Limpiar todas
  const clearAll = useCallback(() => {
    setNotifications([]);
    try {
      localStorage.removeItem(`${STORAGE_KEY}_${storeId}`);
    } catch {
      // Ignorar
    }
  }, [storeId]);

  // Cargar notificaciones guardadas al iniciar
  useEffect(() => {
    const saved = loadFromStorage();
    setNotifications(saved);
  }, [loadFromStorage]);

  // Suscribirse a Supabase Realtime + Polling fallback
  useEffect(() => {
    if (!storeId) return;

    debugLog('Iniciando sistema de notificaciones para store:', storeId);

    // Obtener conteo inicial de turnos para el polling
    async function getInitialCount() {
      const { count } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId);
      
      lastAppointmentCountRef.current = count || 0;
      debugLog('Conteo inicial de turnos:', count);
    }
    getInitialCount();

    // Suscribirse a nuevos turnos via Realtime
    const channelName = `appointments_realtime_${storeId}_${Date.now()}`;
    debugLog('Creando canal:', channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments',
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          debugLog('🔔 Nuevo turno detectado via Realtime!', payload);
          
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
              linkTo: `/dashboard/appointments`,
            },
          });
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
              addNotification({
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
            }
            // Cliente modificó fecha/hora
            else if (oldData.date !== newData.date || oldData.time !== newData.time) {
              debugLog('🔔 Turno modificado por cliente detectado!', { oldData, newData });
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
              
              addNotification({
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
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*', // Escuchar todos los eventos para debug
          schema: 'public',
          table: 'appointments',
        },
        (payload) => {
          debugLog('📡 Evento en appointments:', payload.eventType, payload);
        }
      )
      .subscribe((status, err) => {
        debugLog('Estado de suscripción Realtime:', status, err || '');
        setIsConnected(status === 'SUBSCRIBED');
        
        if (status === 'SUBSCRIBED') {
          debugLog('✅ Conectado a Realtime exitosamente');
        } else if (status === 'CHANNEL_ERROR') {
          debugLog('❌ Error en el canal Realtime, activando polling fallback');
        }
      });

    subscriptionRef.current = channel;

    // FALLBACK: Polling cada 30 segundos para detectar cambios en turnos
    // Esto funciona incluso si Realtime no está habilitado en Supabase
    let lastCheckedAppointments: Map<string, { date: string; time: string; status: string; modified_by_client?: boolean }> = new Map();
    
    async function checkAppointmentChanges() {
      try {
        // Obtener todos los turnos recientes (últimos 7 días)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const { data: appointments, error } = await supabase
          .from('appointments')
          .select('id, date, time, status, modified_by_client, client_name, service_name')
          .eq('store_id', storeId)
          .gte('date', sevenDaysAgo.toISOString().split('T')[0]);
        
        if (error) {
          debugLog('Error en polling de turnos:', error);
          return;
        }

        // Comparar con el estado anterior
        appointments?.forEach(apt => {
          const lastState = lastCheckedAppointments.get(apt.id);
          
          // Si es la primera vez que lo vemos, guardar estado
          if (!lastState) {
            lastCheckedAppointments.set(apt.id, {
              date: apt.date,
              time: apt.time,
              status: apt.status,
              modified_by_client: apt.modified_by_client
            });
            return;
          }

          // Detectar cambios hechos por el cliente
          if (apt.modified_by_client && !lastState.modified_by_client) {
            // Cliente canceló
            if (apt.status === 'cancelled' && lastState.status !== 'cancelled') {
              debugLog('🔔 [Polling] Turno cancelado por cliente detectado!', apt);
              addNotification({
                type: 'appointment_cancelled_by_client',
                title: 'Turno cancelado por cliente',
                message: `${apt.client_name} canceló su turno`,
                priority: 'high',
                data: {
                  appointmentId: apt.id,
                  clientName: apt.client_name,
                  serviceName: apt.service_name,
                  date: lastState.date,
                  time: lastState.time,
                  linkTo: `/dashboard/appointments/${apt.id}`,
                },
              });
            }
            // Cliente modificó fecha/hora
            else if ((apt.date !== lastState.date || apt.time !== lastState.time) && apt.status !== 'cancelled') {
              debugLog('🔔 [Polling] Turno modificado por cliente detectado!', { lastState, current: apt });
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
              
              addNotification({
                type: 'appointment_modified_by_client',
                title: 'Turno modificado por cliente',
                message: `${apt.client_name} cambió su turno del ${formatDate(lastState.date)} ${formatTime(lastState.time)} al ${formatDate(apt.date)} ${formatTime(apt.time)}`,
                priority: 'high',
                data: {
                  appointmentId: apt.id,
                  clientName: apt.client_name,
                  serviceName: apt.service_name,
                  oldDate: lastState.date,
                  oldTime: lastState.time,
                  newDate: apt.date,
                  newTime: apt.time,
                  linkTo: `/dashboard/appointments/${apt.id}`,
                },
              });
            }
          }

          // Actualizar estado guardado
          lastCheckedAppointments.set(apt.id, {
            date: apt.date,
            time: apt.time,
            status: apt.status,
            modified_by_client: apt.modified_by_client
          });
        });

        // Limpiar turnos antiguos del mapa
        const appointmentIds = new Set(appointments?.map(a => a.id) || []);
        lastCheckedAppointments.forEach((_, id) => {
          if (!appointmentIds.has(id)) {
            lastCheckedAppointments.delete(id);
          }
        });
      } catch (error) {
        debugLog('Error en polling:', error);
      }
    }

    // Iniciar polling como fallback (cada 10 segundos)
    pollingRef.current = setInterval(checkAppointmentChanges, 30000);
    debugLog('Polling fallback activado (cada 30s)');

    // Verificar notificaciones programadas
    checkScheduledNotifications();
    checkIntervalRef.current = setInterval(
      checkScheduledNotifications,
      NOTIFICATION_CONFIG.checkInterval
    );

    return () => {
      debugLog('Limpiando suscripciones...');
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [storeId, addNotification]);

  // Verificar notificaciones programadas
  async function checkScheduledNotifications() {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const currentHour = today.getHours();

      // Solo mostrar resumen del día entre 8-10 AM
      const lastDailySummary = localStorage.getItem(`daily_summary_${storeId}_${todayStr}`);

      if (currentHour >= 8 && currentHour < 10 && !lastDailySummary) {
        const { data: todayAppointments } = await supabase
          .from('appointments')
          .select('id, client_name, time, service_name, status')
          .eq('store_id', storeId)
          .eq('date', todayStr)
          .in('status', ['pending', 'confirmed'])
          .order('time', { ascending: true });

        if (todayAppointments && todayAppointments.length > 0) {
          const pendingCount = todayAppointments.filter(a => a.status === 'pending').length;

          addNotification({
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

      // Verificar próximo pago de suscripción
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan_id, status, current_period_end, trial_ends_at')
        .eq('store_id', storeId)
        .single();

      if (subscription) {
        // Suscripción próxima a vencer
        if (subscription.current_period_end && subscription.status === 'active') {
          const endDate = new Date(subscription.current_period_end);
          const daysUntilEnd = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const lastPaymentReminder = localStorage.getItem(`payment_reminder_${storeId}_${todayStr}`);

          if (daysUntilEnd <= NOTIFICATION_CONFIG.subscriptionReminderDays && daysUntilEnd > 0 && !lastPaymentReminder) {
            addNotification({
              type: 'subscription_reminder',
              title: '💳 Próximo pago',
              message: `Tu suscripción se renueva en ${daysUntilEnd} día${daysUntilEnd !== 1 ? 's' : ''}`,
              priority: 'medium',
              data: {
                daysRemaining: daysUntilEnd,
                linkTo: '/dashboard/subscription',
              },
            });

            localStorage.setItem(`payment_reminder_${storeId}_${todayStr}`, 'shown');
          }
        }

        // Trial por terminar
        if (subscription.trial_ends_at && subscription.status === 'trial') {
          const trialEnd = new Date(subscription.trial_ends_at);
          const daysUntilTrialEnd = Math.ceil((trialEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const lastTrialReminder = localStorage.getItem(`trial_reminder_${storeId}_${daysUntilTrialEnd}`);

          if (daysUntilTrialEnd <= 3 && daysUntilTrialEnd > 0 && !lastTrialReminder) {
            addNotification({
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
      }
    } catch (error) {
      console.error('Error checking scheduled notifications:', error);
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  // Debug: mostrar estado en consola al cambiar
  useEffect(() => {
    debugLog('Estado actual:', {
      notifications: notifications.length,
      unread: unreadCount,
      connected: isConnected,
      storeId,
    });
  }, [notifications.length, unreadCount, isConnected, storeId]);

  return (
    <>
      <div className="relative">
        <NotificationCenter
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onClearAll={clearAll}
          onRemove={removeNotification}
        />
        
      </div>
      <ToastContainer toasts={toasts} removeToast={removeToast} onMarkAsRead={markAsRead} />
    </>
  );
}

// Reproducir sonido de notificación
function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const audioContext = new AudioContextClass();
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

