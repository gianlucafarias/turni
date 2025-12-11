import MercadoPago from 'mercadopago';
import type { Plan } from '../types/index';

// Configurar MercadoPago con las credenciales
const MercadoPagoAny: any = MercadoPago as any;
MercadoPagoAny.configure({
    access_token: import.meta.env.MERCADOPAGO_ACCESS_TOKEN
});

interface CreatePreferenceParams {
    plan: Plan;
    productData: {
        nombre: string;
        precio: number;
    };
    paymentMethod: 'efectivo' | 'financiado';
}

export const createPreference = async ({ plan, productData, paymentMethod }: CreatePreferenceParams) => {
    try {
        const discount = paymentMethod === 'efectivo' ? 0.1 : 0;
        const total = (plan.precio + productData.precio) * (1 - discount);

        const preference = {
            items: [
                {
                    title: `Plan ${plan.nombre} - Publicación de ${productData.nombre}`,
                    unit_price: total,
                    quantity: 1,
                    currency_id: 'ARS',
                    description: `Plan de publicación ${plan.nombre} por ${plan.duracion}. ${plan.caracteristicas.join(', ')}`
                }
            ],
            back_urls: {
                success: `${import.meta.env.PUBLIC_SITE_URL}/publicacion/success`,
                failure: `${import.meta.env.PUBLIC_SITE_URL}/publicacion/failure`,
                pending: `${import.meta.env.PUBLIC_SITE_URL}/publicacion/pending`
            },
            auto_return: 'approved',
            payment_methods: {
                excluded_payment_methods: paymentMethod === 'efectivo' ? [{ id: 'credit_card' }] : [],
                excluded_payment_types: paymentMethod === 'efectivo' ? [{ id: 'credit_card' }] : [],
                installments: paymentMethod === 'financiado' ? 12 : 1
            },
            notification_url: `${import.meta.env.PUBLIC_SITE_URL}/api/mercadopago/webhook`,
            external_reference: `${plan.id}-${Date.now()}`,
            expires: true,
            expiration_date_from: new Date().toISOString(),
            expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 horas
        };

        const response = await MercadoPagoAny.preferences.create(preference);
        return response.body;
    } catch (error) {
        console.error('Error al crear preferencia en Mercado Pago:', error);
        throw error;
    }
}; 