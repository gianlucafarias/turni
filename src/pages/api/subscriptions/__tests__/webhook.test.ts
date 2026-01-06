import { describe, it, expect, vi, beforeEach } from 'vitest';

// Para evitar problemas con el hoisting de vi.mock, definimos las fábricas
// dentro de la llamada y no usamos variables de módulo externas.

vi.mock('../../../../lib/supabase', () => {
  const fromMock = vi.fn();
  const adminFromMock = vi.fn();
  return {
    supabase: {
      from: fromMock,
    },
    supabaseAdmin: {
      from: adminFromMock,
    },
    // También exportamos los mocks para poder acceder a ellos luego vía import real
    __fromMock: fromMock,
    __adminFromMock: adminFromMock,
  };
});

vi.mock('../../../../services/subscriptions', () => {
  return {
    processWebhook: vi.fn(),
    getSubscription: vi.fn(),
    mapMPStatusToLocal: vi.fn(),
    calculatePeriodEnd: (start: Date, isAnnual: boolean) => {
      const end = new Date(start);
      if (isAnnual) {
        end.setFullYear(end.getFullYear() + 1);
      } else {
        end.setMonth(end.getMonth() + 1);
      }
      return end;
    },
  };
});

vi.mock('../../../../lib/subscription', () => ({
  markAsPastDue: vi.fn(),
}));

// Importar los módulos YA mockeados
import { POST } from '../webhook';
// @ts-expect-error - __fromMock y __adminFromMock son solo para tests
import { supabase, __fromMock as fromMock, __adminFromMock as adminFromMock } from '../../../../lib/supabase';
import { processWebhook, getSubscription } from '../../../../services/subscriptions';
import { markAsPastDue } from '../../../../lib/subscription';

// Mock global de fetch para las llamadas a Mercado Pago
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('Subscriptions Webhook API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Resetear fetch mock
    mockFetch.mockReset();
  });

  function setupSupabaseMocksForStore(storeId: string, pendingPlanId?: string) {
    // Simular cadenas de llamadas:
    // supabaseAdmin.from('subscriptions').select(...).eq('store_id', storeId).single()
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'sub_1',
        plan_id: 'premium',
        metadata: pendingPlanId ? { pending_plan_id: pendingPlanId } : {},
      },
    });

    const eqMock = vi.fn().mockReturnValue({
      single: singleMock,
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: eqMock,
    });

    // Para insert/update usamos mocks genéricos
    const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const selectSingleMock = vi.fn().mockReturnValue({
      eq: eqMock,
      single: singleMock,
    });

    // Mock para supabaseAdmin (que es el que usa el webhook)
    adminFromMock.mockImplementation((table: string) => {
      if (table === 'subscriptions') {
        return {
          select: selectSingleMock,
          update: (values: any) => ({
            eq: () => updateMock(values),
          }),
          eq: eqMock,
          single: singleMock,
        };
      }
      if (table === 'subscription_payments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }), // No existe pago previo
            }),
          }),
          insert: insertMock,
        };
      }
      if (table === 'subscription_events') {
        return {
          insert: insertMock,
        };
      }
      return {};
    });

    return { insertMock, updateMock };
  }

  it('registra pago aprobado y activa la suscripción', async () => {
    const storeId = 'store_123';

    // Mock de fetch para getMPAuthorizedPayment
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'auth_pay_1',
        preapproval_id: 'pre_1',
        transaction_amount: 1500,
        payment: {
          id: 'pay_123',
          status: 'approved',
          status_detail: 'accredited',
        },
      }),
    });

    // Mock de getSubscription para obtener datos de MP
    (getSubscription as any).mockResolvedValue({
      id: 'pre_1',
      external_reference: `store_${storeId}_12345`,
      auto_recurring: {
        transaction_amount: 1500,
        currency_id: 'ARS',
      },
    });

    const { insertMock, updateMock } = setupSupabaseMocksForStore(storeId, 'premium');

    const event = {
      id: 'evt_1',
      live_mode: false,
      type: 'subscription_authorized_payment',
      date_created: new Date().toISOString(),
      user_id: 'user_1',
      api_version: 'v1',
      action: 'payment.created',
      data: {
        id: 'auth_pay_1',
      },
    };

    const request = new Request('http://localhost/api/subscriptions/webhook', {
      method: 'POST',
      body: JSON.stringify(event),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST({ request } as any);
    expect(response.status).toBe(200);

    // Debe haberse insertado un registro en subscription_payments y otro en subscription_events
    expect(insertMock).toHaveBeenCalledTimes(2);
    // Encontrar la llamada de subscription_payments (tiene amount)
    const paymentCall = insertMock.mock.calls.find((call: any) => call[0]?.amount !== undefined);
    expect(paymentCall).toBeDefined();
    const paymentRow = paymentCall[0] as any;
    expect(paymentRow.subscription_id).toBe('sub_1');
    expect(paymentRow.amount).toBe(1500);
    expect(paymentRow.currency).toBe('ARS');
    expect(paymentRow.status).toBe('approved');
    expect(paymentRow.mp_payment_id).toBe('pay_123');

    // Debe haberse actualizado la suscripción a active (renovación de período)
    expect(updateMock).toHaveBeenCalled();
    const updateArgs = updateMock.mock.calls[0][0] as any;
    expect(updateArgs.status).toBe('active');
    expect(updateArgs.current_period_start).toBeDefined();
    expect(updateArgs.current_period_end).toBeDefined();

    // No debe marcar past_due para pago aprobado
    expect(markAsPastDue).not.toHaveBeenCalled();
  });

  it('registra pago no aprobado y marca la suscripción como past_due', async () => {
    const storeId = 'store_456';

    // Mock de fetch para getMPAuthorizedPayment con pago rechazado
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'auth_pay_2',
        preapproval_id: 'pre_2',
        transaction_amount: 2000,
        payment: {
          id: 'pay_456',
          status: 'rejected',
          status_detail: 'cc_rejected_insufficient_amount',
        },
      }),
    });

    // Mock de getSubscription
    (getSubscription as any).mockResolvedValue({
      id: 'pre_2',
      external_reference: `store_${storeId}_98765`,
      auto_recurring: {
        transaction_amount: 2000,
        currency_id: 'ARS',
      },
    });

    const { insertMock } = setupSupabaseMocksForStore(storeId, 'premium');

    const event = {
      id: 'evt_2',
      live_mode: false,
      type: 'subscription_authorized_payment',
      date_created: new Date().toISOString(),
      user_id: 'user_1',
      api_version: 'v1',
      action: 'payment.created',
      data: {
        id: 'auth_pay_2',
      },
    };

    const request = new Request('http://localhost/api/subscriptions/webhook', {
      method: 'POST',
      body: JSON.stringify(event),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST({ request } as any);
    expect(response.status).toBe(200);

    // Se debe haber insertado el pago con status "rejected" y un evento
    expect(insertMock).toHaveBeenCalledTimes(2);
    // Encontrar la llamada de subscription_payments (tiene amount)
    const paymentCall = insertMock.mock.calls.find((call: any) => call[0]?.amount !== undefined);
    expect(paymentCall).toBeDefined();
    const paymentRow = paymentCall[0] as any;
    expect(paymentRow.amount).toBe(2000);
    expect(paymentRow.status).toBe('rejected');

    // No se debe activar la suscripción (no llamada significativa a update)
    // pero sí marcar past_due
    expect(markAsPastDue).toHaveBeenCalledWith('sub_1');
    // updateMock puede haberse llamado por otros caminos, pero no nos importa el contenido aquí
  });
});

