import { useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Category {
  id: string
  name: string
  store_id: string
}

interface Props {
  storeId: string
  initialCategories: Category[]
}

export default function CategoryList({ storeId, initialCategories }: Props) {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [newCategory, setNewCategory] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([
          {
            name: newCategory.trim(),
            store_id: storeId
          }
        ])
        .select()
        .single()

      if (error) throw error

      setCategories([...categories, data])
      setNewCategory('')
    } catch (err) {
      console.error('Error al crear categoría:', err)
      setError(err instanceof Error ? err.message : 'Error al crear categoría')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (categoryId: string) => {
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId)

      if (error) throw error

      setCategories(categories.filter(cat => cat.id !== categoryId))
    } catch (err) {
      console.error('Error al eliminar categoría:', err)
      setError(err instanceof Error ? err.message : 'Error al eliminar categoría')
    }
  }

  return (
    <div className="bg-white shadow-sm rounded-lg divide-y divide-gray-200">
      <div className="p-6">
        <form onSubmit={handleSubmit} className="flex gap-4">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Nueva categoría"
            required
            className="flex-1 rounded-md border border-gray-300 px-3 py-2"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Agregando...' : 'Agregar'}
          </button>
        </form>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
            {error}
          </div>
        )}
      </div>

      <div className="px-6 py-4">
        <h3 className="text-lg font-medium text-gray-900">
          Categorías ({categories.length})
        </h3>
        
        <div className="mt-4 space-y-2">
          {categories.length === 0 ? (
            <p className="text-gray-500">No hay categorías</p>
          ) : (
            categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between py-2"
              >
                <span className="text-gray-900">{category.name}</span>
                <button
                  onClick={() => handleDelete(category.id)}
                  className="text-red-600 hover:text-red-900"
                >
                  Eliminar
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
} 