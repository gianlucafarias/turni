// =============================================================================
// Panel de Suscripción para el Dashboard
// Muestra el estado actual, permite upgrade/downgrade y cancelación
// =============================================================================

import { useState, useEffect, Fragment } from 'react';
import { supabase } from '../../lib/supabase';
import {
  PLANS,
  PLAN_COMPARISON,
  getSubscriptionSummary,
  formatPrice,
  type Subscription,
  type PlanId
} from '../../lib/subscription';

interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  mp_payment_id: string | null;
  mp_status: string | null;
  mp_status_detail: string | null;
  paid_at: string | null;
  created_at: string;
}

interface SubscriptionData {
  subscription: Subscription | null;
  summary: ReturnType<typeof getSubscriptionSummary>;
  recentPayments: PaymentRecord[];
}

export function SubscriptionPanel() {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Cargar storeId y datos de suscripción
  useEffect(() => {
    loadStoreAndSubscription();
  }, []);

  async function loadStoreAndSubscription() {
    try {
      setLoading(true);
      setError(null);

      // Obtener sesión
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Debés iniciar sesión para ver tu plan');
        setLoading(false);
        return;
      }

      // Obtener tienda
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      if (storeError || !store) {
        setError('No se encontró tu tienda');
        setLoading(false);
        return;
      }

      setStoreId(store.id);

      // Cargar suscripción
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('store_id', store.id)
        .single();

      if (subError && subError.code !== 'PGRST116') { // no rows
        throw new Error(subError.message);
      }

      // Historial de pagos (últimos 10)
      const { data: payments, error: payError } = await supabase
        .from('subscription_payments')
        .select('id, amount, currency, status, mp_payment_id, mp_status, mp_status_detail, paid_at, created_at')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (payError) {
        throw new Error(payError.message);
      }

      const summary = getSubscriptionSummary(subscription as Subscription | null);

      setData({
        subscription: subscription as Subscription | null,
        summary,
        recentPayments: payments || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(planId: PlanId) {
    if (upgrading || !storeId) return;
    
    try {
      setUpgrading(true);
      setError(null);
      
      // Obtener sesión para pasar token en headers
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sesión no encontrada');

      const response = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ storeId, planId }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Error al crear suscripción');
      }

      // Redirigir al checkout de Mercado Pago
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar');
    } finally {
      setUpgrading(false);
    }
  }

  async function handleCancel() {
    if (cancelling || !storeId) return;
    
    try {
      setCancelling(true);
      setError(null);
      
      // Obtener sesión para pasar token en headers
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sesión no encontrada');

      const response = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ storeId, reason: cancelReason }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Error al cancelar');
      }

      setShowCancelModal(false);
      await loadStoreAndSubscription();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cancelar');
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          <div className="h-10 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <p className="text-red-600">{error || 'Error al cargar datos'}</p>
      </div>
    );
  }

  const { summary } = data;
  const currentPlan = PLANS[summary.planId as PlanId] || PLANS.free;

  return (
    <div className="space-y-6">
      {/* Estado actual */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600">
          <h2 className="text-xl font-semibold text-white">Tu Suscripción</h2>
        </div>
        
        <div className="p-6">
          {/* Plan actual */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-gray-900">
                  {currentPlan.name}
                </span>
                {currentPlan.badge && (
                  <span className="px-3 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
                    {currentPlan.badge}
                  </span>
                )}
              </div>
              <p className="text-gray-500 mt-1">{currentPlan.description}</p>
            </div>
            
            {summary.isPremium && (
              <div className="text-right">
                <p className="text-sm text-gray-500">Próxima factura</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatPrice(currentPlan.priceMonthly)}
                </p>
              </div>
            )}
          </div>

          {/* Alerta de trial */}
          {summary.isTrialActive && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-medium text-amber-800">
                    Período de prueba: {summary.trialDaysRemaining} días restantes
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    Actualizá a Premium antes de que termine para no perder las funciones avanzadas.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Estado */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Estado</p>
              <p className="font-semibold text-gray-900 capitalize">{summary.status}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Productos</p>
              <p className="font-semibold text-gray-900">
                {summary.limits.maxProducts === -1 ? 'Ilimitados' : summary.limits.maxProducts}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Servicios</p>
              <p className="font-semibold text-gray-900">
                {summary.limits.maxServices === -1 ? 'Ilimitados' : summary.limits.maxServices}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Clientes</p>
              <p className="font-semibold text-gray-900">
                {summary.limits.maxClients === -1 ? 'Ilimitados' : summary.limits.maxClients === 0 ? 'No incluido' : summary.limits.maxClients}
              </p>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex flex-wrap gap-3">
            {!summary.isPremium && (
              <>
                <button
                  onClick={() => handleUpgrade('premium')}
                  disabled={upgrading}
                  className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {upgrading ? 'Procesando...' : 'Actualizar a Premium'}
                </button>
                <button
                  onClick={() => handleUpgrade('premium_annual')}
                  disabled={upgrading}
                  className="px-6 py-2.5 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {upgrading ? 'Procesando...' : 'Premium Anual (2 meses gratis)'}
                </button>
              </>
            )}
            
            {summary.isPremium && summary.status === 'active' && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar suscripción
              </button>
            )}
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-600">{error}</p>
          )}
        </div>
      </div>

      {/* Comparativa de planes */}
      {!summary.isPremium && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Comparar planes</h3>
          </div>
          
          <div className="p-6 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Característica</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">Gratis</th>
                  <th className="text-center py-3 px-4 font-medium text-indigo-600">Premium</th>
                </tr>
              </thead>
              <tbody>
                {PLAN_COMPARISON.map((category) => (
                  <Fragment key={category.category}>
                    <tr className="bg-gray-50">
                      <td colSpan={3} className="py-2 px-4 font-semibold text-gray-800">
                        {category.category}
                      </td>
                    </tr>
                    {category.features.map((feature) => (
                      <tr key={`${category.category}-${feature.name}`} className="border-b border-gray-100">
                        <td className="py-3 px-4 text-gray-700">{feature.name}</td>
                        <td className="py-3 px-4 text-center text-gray-600">{feature.free}</td>
                        <td className="py-3 px-4 text-center text-indigo-600 font-medium">{feature.premium}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historial de pagos */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Historial de Pagos</h3>
          {data.recentPayments.length > 0 && (
            <span className="text-sm text-gray-500">
              {data.recentPayments.length} {data.recentPayments.length === 1 ? 'pago' : 'pagos'}
            </span>
          )}
        </div>
        
        {data.recentPayments.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
            </svg>
            <p className="text-gray-500">No hay pagos registrados</p>
            <p className="text-sm text-gray-400 mt-1">Cuando realices un pago, aparecerá aquí</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID Transacción
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Comprobante
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.recentPayments.map((payment) => {
                  const paymentDate = new Date(payment.paid_at || payment.created_at);
                  const statusConfig = {
                    approved: { label: 'Aprobado', class: 'bg-green-100 text-green-700' },
                    pending: { label: 'Pendiente', class: 'bg-yellow-100 text-yellow-700' },
                    rejected: { label: 'Rechazado', class: 'bg-red-100 text-red-700' },
                    refunded: { label: 'Reembolsado', class: 'bg-blue-100 text-blue-700' },
                  }[payment.status] || { label: payment.status, class: 'bg-gray-100 text-gray-700' };
                  
                  return (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {paymentDate.toLocaleDateString('es-AR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {paymentDate.toLocaleTimeString('es-AR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {formatPrice(payment.amount)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {payment.currency}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${statusConfig.class}`}>
                          {statusConfig.label}
                        </span>
                        {payment.mp_status_detail && (
                          <div className="text-xs text-gray-400 mt-1">
                            {payment.mp_status_detail}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {payment.mp_payment_id ? (
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700">
                            {payment.mp_payment_id}
                          </code>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {payment.mp_payment_id && payment.status === 'approved' ? (
                          <a
                            href={`https://www.mercadopago.com.ar/activities/detail/${payment.mp_payment_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            Ver en MP
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Info adicional */}
        {summary.isPremium && data.subscription && (
          <div className="px-6 py-4 bg-gray-50 border-t">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {data.subscription.current_period_end && (
                <div>
                  <span className="text-gray-500">Próxima facturación:</span>{' '}
                  <span className="font-medium text-gray-900">
                    {new Date(data.subscription.current_period_end).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              )}
              {data.subscription.mp_subscription_id && (
                <div>
                  <span className="text-gray-500">ID Suscripción:</span>{' '}
                  <code className="text-xs bg-white px-2 py-0.5 rounded font-mono text-gray-600 border">
                    {data.subscription.mp_subscription_id}
                  </code>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de cancelación */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              ¿Cancelar suscripción?
            </h3>
            <p className="text-gray-600 mb-4">
              Si cancelás, seguirás teniendo acceso a las funciones Premium hasta el fin del período actual. 
              Después, tu cuenta pasará al plan Gratis.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ¿Por qué cancelás? (opcional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                rows={3}
                placeholder="Tu feedback nos ayuda a mejorar..."
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
              >
                Volver
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {cancelling ? 'Cancelando...' : 'Confirmar cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

