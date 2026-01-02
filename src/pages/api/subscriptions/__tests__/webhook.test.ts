import { describe, it, expect, vi, beforeEach } from 'vitest';

// Para evitar problemas con el hoisting de vi.mock, definimos las fábricas
// dentro de la llamada y no usamos variables de módulo externas.

vi.mock('../../../../lib/supabase', () => {
  const fromMock = vi.fn();
  return {
    supabase: {
      from: fromMock,
    },
    // También exportamos el mock para poder acceder a él luego vía import real
    __fromMock: fromMock,
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
// @ts-expect-error - __fromMock es solo para tests
import { supabase, __fromMock as fromMock } from '../../../../lib/supabase';
import { processWebhook, getSubscription } from '../../../../services/subscriptions';
import { markAsPastDue } from '../../../../lib/subscription';

describe('Subscriptions Webhook API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupSupabaseMocksForStore(storeId: string, pendingPlanId?: string) {
    // Simular cadenas de llamadas:
    // supabase.from('subscriptions').select(...).eq('store_id', storeId).single()
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'sub_1',
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

    fromMock.mockImplementation((table: string) => {
      if (table === 'subscriptions') {
        return {
          select: selectMock,
          // update().eq() debe devolver una promesa similar a supabase
          update: (values: any) => ({
            eq: () => updateMock(values),
          }),
          eq: eqMock,
          single: singleMock,
        };
      }
      if (table === 'subscription_payments') {
        return {
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

    // Mock de processWebhook devolviendo pago aprobado
    (processWebhook as any).mockResolvedValue({
      preapprovalId: 'pre_1',
      paymentId: 'pay_123',
      paymentStatus: 'approved',
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

    // Debe haberse insertado un registro en subscription_payments
    expect(insertMock).toHaveBeenCalledTimes(1);
    const paymentRow = insertMock.mock.calls[0][0] as any;
    expect(paymentRow.subscription_id).toBe('sub_1');
    expect(paymentRow.amount).toBe(1500);
    expect(paymentRow.currency).toBe('ARS');
    expect(paymentRow.status).toBe('approved');
    expect(paymentRow.mp_payment_id).toBe('pay_123');

    // Debe haberse actualizado la suscripción a active/premium
    expect(updateMock).toHaveBeenCalled();
    const updateArgs = updateMock.mock.calls[0][0] as any;
    expect(updateArgs.status).toBe('active');
    expect(updateArgs.plan_id).toBe('premium');

    // No debe marcar past_due para pago aprobado
    expect(markAsPastDue).not.toHaveBeenCalled();
  });

  it('registra pago no aprobado y marca la suscripción como past_due', async () => {
    const storeId = 'store_456';

    // Mock de processWebhook devolviendo pago rechazado
    (processWebhook as any).mockResolvedValue({
      preapprovalId: 'pre_2',
      paymentId: 'pay_456',
      paymentStatus: 'rejected',
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

    // Se debe haber insertado el pago con status "pending"
    expect(insertMock).toHaveBeenCalledTimes(1);
    const paymentRow = insertMock.mock.calls[0][0] as any;
    expect(paymentRow.amount).toBe(2000);
    expect(paymentRow.status).toBe('pending');

    // No se debe activar la suscripción (no llamada significativa a update)
    // pero sí marcar past_due
    expect(markAsPastDue).toHaveBeenCalledWith('sub_1');
    // updateMock puede haberse llamado por otros caminos, pero no nos importa el contenido aquí
  });
});

