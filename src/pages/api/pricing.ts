// =============================================================================
// API pública para obtener precios dinámicos
// Los componentes React pueden consultar este endpoint para obtener precios actuales
// =============================================================================

import type { APIRoute } from 'astro';
import { getPricing, calculateAnnualSavings, type PricingConfig } from '../../lib/subscription/pricing';
import { PLANS } from '../../lib/subscription/plans';

export interface PricingResponse {
  pricing: PricingConfig;
  plans: {
    free: { priceMonthly: number };
    trial: { priceMonthly: number; trialDays: number };
    premium: { priceMonthly: number };
    premium_annual: { priceMonthly: number; priceAnnual: number };
  };
  savings: {
    amount: number;
    percentage: number;
    monthsFree: number;
  };
}

export const GET: APIRoute = async () => {
  try {
    const pricing = await getPricing();
    const savings = calculateAnnualSavings(pricing.premium_monthly, pricing.premium_annual);
    
    const response: PricingResponse = {
      pricing,
      plans: {
        free: { priceMonthly: 0 },
        trial: { 
          priceMonthly: 0, 
          trialDays: pricing.trial_days ?? 7 
        },
        premium: { 
          priceMonthly: pricing.premium_monthly 
        },
        premium_annual: { 
          priceMonthly: Math.round(pricing.premium_annual / 12),
          priceAnnual: pricing.premium_annual 
        },
      },
      savings,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Cache por 5 minutos para no sobrecargar la DB
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error: any) {
    console.error('Error fetching pricing:', error);
    
    // Fallback a precios estáticos si falla la DB
    const fallbackResponse: PricingResponse = {
      pricing: {
        premium_monthly: PLANS.premium.priceMonthly,
        premium_annual: PLANS.premium_annual.priceAnnual || 49900,
        currency: 'ARS',
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
        percentage: 0,
        monthsFree: 2,
      },
    };

    return new Response(JSON.stringify(fallbackResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
