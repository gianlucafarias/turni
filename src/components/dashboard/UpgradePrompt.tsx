// =============================================================================
// Componente para mostrar cuando el usuario excede los límites de su plan
// =============================================================================

import { useDynamicPricing } from '../../hooks/useDynamicPricing';

interface UpgradePromptProps {
  feature: 'products' | 'services' | 'clients' | 'appointments' | 'notifications';
  currentCount?: number;
  limit?: number;
  variant?: 'banner' | 'card' | 'modal' | 'inline';
}

const FEATURE_INFO = {
  products: {
    title: 'Límite de productos alcanzado',
    description: 'Has alcanzado el límite de productos de tu plan actual.',
    icon: '📦',
    benefit: 'productos ilimitados',
  },
  services: {
    title: 'Límite de servicios alcanzado',
    description: 'El plan gratuito solo permite 1 servicio.',
    icon: '✂️',
    benefit: 'servicios ilimitados',
  },
  clients: {
    title: 'Gestión de clientes',
    description: 'La gestión de clientes es una función Premium.',
    icon: '👥',
    benefit: 'gestión completa de clientes',
  },
  appointments: {
    title: 'Límite de turnos alcanzado',
    description: 'Has alcanzado el límite mensual de turnos.',
    icon: '📅',
    benefit: 'turnos ilimitados',
  },
  notifications: {
    title: 'Notificaciones',
    description: 'Las notificaciones automáticas son una función Premium.',
    icon: '🔔',
    benefit: 'notificaciones por WhatsApp y email',
  },
};

export function UpgradePrompt({ 
  feature, 
  currentCount, 
  limit, 
  variant = 'card' 
}: UpgradePromptProps) {
  const info = FEATURE_INFO[feature];
  const { formattedMonthlyPrice } = useDynamicPricing();

  if (variant === 'banner') {
    return (
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{info.icon}</span>
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900">{info.title}</h3>
            <p className="text-sm text-amber-700 mt-1">
              {info.description}
              {currentCount !== undefined && limit !== undefined && (
                <span className="font-medium"> ({currentCount}/{limit} usados)</span>
              )}
            </p>
          </div>
          <a
            href="/dashboard/subscription"
            className="shrink-0 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
          >
            Ver planes
          </a>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
        <span>{info.icon}</span>
        <span>{info.description}</span>
        <a href="/dashboard/subscription" className="font-medium underline hover:no-underline">
          Actualizar
        </a>
      </div>
    );
  }

  // Default: card
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="p-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full mb-4">
          <span className="text-3xl">{info.icon}</span>
        </div>
        
        <h2 className="text-xl font-bold text-gray-900 mb-2">{info.title}</h2>
        <p className="text-gray-600 mb-4">
          {info.description}
          {currentCount !== undefined && limit !== undefined && (
            <span className="block text-sm mt-1 font-medium text-gray-500">
              Usados: {currentCount} de {limit}
            </span>
          )}
        </p>

        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-indigo-700 mb-2">
            Con <strong>Premium</strong> obtenés:
          </p>
          <ul className="text-sm text-left text-indigo-600 space-y-1">
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {info.benefit.charAt(0).toUpperCase() + info.benefit.slice(1)}
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Gestión completa de clientes
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Notificaciones automáticas
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <a
            href="/dashboard/subscription"
            className="block w-full py-3 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Actualizar a Premium - {formattedMonthlyPrice}/mes
          </a>
          <p className="text-xs text-gray-500">
            Cancelá cuando quieras · Sin compromisos
          </p>
        </div>
      </div>
    </div>
  );
}

// Componente para bloquear completamente una sección
export function PremiumFeatureBlock({ feature }: { feature: 'clients' | 'notifications' }) {
  const info = FEATURE_INFO[feature];
  
  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full mb-6">
          <span className="text-4xl">{info.icon}</span>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          Función Premium
        </h2>
        <p className="text-gray-600 mb-6">
          {info.description} Actualizá tu plan para acceder a {info.benefit} y mucho más.
        </p>

        <a
          href="/dashboard/subscription"
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          Ver planes Premium
        </a>
      </div>
    </div>
  );
}

// Badge para indicar función premium en el sidebar
export function PremiumBadge() {
  return (
    <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded">
      PRO
    </span>
  );
}













