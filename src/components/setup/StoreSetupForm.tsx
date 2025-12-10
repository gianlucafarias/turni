import { useState } from 'react';
import { supabase } from '../../lib/supabase';

interface Store {
  id?: string;
  name: string;
  description: string;
  store_type: 'products' | 'appointments';
}

interface Props {
  initialData?: Store;
}

export default function StoreSetupForm({ initialData }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Store>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    store_type: initialData?.store_type || 'products'
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No hay sesión activa');
      }

      const storeData = {
        ...formData,
        user_id: session.user.id,
        updated_at: new Date().toISOString()
      };

      let result;
      if (initialData?.id) {
        // Actualizar tienda existente
        result = await supabase
          .from('stores')
          .update(storeData)
          .eq('id', initialData.id)
          .select()
          .single();
      } else {
        // Crear nueva tienda
        result = await supabase
          .from('stores')
          .insert([storeData])
          .select()
          .single();
      }

      if (result.error) throw result.error;

      // Redirigir al dashboard
      window.location.href = '/dashboard';
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'Error al guardar la tienda');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Nombre de la tienda
        </label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Descripción
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Tipo de tienda
        </label>
        <select
          value={formData.store_type}
          onChange={(e) => setFormData({ ...formData, store_type: e.target.value as 'products' | 'appointments' })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="products">Productos</option>
          <option value="appointments">Citas</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {loading ? 'Guardando...' : initialData ? 'Actualizar tienda' : 'Crear tienda'}
      </button>
    </form>
  );
} 