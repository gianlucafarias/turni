import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  productId: string
}

export default function EditProductForm({ productId }: Props) {
  const [product, setProduct] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          window.location.href = '/login'
          return
        }

        // Obtener producto con tienda
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('*, stores!inner(*)')
          .eq('id', productId)
          .eq('stores.user_id', session.user.id)
          .single()

        if (productError || !productData) {
          window.location.href = '/dashboard/products'
          return
        }

        setProduct(productData)

        // Obtener categorías
        const { data: categoriesData } = await supabase
          .from('categories')
          .select('*')
          .eq('store_id', productData.store_id)
          .order('name')

        setCategories(categoriesData || [])
      } catch (error) {
        console.error('Error cargando producto:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [productId])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const formData = new FormData(e.currentTarget)

      const data = {
        name: formData.get('name'),
        description: formData.get('description') || '',
        price: parseFloat(formData.get('price') as string),
        stock: parseInt(formData.get('stock') as string),
        category_id: formData.get('category_id') || null,
        image_url: formData.get('image_url') || null,
        active: formData.get('active') === 'on'
      }

      const { error: updateError } = await supabase
        .from('products')
        .update(data)
        .eq('id', productId)

      if (updateError) throw updateError

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (error: any) {
      console.error('Error:', error)
      setError(error.message || 'Error al actualizar el producto')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar este producto?')) return

    setDeleting(true)
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)

      if (error) throw error

      window.location.href = '/dashboard/products'
    } catch (error: any) {
      console.error('Error:', error)
      setError(error.message || 'Error al eliminar el producto')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando...</p>
      </div>
    )
  }

  if (!product) return null

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Editar Producto</h1>
        <p className="mt-2 text-gray-600">Modifica los datos del producto</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded">
          Producto actualizado correctamente
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Nombre del producto *
          </label>
          <input
            type="text"
            name="name"
            id="name"
            required
            defaultValue={product.name}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Descripción
          </label>
          <textarea
            name="description"
            id="description"
            rows={3}
            defaultValue={product.description || ''}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700">
              Precio *
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                name="price"
                id="price"
                required
                min="0"
                step="0.01"
                defaultValue={product.price}
                className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="stock" className="block text-sm font-medium text-gray-700">
              Stock *
            </label>
            <input
              type="number"
              name="stock"
              id="stock"
              required
              min="0"
              defaultValue={product.stock}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="category_id" className="block text-sm font-medium text-gray-700">
            Categoría
          </label>
          <select
            name="category_id"
            id="category_id"
            defaultValue={product.category_id || ''}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Sin categoría</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="image_url" className="block text-sm font-medium text-gray-700">
            URL de la imagen
          </label>
          <input
            type="url"
            name="image_url"
            id="image_url"
            defaultValue={product.image_url || ''}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          {product.image_url && (
            <div className="mt-2">
              <img
                src={product.image_url}
                alt={product.name}
                className="h-32 w-32 object-cover rounded"
              />
            </div>
          )}
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            name="active"
            id="active"
            defaultChecked={product.active}
            className="h-4 w-4 text-blue-600 rounded border-gray-300"
          />
          <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
            Producto activo
          </label>
        </div>

        <div className="flex justify-between pt-4 border-t">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? 'Eliminando...' : 'Eliminar Producto'}
          </button>

          <div className="flex space-x-4">
            <a
              href="/dashboard/products"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancelar
            </a>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}





