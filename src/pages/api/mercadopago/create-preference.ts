import type { APIRoute } from 'astro';
import { createPreference } from '../../../services/mercadopago';

export const post: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { plan, productData, paymentMethod } = body;

        if (!plan || !productData || !paymentMethod) {
            return new Response(JSON.stringify({ 
                error: 'Faltan datos requeridos' 
            }), { 
                status: 400 
            });
        }

        const preference = await createPreference({ plan, productData, paymentMethod });

        return new Response(JSON.stringify(preference), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error al crear preferencia:', error);
        return new Response(JSON.stringify({ 
            error: 'Error al crear preferencia de pago' 
        }), { 
            status: 500 
        });
    }
}; 