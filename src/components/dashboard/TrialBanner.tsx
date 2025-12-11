// =============================================================================
// Banner de Trial
// Muestra los días restantes del trial y CTA para actualizar
// =============================================================================

import { formatPrice, PLANS } from '../../lib/subscription';

interface TrialBannerProps {
  daysRemaining: number;
  storeId: string;
  onDismiss?: () => void;
}

export function TrialBanner({ daysRemaining, storeId, onDismiss }: TrialBannerProps) {
  const isUrgent = daysRemaining <= 3;
  const premiumPlan = PLANS.premium;

  async function handleUpgrade() {
    try {
      const response = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, planId: 'premium' }),
      });

      const result = await response.json();
      
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch (error) {
      console.error('Error creating subscription:', error);
    }
  }

  // Banner urgente (3 días o menos)
  if (isUrgent) {
    return (
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-white/20 rounded-full">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-white">
                ¡Tu prueba termina en {daysRemaining} {daysRemaining === 1 ? 'día' : 'días'}!
              </p>
              <p className="text-sm text-white/90">
                Actualizá ahora para no perder acceso a las funciones Premium
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleUpgrade}
              className="px-4 py-2 bg-white text-orange-600 font-semibold rounded-lg hover:bg-orange-50 transition-colors"
            >
              Actualizar a Premium
            </button>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="p-1.5 text-white/80 hover:text-white transition-colors"
                aria-label="Cerrar"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Banner normal
  return (
    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-white/20 rounded-full">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-white">
              Estás probando Premium • {daysRemaining} días restantes
            </p>
            <p className="text-sm text-white/80">
              Disfrutá de todas las funciones sin límites
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-white/90 text-sm">
            Después: {formatPrice(premiumPlan.priceMonthly)}/mes
          </span>
          <button
            onClick={handleUpgrade}
            className="px-4 py-2 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-colors"
          >
            Continuar con Premium
          </button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1.5 text-white/80 hover:text-white transition-colors"
              aria-label="Cerrar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Banner compacto para mostrar en sidebar o header
 */
export function TrialBadge({ daysRemaining }: { daysRemaining: number }) {
  const isUrgent = daysRemaining <= 3;
  
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
      isUrgent 
        ? 'bg-amber-100 text-amber-700' 
        : 'bg-indigo-100 text-indigo-700'
    }`}>
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Trial: {daysRemaining}d
    </div>
  );
}



