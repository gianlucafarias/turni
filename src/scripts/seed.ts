import { supabase } from '../lib/supabase';

async function seed() {
  try {
    // Crear una tienda de ejemplo
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .insert({
        name: 'Goncy tienda',
        user_id: 'demo-user',
        store_type: 'products',
        setup_completed: true,
        plan: 'free',
        products_count: 0
      })
      .select()
      .single();

    if (storeError) throw storeError;
    console.log('Tienda creada:', store);
    console.log('URL de la tienda:', `http://localhost:4321/${store.id}`);

    // Crear categorías
    const categories = [
      { name: 'Congelados', store_id: store.id },
      { name: 'fafa', store_id: store.id },
      { name: 'Frutos secos', store_id: store.id },
      { name: 'Menúes', store_id: store.id },
      { name: 'sarasa', store_id: store.id }
    ];

    const { data: createdCategories, error: categoriesError } = await supabase
      .from('categories')
      .insert(categories)
      .select();

    if (categoriesError) throw categoriesError;
    console.log('Categorías creadas:', createdCategories);

    // Crear productos destacados
    const products = [
      {
        name: 'Nuevo producto',
        price: 100.00,
        store_id: store.id,
        active: true,
        description: 'Descripción del producto',
        stock: 10,
        image_url: 'https://via.placeholder.com/300'
      },
      {
        name: 'Noquis mixtos de remolacha y rúcula',
        price: 250.00,
        store_id: store.id,
        active: true,
        description: 'Deliciosos noquis artesanales',
        stock: 5,
        image_url: 'https://via.placeholder.com/300'
      }
    ];

    const { data: createdProducts, error: productsError } = await supabase
      .from('products')
      .insert(products)
      .select();

    if (productsError) throw productsError;
    console.log('Productos creados:', createdProducts);

    console.log('\n¡Datos de prueba creados exitosamente!');
    console.log('\nPuedes ver la tienda en:');
    console.log(`http://localhost:4321/${store.id}`);
    console.log('\nO ver todas las tiendas en:');
    console.log('http://localhost:4321');
  } catch (error) {
    console.error('Error al crear datos de prueba:', error);
  }
}

seed(); 