// =============================================================================
// Componente Paywall Premium
// Muestra cuando el usuario intenta acceder a una feature premium
// =============================================================================

import { 
  PAYWALL_MESSAGES, 
  PLANS,
  formatPrice,
  type PremiumFeature 
} from '../../lib/subscription';

interface PremiumPaywallProps {
  feature: PremiumFeature;
  storeId: string;
  onClose?: () => void;
  variant?: 'modal' | 'inline' | 'banner';
}

export function PremiumPaywall({ 
  feature, 
  storeId, 
  onClose, 
  variant = 'inline' 
}: PremiumPaywallProps) {
  const message = PAYWALL_MESSAGES[feature];
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

  // Variante Banner (para mostrar arriba de una sección)
  if (variant === 'banner') {
    return (
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-white">{message.title}</p>
              <p className="text-sm text-white/80">{message.description}</p>
            </div>
          </div>
          <button
            onClick={handleUpgrade}
            className="px-4 py-2 bg-white text-indigo-600 font-medium rounded-lg hover:bg-indigo-50 transition-colors whitespace-nowrap"
          >
            {message.cta}
          </button>
        </div>
      </div>
    );
  }

  // Variante Modal
  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
          {/* Header con gradiente */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{message.title}</h2>
            <p className="text-white/90">{message.description}</p>
          </div>

          {/* Contenido */}
          <div className="px-6 py-6">
            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="text-4xl font-bold text-gray-900">
                {formatPrice(premiumPlan.priceMonthly)}
              </span>
              <span className="text-gray-500">/mes</span>
            </div>

            <ul className="space-y-3 mb-6">
              {['Productos ilimitados', 'Servicios ilimitados', 'Gestión de clientes', 'Notificaciones automáticas', 'Estadísticas avanzadas'].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">{item}</span>
                </li>
              ))}
            </ul>

            <div className="space-y-3">
              <button
                onClick={handleUpgrade}
                className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {message.cta}
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="w-full py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Quizás más tarde
                </button>
              )}
            </div>

            <p className="text-center text-sm text-gray-500 mt-4">
              Probá 7 días gratis. Cancelá cuando quieras.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Variante Inline (por defecto)
  return (
    <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-100 rounded-full mb-4">
        <svg className="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{message.title}</h3>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">{message.description}</p>
      
      <button
        onClick={handleUpgrade}
        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
        {message.cta}
      </button>
      
      <p className="text-sm text-gray-500 mt-4">
        Desde {formatPrice(premiumPlan.priceMonthly)}/mes • 7 días gratis
      </p>
    </div>
  );
}

/**
 * Hook para verificar si una feature está disponible
 */
export function usePremiumFeature(feature: PremiumFeature, isPremium: boolean) {
  return {
    isAvailable: isPremium,
    Paywall: isPremium ? null : PremiumPaywall,
  };
}













