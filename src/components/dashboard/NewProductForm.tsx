import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Category {
  id: string
  name: string
}

export default function NewProductForm() {
  const [store, setStore] = useState<any>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [active, setActive] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        window.location.href = '/login'
        return
      }

      const { data: storeData } = await supabase
        .from('stores')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (!storeData) {
        window.location.href = '/setup/store'
        return
      }

      setStore(storeData)

      const { data: categoriesData } = await supabase
        .from('categories')
        .select('*')
        .eq('store_id', storeData.id)
        .order('name', { ascending: true })

      setCategories(categoriesData || [])
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!store) {
      setError('No se encontró la tienda. Recarga la página.')
      return
    }

    // Validaciones
    if (!name.trim()) {
      setError('El nombre del producto es obligatorio')
      return
    }
    if (!price || parseFloat(price) < 0) {
      setError('El precio debe ser un número válido')
      return
    }

    setSaving(true)
    setError(null)

    const productData = {
      store_id: store.id,
      name: name.trim(),
      description: description.trim() || '',
      price: parseFloat(price),
      stock: parseInt(stock) || 0,
      category_id: categoryId || null,
      image_url: imageUrl.trim() || '',
      active
    }

    console.log('Guardando producto:', productData)

    try {
      const { data, error: insertError } = await supabase
        .from('products')
        .insert([productData])
        .select()

      console.log('Respuesta de Supabase:', { data, error: insertError })

      if (insertError) {
        console.error('Error de inserción:', insertError)
        throw insertError
      }

      if (!data || data.length === 0) {
        throw new Error('El producto no se guardó correctamente')
      }

      console.log('Producto guardado exitosamente:', data[0])
      window.location.href = '/dashboard/products'
    } catch (err: any) {
      console.error('Error completo:', err)
      setError(err.message || 'Error al crear el producto')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Nuevo Producto</h1>
        <p className="text-gray-500 mt-1">Agrega un nuevo producto a tu tienda</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre del producto *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            placeholder="Ej: Remera básica"
          />
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descripción
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
            placeholder="Describe tu producto..."
          />
        </div>

        {/* Precio y Stock */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Precio *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                min="0"
                step="0.01"
                className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stock *
            </label>
            <input
              type="number"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              required
              min="0"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              placeholder="0"
            />
          </div>
        </div>

        {/* Categoría */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Categoría
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-white"
          >
            <option value="">Sin categoría</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          {categories.length === 0 && (
            <p className="mt-2 text-sm text-gray-400">
              <a href="/dashboard/categories" className="text-blue-600 hover:underline">
                Crea categorías primero
              </a>
            </p>
          )}
        </div>

        {/* URL de imagen */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            URL de la imagen
          </label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            placeholder="https://..."
          />
          {imageUrl && (
            <div className="mt-3">
              <img 
                src={imageUrl} 
                alt="Preview" 
                className="w-32 h-32 object-cover rounded-xl border"
                onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
              />
            </div>
          )}
        </div>

        {/* Activo */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="active"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
          <label htmlFor="active" className="text-gray-700">
            Producto activo (visible en la tienda)
          </label>
        </div>

        {/* Botones */}
        <div className="flex gap-4 pt-4 border-t">
          <a
            href="/dashboard/products"
            className="flex-1 py-3 text-center text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </a>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar Producto'}
          </button>
        </div>
      </form>
    </div>
  )
}

