import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const product = await request.json();

    // Validar los datos requeridos
    if (!product.id || !product.name || !product.price) {
      return new Response(JSON.stringify({ 
        error: 'Faltan datos requeridos del producto' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      product 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Error al procesar la solicitud' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}; 