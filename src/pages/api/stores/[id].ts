import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;

    // Obtener datos de la tienda
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .single();

    if (storeError) {
      return new Response(JSON.stringify({ error: storeError.message }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Obtener productos destacados
    const { data: featuredProducts } = await supabase
      .from('products')
      .select(`
        *,
        categories (
          id,
          name
        )
      `)
      .eq('store_id', id)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(4);

    // Obtener categorías con productos
    const { data: categories } = await supabase
      .from('categories')
      .select(`
        *,
        products (
          id
        )
      `)
      .eq('store_id', id);

    // Obtener todos los productos
    const { data: products } = await supabase
      .from('products')
      .select(`
        *,
        categories (
          id,
          name
        )
      `)
      .eq('store_id', id)
      .order('created_at', { ascending: false });

    // Formatear respuesta - asegurar que siempre sean arrays/objetos
    const response = {
      store: store || null,
      featuredProducts: featuredProducts || [],
      categories: categories?.map(cat => ({
        id: cat.id,
        name: cat.name,
        count: cat.products?.length || 0
      })) || [],
      products: products?.reduce((acc, product) => {
        if (product.category_id) {
          if (!acc[product.category_id]) {
            acc[product.category_id] = [];
          }
          acc[product.category_id].push(product);
        }
        return acc;
      }, {} as Record<string, any[]>) || {}
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}; 