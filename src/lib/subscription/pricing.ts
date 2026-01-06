// =============================================================================
// Gestión de Precios Dinámicos
// Los precios se obtienen desde site_config en la DB con fallback a valores default
// =============================================================================

import { supabase } from '../supabase';

/**
 * Valores por defecto de precios (fallback si no hay config en DB)
 */
export const DEFAULT_PRICING = {
  premium_monthly: 4990,
  premium_annual: 49900,
  currency: 'ARS',
  trial_days: 7,
  grace_period_days: 3,
  free_daily_appointments: 5,
} as const;

/**
 * Tipo para la configuración de precios
 */
export interface PricingConfig {
  premium_monthly: number;
  premium_annual: number;
  currency: string;
  trial_days?: number;
  grace_period_days?: number;
  free_daily_appointments?: number;
}

/**
 * Cache de precios para evitar múltiples llamadas a la DB
 */
let pricingCache: PricingConfig | null = DEFAULT_PRICING;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Obtiene los precios desde la base de datos
 * Con cache para evitar llamadas repetidas
 */
export async function getPricing(): Promise<PricingConfig> {
  const now = Date.now();
  
  // Retornar cache si es válido
  if ((now - cacheTimestamp) < CACHE_TTL && pricingCache) {
    return pricingCache;
  }

  try {
    const { data, error } = await supabase
      .from('site_config')
      .select('pricing')
      .eq('id', 'main')
      .single();

    if (error || !data?.pricing) {
      console.warn('No se pudo obtener pricing de DB, usando valores default');
      return DEFAULT_PRICING;
    }

    // Mergear con defaults para asegurar todos los campos
    const newPricing: PricingConfig = {
      ...DEFAULT_PRICING,
      ...data.pricing,
    };
    pricingCache = newPricing;
    cacheTimestamp = now;

    return newPricing;
  } catch (err) {
    console.error('Error obteniendo pricing:', err);
    return DEFAULT_PRICING;
  }
}

/**
 * Obtiene los precios de forma síncrona (usa cache o defaults)
 * Útil para componentes que no pueden usar async
 */
export function getPricingSync(): PricingConfig {
  if (pricingCache && (Date.now() - cacheTimestamp) < CACHE_TTL) {
    return pricingCache;
  }
  return DEFAULT_PRICING;
}

/**
 * Invalida el cache para forzar recarga desde DB
 */
export function invalidatePricingCache(): void {
  pricingCache = null;
  cacheTimestamp = 0;
}

/**
 * Obtiene el precio mensual premium
 */
export async function getPremiumMonthlyPrice(): Promise<number> {
  const pricing = await getPricing();
  return pricing.premium_monthly;
}

/**
 * Obtiene el precio anual premium
 */
export async function getPremiumAnnualPrice(): Promise<number> {
  const pricing = await getPricing();
  return pricing.premium_annual;
}

/**
 * Formatea un precio para mostrar en la UI
 */
export function formatPrice(price: number, currency: string = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Calcula el ahorro del plan anual vs mensual
 */
export function calculateAnnualSavings(monthlyPrice: number, annualPrice: number): {
  amount: number;
  percentage: number;
  monthsFree: number;
} {
  const monthlyTotal = monthlyPrice * 12;
  const savings = monthlyTotal - annualPrice;
  const percentage = Math.round((savings / monthlyTotal) * 100);
  const monthsFree = Math.round(savings / monthlyPrice);
  
  return {
    amount: savings,
    percentage,
    monthsFree,
  };
}
