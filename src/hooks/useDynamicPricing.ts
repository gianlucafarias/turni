// =============================================================================
// Hook para obtener precios dinámicos
// Consulta la API de pricing y cachea los resultados
// =============================================================================

import { useState, useEffect } from 'react';
import { PLANS } from '../lib/subscription';
import type { PricingResponse } from '../pages/api/pricing';

interface UseDynamicPricingResult {
  pricing: PricingResponse['pricing'] | null;
  plans: PricingResponse['plans'] | null;
  savings: PricingResponse['savings'] | null;
  isLoading: boolean;
  error: string | null;
  // Helpers formateados
  formattedMonthlyPrice: string;
  formattedAnnualPrice: string;
  formattedAnnualMonthlyPrice: string;
  trialDays: number;
}

// Cache global para evitar múltiples requests
let cachedPricing: PricingResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Fallback values basados en PLANS estáticos
const FALLBACK_PRICING: PricingResponse = {
  pricing: {
    premium_monthly: PLANS.premium.priceMonthly,
    premium_annual: PLANS.premium_annual.priceAnnual || 49900,
    currency: 'ARS',
    trial_days: 7,
    grace_period_days: 3,
    free_daily_appointments: 5,
  },
  plans: {
    free: { priceMonthly: 0 },
    trial: { priceMonthly: 0, trialDays: 7 },
    premium: { priceMonthly: PLANS.premium.priceMonthly },
    premium_annual: { 
      priceMonthly: PLANS.premium_annual.priceMonthly,
      priceAnnual: PLANS.premium_annual.priceAnnual || 49900
    },
  },
  savings: {
    amount: 0,
    percentage: 16,
    monthsFree: 2,
  },
};

function formatPrice(amount: number): string {
  return `$${amount.toLocaleString('es-AR')}`;
}

export function useDynamicPricing(): UseDynamicPricingResult {
  const [data, setData] = useState<PricingResponse | null>(cachedPricing);
  const [isLoading, setIsLoading] = useState(!cachedPricing);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const now = Date.now();
    
    // Si tenemos cache válido, usarlo
    if (cachedPricing && (now - cacheTimestamp) < CACHE_TTL) {
      setData(cachedPricing);
      setIsLoading(false);
      return;
    }

    // Fetch nuevos precios
    async function fetchPricing() {
      try {
        const response = await fetch('/api/pricing');
        if (!response.ok) throw new Error('Error fetching pricing');
        
        const result: PricingResponse = await response.json();
        cachedPricing = result;
        cacheTimestamp = Date.now();
        setData(result);
      } catch (err: any) {
        console.error('Error fetching dynamic pricing:', err);
        setError(err.message);
        // Usar fallback
        setData(FALLBACK_PRICING);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPricing();
  }, []);

  // Usar data actual o fallback
  const currentData = data || FALLBACK_PRICING;

  return {
    pricing: currentData.pricing,
    plans: currentData.plans,
    savings: currentData.savings,
    isLoading,
    error,
    // Helpers
    formattedMonthlyPrice: formatPrice(currentData.plans.premium.priceMonthly),
    formattedAnnualPrice: formatPrice(currentData.plans.premium_annual.priceAnnual),
    formattedAnnualMonthlyPrice: formatPrice(currentData.plans.premium_annual.priceMonthly),
    trialDays: currentData.plans.trial.trialDays,
  };
}

/**
 * Invalida el cache de precios para forzar una recarga
 */
export function invalidatePricingCache(): void {
  cachedPricing = null;
  cacheTimestamp = 0;
}
