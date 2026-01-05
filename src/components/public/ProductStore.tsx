import { useState, useEffect } from 'react'

interface Product {
  id: string
  name: string
  description: string
  price: number
  image_url: string
  stock: number
  category_id: string | null
}

interface Category {
  id: string
  name: string
}

interface CartItem {
  product: Product
  quantity: number
}

interface Props {
  products: Product[]
  categories: Category[]
  storeName: string
  storeId: string
  whatsappNumber: string | null
}

export default function ProductStore({ products, categories, storeName, storeId, whatsappNumber }: Props) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showCheckout, setShowCheckout] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerNote, setCustomerNote] = useState('')
  const [orderSent, setOrderSent] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [productQuantity, setProductQuantity] = useState(1)

  // Cargar carrito desde localStorage
  useEffect(() => {
    const savedCart = localStorage.getItem(`cart_${storeName}`)
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart))
      } catch (e) {
        console.error('Error loading cart:', e)
      }
    }
  }, [storeName])

  // Guardar carrito en localStorage
  useEffect(() => {
    localStorage.setItem(`cart_${storeName}`, JSON.stringify(cart))
  }, [cart, storeName])

  const addToCart = (product: Product, quantity: number = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id)
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + quantity, product.stock) }
            : item
        )
      }
      return [...prev, { product, quantity: Math.min(quantity, product.stock) }]
    })
    
    // Mostrar feedback
    const btn = document.getElementById(`add-btn-${product.id}`)
    if (btn) {
      btn.classList.add('scale-95')
      setTimeout(() => btn.classList.remove('scale-95'), 150)
    }
  }

  const openProductModal = (product: Product) => {
    setSelectedProduct(product)
    setProductQuantity(1)
  }

  const closeProductModal = () => {
    setSelectedProduct(null)
    setProductQuantity(1)
  }

  const addFromModal = () => {
    if (selectedProduct) {
      addToCart(selectedProduct, productQuantity)
      closeProductModal()
    }
  }

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId))
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) {
      removeFromCart(productId)
      return
    }
    setCart(prev =>
      prev.map(item =>
        item.product.id === productId
          ? { ...item, quantity: Math.min(quantity, item.product.stock) }
          : item
      )
    )
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  const filteredProducts = selectedCategory
    ? products.filter(p => p.category_id === selectedCategory)
    : products

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null
    return categories.find(c => c.id === categoryId)?.name || null
  }

  const sendWhatsAppOrder = () => {
    if (!whatsappNumber) return

    let message = `🛒 *Nuevo Pedido - ${storeName}*\n\n`
    
    if (customerName) {
      message += `👤 *Cliente:* ${customerName}\n`
    }
    if (customerPhone) {
      message += `📱 *Teléfono:* ${customerPhone}\n`
    }
    message += `\n─────────────────\n\n`
    message += `📦 *Productos:*\n\n`

    cart.forEach((item, index) => {
      message += `${index + 1}. *${item.product.name}*\n`
      message += `   ${item.quantity} x $${item.product.price.toLocaleString()} = $${(item.quantity * item.product.price).toLocaleString()}\n\n`
    })

    message += `─────────────────\n`
    message += `💰 *TOTAL: $${cartTotal.toLocaleString()}*\n`

    if (customerNote) {
      message += `\n📝 *Nota:* ${customerNote}`
    }

    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`
    
    window.open(whatsappUrl, '_blank')
    
    // Limpiar carrito después de enviar
    setCart([])
    setOrderSent(true)
    setShowCheckout(false)
    setShowCart(false)
    
    setTimeout(() => setOrderSent(false), 5000)
  }

  return (
    <div className="relative">
      {/* Categorías */}
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-4 mb-8 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
              !selectedCategory
                ? 'bg-surface-900 text-white shadow-lg shadow-surface-900/20'
                : 'bg-white/80 backdrop-blur-sm text-surface-600 border border-surface-200/80 hover:bg-white hover:border-surface-300'
            }`}
          >
            Todos ({products.length})
          </button>
          {categories.map(cat => {
            const count = products.filter(p => p.category_id === cat.id).length
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-surface-900 text-white shadow-lg shadow-surface-900/20'
                    : 'bg-white/80 backdrop-blur-sm text-surface-600 border border-surface-200/80 hover:bg-white hover:border-surface-300'
                }`}
              >
                {cat.name} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Grid de productos */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredProducts.map((product, index) => {
            const cartItem = cart.find(item => item.product.id === product.id)
            const isInCart = !!cartItem
            
            return (
              <div 
                key={product.id} 
                className="group animate-fade-in-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-surface-100 hover:border-surface-200 hover:-translate-y-1">
                  {/* Imagen - clickeable */}
                  <div 
                    className="aspect-square bg-surface-100 relative overflow-hidden cursor-pointer"
                    onClick={() => openProductModal(product)}
                  >
                    {product.image_url ? (
                      <img 
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-50 to-surface-100">
                        <svg className="w-16 h-16 text-surface-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    
                    {/* Badge agotado */}
                    {product.stock === 0 && (
                      <div className="absolute inset-0 bg-surface-900/70 flex items-center justify-center backdrop-blur-sm">
                        <span className="text-white font-bold bg-red-500 px-4 py-1.5 rounded-full text-sm shadow-lg">Agotado</span>
                      </div>
                    )}
                    
                    {/* Categoría */}
                    {getCategoryName(product.category_id) && (
                      <span className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm text-surface-700 text-xs font-semibold px-2.5 py-1 rounded-lg shadow-sm">
                        {getCategoryName(product.category_id)}
                      </span>
                    )}

                    {/* Cantidad en carrito */}
                    {isInCart && (
                      <div className="absolute top-3 right-3 bg-brand-500 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center shadow-lg ring-2 ring-white">
                        {cartItem.quantity}
                      </div>
                    )}

                    {/* Overlay de ver más */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 bg-white/95 backdrop-blur px-4 py-2 rounded-xl text-sm font-semibold text-surface-800 shadow-xl">
                        Ver detalle
                      </span>
                    </div>
                  </div>
                  
                  {/* Info */}
                  <div className="p-4">
                    <h3 
                      className="font-semibold text-surface-900 leading-tight line-clamp-2 min-h-[2.5rem] cursor-pointer hover:text-brand-600 transition-colors"
                      onClick={() => openProductModal(product)}
                    >
                      {product.name}
                    </h3>
                    <p className="text-2xl font-black text-surface-900 mt-2 tracking-tight">
                      ${product.price.toLocaleString()}
                    </p>
                    
                    {/* Botón agregar */}
                    {product.stock > 0 && (
                      <button
                        id={`add-btn-${product.id}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          addToCart(product)
                        }}
                        className={`mt-4 w-full py-3 rounded-xl text-sm font-bold transition-all transform ${
                          isInCart
                            ? 'bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200'
                            : 'bg-surface-900 text-white hover:bg-surface-800 shadow-lg shadow-surface-900/20 hover:shadow-xl'
                        }`}
                      >
                        {isInCart ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Agregar más
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            Agregar
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-24">
          <div className="w-28 h-28 mx-auto mb-6 bg-gradient-to-br from-surface-100 to-surface-50 rounded-2xl flex items-center justify-center">
            <svg className="w-14 h-14 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-surface-900 mb-2">No hay productos</h3>
          <p className="text-surface-500 text-lg">
            {selectedCategory ? 'No hay productos en esta categoría' : 'Próximamente habrá productos disponibles'}
          </p>
          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory(null)}
              className="mt-6 text-brand-600 font-semibold hover:text-brand-700 transition-colors inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Ver todos los productos
            </button>
          )}
        </div>
      )}

      {/* Botón flotante del carrito */}
      {cart.length > 0 && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white p-4 rounded-2xl shadow-2xl shadow-emerald-500/30 hover:shadow-emerald-500/40 transition-all hover:scale-105 z-40 flex items-center gap-3 group"
        >
          <div className="relative">
            <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="absolute -top-2 -right-2 bg-white text-emerald-600 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
              {cartCount}
            </span>
          </div>
          <span className="font-bold">${cartTotal.toLocaleString()}</span>
        </button>
      )}

      {/* Modal del carrito */}
      {showCart && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCart(false)} />
          
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-in">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-surface-200">
              <div>
                <h2 className="text-xl font-bold text-surface-900">Tu carrito</h2>
                <p className="text-surface-500 text-sm">{cartCount} {cartCount === 1 ? 'producto' : 'productos'}</p>
              </div>
              <button
                onClick={() => setShowCart(false)}
                className="p-2 text-surface-400 hover:text-surface-600 rounded-xl hover:bg-surface-100 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.map(item => (
                <div key={item.product.id} className="flex gap-4 bg-surface-50 rounded-2xl p-4 border border-surface-100">
                  <div className="w-20 h-20 bg-surface-200 rounded-xl overflow-hidden flex-shrink-0">
                    {item.product.image_url ? (
                      <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-surface-400">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-surface-900 truncate">{item.product.name}</h4>
                    <p className="text-lg font-bold text-surface-900">${item.product.price.toLocaleString()}</p>
                    
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="w-8 h-8 rounded-lg bg-white border border-surface-200 flex items-center justify-center text-surface-600 hover:bg-surface-100 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                        </svg>
                      </button>
                      <span className="font-semibold text-surface-900 w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        disabled={item.quantity >= item.product.stock}
                        className="w-8 h-8 rounded-lg bg-white border border-surface-200 flex items-center justify-center text-surface-600 hover:bg-surface-100 disabled:opacity-50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </button>
                      
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="ml-auto p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {cart.length === 0 && (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-surface-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-surface-500">Tu carrito está vacío</p>
                </div>
              )}
            </div>

            {/* Footer */}
            {cart.length > 0 && (
              <div className="border-t border-surface-200 p-6 space-y-4 bg-surface-50">
                <div className="flex justify-between items-center">
                  <span className="text-surface-600">Subtotal</span>
                  <span className="text-2xl font-black text-surface-900">${cartTotal.toLocaleString()}</span>
                </div>
                
                {whatsappNumber ? (
                  <button
                    onClick={() => setShowCheckout(true)}
                    className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:from-emerald-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Enviar pedido por WhatsApp
                  </button>
                ) : (
                  <p className="text-center text-surface-500 text-sm">
                    Esta tienda no tiene WhatsApp configurado
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de checkout */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCheckout(false)} />
          
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-scale-in">
            <button
              onClick={() => setShowCheckout(false)}
              className="absolute top-4 right-4 p-2 text-surface-400 hover:text-surface-600 rounded-lg hover:bg-surface-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-surface-900">Finalizar pedido</h3>
              <p className="text-surface-500 mt-1">Tus datos para el envío por WhatsApp</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                  Tu nombre (opcional)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="¿Cómo te llamás?"
                  className="w-full px-4 py-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-surface-50 transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                  Tu teléfono (opcional)
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Para que te contacten"
                  className="w-full px-4 py-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-surface-50 transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                  Notas adicionales (opcional)
                </label>
                <textarea
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="Ej: Dirección de entrega, horario preferido..."
                  rows={3}
                  className="w-full px-4 py-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none bg-surface-50 transition-colors"
                />
              </div>
            </div>

            {/* Resumen */}
            <div className="mt-6 p-4 bg-surface-50 rounded-xl border border-surface-100">
              <div className="flex justify-between items-center text-sm text-surface-600 mb-2">
                <span>{cartCount} productos</span>
                <span>${cartTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center font-bold text-surface-900">
                <span>Total a pagar</span>
                <span className="text-xl">${cartTotal.toLocaleString()}</span>
              </div>
            </div>

            <button
              onClick={sendWhatsAppOrder}
              className="w-full mt-6 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:from-emerald-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Enviar pedido
            </button>
          </div>
        </div>
      )}

      {/* Modal de producto */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeProductModal} />
          
          <div className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col animate-slide-in">
            {/* Header con imagen */}
            <div className="relative">
              <div className="aspect-square bg-surface-100 relative overflow-hidden">
                {selectedProduct.image_url ? (
                  <img 
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-50 to-surface-100">
                    <svg className="w-24 h-24 text-surface-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                
                {/* Categoría */}
                {getCategoryName(selectedProduct.category_id) && (
                  <span className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm text-surface-700 text-sm font-semibold px-3 py-1.5 rounded-lg shadow-md">
                    {getCategoryName(selectedProduct.category_id)}
                  </span>
                )}

                {/* Badge agotado */}
                {selectedProduct.stock === 0 && (
                  <div className="absolute inset-0 bg-surface-900/70 flex items-center justify-center backdrop-blur-sm">
                    <span className="text-white font-bold bg-red-500 px-5 py-2.5 rounded-xl shadow-lg">Agotado</span>
                  </div>
                )}
              </div>
              
              {/* Botón cerrar */}
              <button
                onClick={closeProductModal}
                className="absolute top-4 right-4 w-10 h-10 bg-white/95 backdrop-blur rounded-xl flex items-center justify-center text-surface-600 hover:bg-white shadow-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Contenido */}
            <div className="flex-1 overflow-y-auto p-6">
              <h2 className="text-2xl font-bold text-surface-900">{selectedProduct.name}</h2>
              
              <p className="text-3xl font-black text-surface-900 mt-3 tracking-tight">
                ${selectedProduct.price.toLocaleString()}
              </p>

              {selectedProduct.description && (
                <div className="mt-6">
                  <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-2">Descripción</h3>
                  <p className="text-surface-600 whitespace-pre-line leading-relaxed">{selectedProduct.description}</p>
                </div>
              )}

              {/* Stock */}
              <div className="mt-6 flex items-center gap-2">
                {selectedProduct.stock > 0 ? (
                  <>
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span className="text-sm text-emerald-700 font-semibold">
                      {selectedProduct.stock} {selectedProduct.stock === 1 ? 'unidad disponible' : 'unidades disponibles'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full"></span>
                    <span className="text-sm text-red-600 font-semibold">Sin stock</span>
                  </>
                )}
              </div>

              {/* Selector de cantidad */}
              {selectedProduct.stock > 0 && (
                <div className="mt-8">
                  <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-3">Cantidad</h3>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setProductQuantity(Math.max(1, productQuantity - 1))}
                      className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center text-surface-600 hover:bg-surface-200 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                      </svg>
                    </button>
                    <span className="text-2xl font-bold text-surface-900 w-12 text-center">{productQuantity}</span>
                    <button
                      onClick={() => setProductQuantity(Math.min(selectedProduct.stock, productQuantity + 1))}
                      disabled={productQuantity >= selectedProduct.stock}
                      className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center text-surface-600 hover:bg-surface-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Consultar por WhatsApp */}
              {whatsappNumber && (
                <a
                  href={`https://wa.me/${whatsappNumber}?text=Hola! Tengo una consulta sobre: ${selectedProduct.name} ($${selectedProduct.price.toLocaleString()})`}
                  target="_blank"
                  className="mt-8 w-full inline-flex items-center justify-center gap-2 text-emerald-600 hover:text-emerald-700 font-semibold text-sm hover:underline transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  ¿Tenés alguna consulta? Escribinos
                </a>
              )}
            </div>

            {/* Footer con botón de agregar */}
            {selectedProduct.stock > 0 && (
              <div className="border-t border-surface-200 p-6 bg-surface-50">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-surface-600">Subtotal</span>
                  <span className="text-2xl font-black text-surface-900">
                    ${(selectedProduct.price * productQuantity).toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={addFromModal}
                  className="w-full bg-gradient-to-r from-surface-900 to-surface-800 text-white py-4 rounded-xl font-bold text-lg hover:from-surface-800 hover:to-surface-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-surface-900/25"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Agregar {productQuantity > 1 ? `${productQuantity} unidades` : 'al carrito'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast de éxito */}
      {orderSent && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-surface-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-bounce-in z-50">
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          ¡Pedido enviado!
        </div>
      )}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
        
        @keyframes scale-in {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in { animation: scale-in 0.2s ease-out; }
        
        @keyframes bounce-in {
          0% { transform: translateX(-50%) translateY(20px); opacity: 0; }
          50% { transform: translateX(-50%) translateY(-5px); }
          100% { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        .animate-bounce-in { animation: bounce-in 0.4s ease-out; }

        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.5s ease-out forwards; opacity: 0; }
      `}</style>
    </div>
  )
}
