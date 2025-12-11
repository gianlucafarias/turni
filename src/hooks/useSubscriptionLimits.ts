// =============================================================================
// Hook para verificar límites de suscripción
// =============================================================================

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  FREE_LIMITS, 
  PREMIUM_LIMITS, 
  type PlanId,
  type PlanLimits 
} from '../lib/subscription';

interface SubscriptionLimits {
  planId: PlanId;
  limits: PlanLimits;
  isPremium: boolean;
  loading: boolean;
  // Contadores actuales
  counts: {
    products: number;
    services: number;
    clients: number;
    appointmentsThisMonth: number;
  };
  // Verificadores de límites
  canAddProduct: boolean;
  canAddService: boolean;
  canAccessClients: boolean;
  canAddAppointment: boolean;
  // Funciones helper
  checkLimit: (type: 'products' | 'services' | 'clients' | 'appointments') => {
    allowed: boolean;
    current: number;
    max: number;
    remaining: number;
  };
}

export function useSubscriptionLimits(): SubscriptionLimits {
  const [planId, setPlanId] = useState<PlanId>('free');
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({
    products: 0,
    services: 0,
    clients: 0,
    appointmentsThisMonth: 0,
  });

  useEffect(() => {
    loadSubscriptionAndCounts();
  }, []);

  async function loadSubscriptionAndCounts() {
    try {
      setLoading(true);

      // Obtener sesión
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      // Obtener tienda
      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      if (!store) {
        setLoading(false);
        return;
      }

      // Obtener suscripción
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan_id, status')
        .eq('store_id', store.id)
        .single();

      if (subscription && subscription.status === 'active') {
        setPlanId(subscription.plan_id as PlanId);
      }

      // Contar productos
      const { count: productCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', store.id);

      // Contar servicios
      const { count: serviceCount } = await supabase
        .from('services')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', store.id);

      // Contar clientes
      const { count: clientCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', store.id);

      // Contar turnos del mes actual
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { count: appointmentCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', store.id)
        .gte('date', startOfMonth.toISOString());

      setCounts({
        products: productCount || 0,
        services: serviceCount || 0,
        clients: clientCount || 0,
        appointmentsThisMonth: appointmentCount || 0,
      });

    } catch (error) {
      console.error('Error loading subscription limits:', error);
    } finally {
      setLoading(false);
    }
  }

  const isPremium = planId === 'premium' || planId === 'premium_annual' || planId === 'trial';
  const limits = isPremium ? PREMIUM_LIMITS : FREE_LIMITS;

  const checkLimit = (type: 'products' | 'services' | 'clients' | 'appointments') => {
    const limitMap = {
      products: { current: counts.products, max: limits.maxProducts },
      services: { current: counts.services, max: limits.maxServices },
      clients: { current: counts.clients, max: limits.maxClients },
      appointments: { current: counts.appointmentsThisMonth, max: limits.maxAppointmentsPerMonth },
    };

    const { current, max } = limitMap[type];
    const unlimited = max === -1;
    const allowed = unlimited || current < max;
    const remaining = unlimited ? Infinity : Math.max(0, max - current);

    return { allowed, current, max, remaining };
  };

  return {
    planId,
    limits,
    isPremium,
    loading,
    counts,
    canAddProduct: checkLimit('products').allowed,
    canAddService: checkLimit('services').allowed,
    canAccessClients: isPremium || limits.maxClients > 0,
    canAddAppointment: checkLimit('appointments').allowed,
    checkLimit,
  };
}



