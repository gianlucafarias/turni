import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import ImportProducts from './ImportProducts'
import { useSubscriptionLimits } from '../../hooks/useSubscriptionLimits'
import { UpgradePrompt } from './UpgradePrompt'

interface Category {
  id: string
  name: string
}

export default function ProductsList() {
  console.log('🚀 ProductsList INICIADO')
  
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [store, setStore] = useState<any>(null)
  const [showImport, setShowImport] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [debugError, setDebugError] = useState<string | null>(null)
  
  // Límites de suscripción
  const { isPremium, checkLimit, loading: limitsLoading } = useSubscriptionLimits()
  const productLimit = checkLimit('products')

  async function loadData() {
    try {
      // Obtener sesión
      const { data: { session } } = await supabase.auth.getSession()
      
      console.log('🔐 Sesión:', session?.user?.id)
      
      if (!session) {
        window.location.href = '/login'
        return
      }

      // Obtener la tienda del usuario
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      console.log('🏪 Tienda:', storeData, 'Error:', storeError)

      if (!storeData) {
        window.location.href = '/setup/store'
        return
      }

      setStore(storeData)

      // Obtener productos y categorías en paralelo
      const [productsRes, categoriesRes] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .eq('store_id', storeData.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('categories')
          .select('id, name')
          .eq('store_id', storeData.id)
          .order('name')
      ])

      console.log('📦 Productos:', productsRes.data, 'Error:', productsRes.error)
      console.log('📂 Categorías:', categoriesRes.data, 'Error:', categoriesRes.error)

      if (productsRes.error) {
        setDebugError(`Error productos: ${productsRes.error.message}`)
      }

      setProducts(productsRes.data || [])
      setCategories(categoriesRes.data || [])
    } catch (error: any) {
      console.error('❌ Error cargando datos:', error)
      setDebugError(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtrar productos
  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchTerm || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = !filterCategory || product.category_id === filterCategory
    
    const matchesStatus = !filterStatus || 
      (filterStatus === 'active' && product.active) ||
      (filterStatus === 'inactive' && !product.active)
    
    return matchesSearch && matchesCategory && matchesStatus
  })

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando productos...</p>
      </div>
    )
  }

  if (debugError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <h3 className="text-red-800 font-semibold mb-2">Error de Debug</h3>
        <p className="text-red-600">{debugError}</p>
        <p className="text-sm text-gray-500 mt-4">Store: {store?.id || 'No encontrada'}</p>
      </div>
    )
  }

  // Verificar si puede agregar más productos
  const canAddMore = productLimit.allowed
  const isNearLimit = !isPremium && productLimit.max !== -1 && productLimit.remaining <= 2 && productLimit.remaining > 0
  const atLimit = !isPremium && productLimit.max !== -1 && !productLimit.allowed

  return (
    <>
      {/* Banner de límite */}
      {atLimit && (
        <UpgradePrompt 
          feature="products" 
          currentCount={productLimit.current} 
          limit={productLimit.max} 
          variant="banner" 
        />
      )}
      
      {/* Aviso cerca del límite */}
      {isNearLimit && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <p className="text-sm text-amber-700">
              Te quedan <strong>{productLimit.remaining}</strong> producto{productLimit.remaining !== 1 ? 's' : ''} disponible{productLimit.remaining !== 1 ? 's' : ''} en tu plan.{' '}
              <a href="/dashboard/subscription" className="font-medium underline hover:no-underline">
                Actualizar a Premium
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Productos</h1>
            <p className="mt-2 text-gray-600">
              {products.length} producto{products.length !== 1 ? 's' : ''} en tu catálogo
              {!isPremium && productLimit.max !== -1 && (
                <span className="text-gray-400"> · {productLimit.current}/{productLimit.max} del plan</span>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => canAddMore ? setShowImport(true) : null}
              disabled={!canAddMore}
              className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                canAddMore 
                  ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50' 
                  : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Importar
            </button>
            {canAddMore ? (
              <button
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                onClick={() => window.location.href = '/dashboard/products/new'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nuevo Producto
              </button>
            ) : (
              <a
                href="/dashboard/subscription"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                Actualizar Plan
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Category filter */}
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Todas las categorías</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      {/* Products list */}
      {!products.length ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900">No hay productos todavía</h3>
          <p className="mt-2 text-gray-500 max-w-sm mx-auto">
            Comienza agregando productos manualmente o importa tu catálogo existente.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setShowImport(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Importar desde CSV
            </button>
            <button
              onClick={() => window.location.href = '/dashboard/products/new'}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Crear Producto
            </button>
          </div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900">Sin resultados</h3>
          <p className="mt-2 text-gray-500">
            No se encontraron productos con los filtros aplicados.
          </p>
          <button
            onClick={() => {
              setSearchTerm('')
              setFilterCategory('')
              setFilterStatus('')
            }}
            className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Producto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Categoría
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Precio
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-12 w-12 flex-shrink-0">
                          <img
                            className="h-12 w-12 rounded-lg object-cover border"
                            src={product.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(product.name)}&background=6366f1&color=fff&size=96`}
                            alt={product.name}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(product.name)}&background=6366f1&color=fff&size=96`
                            }}
                          />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {product.name}
                          </div>
                          {product.description && (
                            <div className="text-sm text-gray-500 truncate max-w-xs">
                              {product.description.substring(0, 50)}{product.description.length > 50 ? '...' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {product.category_id ? (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-md">
                          {categories.find(c => c.id === product.category_id)?.name || 'Sin categoría'}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Sin categoría</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-semibold text-gray-900">
                        ${product.price?.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`text-sm font-medium ${product.stock === 0 ? 'text-red-600' : product.stock < 5 ? 'text-yellow-600' : 'text-gray-700'}`}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        product.active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {product.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => window.location.href = `/dashboard/products/${product.id}`}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Table footer */}
          <div className="px-6 py-3 bg-gray-50 border-t text-sm text-gray-500">
            Mostrando {filteredProducts.length} de {products.length} productos
          </div>
        </div>
      )}

      {/* Import modal */}
      {showImport && store && (
        <ImportProducts
          storeId={store.id}
          categories={categories}
          onImportComplete={() => {
            loadData()
          }}
          onClose={() => setShowImport(false)}
        />
      )}
    </>
  )
}
