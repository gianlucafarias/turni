# 📱 Integración con WhatsApp Business - Importación de Catálogo

> **Estado:** Documentado para implementación futura (v2)
> **Prioridad:** Media
> **Complejidad:** Alta

## Resumen

Esta funcionalidad permitirá a los usuarios importar automáticamente su catálogo de WhatsApp Business a la plataforma mediante OAuth con Meta.

---

## Arquitectura

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Usuario       │────▶│  Meta OAuth      │────▶│  Graph API      │
│   (Dashboard)   │     │  (Autorización)  │     │  (Catálogo)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │   Supabase      │
                                                 │   (products)    │
                                                 └─────────────────┘
```

---

## Requisitos Previos

### 1. Crear App en Meta for Developers

1. Ir a [developers.facebook.com](https://developers.facebook.com)
2. Crear nueva app tipo "Business"
3. Configurar OAuth redirect URI: `https://tu-dominio.com/api/meta/callback`

### 2. Permisos Necesarios

Solicitar los siguientes permisos en la revisión de la app:

| Permiso | Descripción |
|---------|-------------|
| `catalog_management` | Leer y gestionar catálogos de productos |
| `business_management` | Acceder a información del negocio |
| `whatsapp_business_management` | Gestionar WhatsApp Business |

### 3. Variables de Entorno

```env
# Meta/Facebook App
META_APP_ID=tu_app_id
META_APP_SECRET=tu_app_secret
META_REDIRECT_URI=https://tu-dominio.com/api/meta/callback
```

---

## Flujo de Implementación

### Paso 1: Endpoint de Inicio OAuth

```typescript
// src/pages/api/meta/auth.ts
import type { APIRoute } from 'astro'

export const GET: APIRoute = async ({ redirect }) => {
  const params = new URLSearchParams({
    client_id: import.meta.env.META_APP_ID,
    redirect_uri: import.meta.env.META_REDIRECT_URI,
    scope: 'catalog_management,business_management',
    response_type: 'code',
    state: crypto.randomUUID() // Para prevenir CSRF
  })
  
  return redirect(`https://www.facebook.com/v18.0/dialog/oauth?${params}`)
}
```

### Paso 2: Callback OAuth

```typescript
// src/pages/api/meta/callback.ts
import type { APIRoute } from 'astro'

export const GET: APIRoute = async ({ request, cookies }) => {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  
  if (!code) {
    return new Response('Error de autorización', { status: 400 })
  }
  
  // Intercambiar código por access token
  const tokenResponse = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?` +
    `client_id=${import.meta.env.META_APP_ID}` +
    `&redirect_uri=${import.meta.env.META_REDIRECT_URI}` +
    `&client_secret=${import.meta.env.META_APP_SECRET}` +
    `&code=${code}`
  )
  
  const { access_token } = await tokenResponse.json()
  
  // Guardar token en la base de datos (encriptado)
  // ... guardar en tabla stores o nueva tabla meta_integrations
  
  return Response.redirect('/dashboard/products?meta_connected=true')
}
```

### Paso 3: Obtener Catálogos del Usuario

```typescript
// src/lib/meta-api.ts

interface MetaCatalog {
  id: string
  name: string
  product_count: number
}

interface MetaProduct {
  id: string
  name: string
  description: string
  price: string
  currency: string
  image_url: string
  availability: string
  category: string
  retailer_id: string
}

export async function getUserCatalogs(accessToken: string): Promise<MetaCatalog[]> {
  // Primero obtener el Business ID
  const meResponse = await fetch(
    'https://graph.facebook.com/v18.0/me/businesses',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const { data: businesses } = await meResponse.json()
  
  if (!businesses?.length) return []
  
  // Obtener catálogos del negocio
  const catalogsResponse = await fetch(
    `https://graph.facebook.com/v18.0/${businesses[0].id}/owned_product_catalogs`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  
  const { data: catalogs } = await catalogsResponse.json()
  return catalogs || []
}

export async function getCatalogProducts(
  accessToken: string, 
  catalogId: string
): Promise<MetaProduct[]> {
  const products: MetaProduct[] = []
  let url = `https://graph.facebook.com/v18.0/${catalogId}/products?` +
    `fields=id,name,description,price,currency,image_url,availability,category,retailer_id` +
    `&limit=100`
  
  // Paginación
  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const data = await response.json()
    
    products.push(...(data.data || []))
    url = data.paging?.next || null
  }
  
  return products
}
```

### Paso 4: Importar Productos a Supabase

```typescript
// src/lib/import-catalog.ts
import { supabase } from './supabase'
import { getCatalogProducts } from './meta-api'

interface ImportResult {
  imported: number
  updated: number
  errors: string[]
}

export async function importFromMeta(
  storeId: string,
  accessToken: string,
  catalogId: string
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, updated: 0, errors: [] }
  
  try {
    const metaProducts = await getCatalogProducts(accessToken, catalogId)
    
    for (const product of metaProducts) {
      // Parsear precio (Meta lo devuelve como "100.00 USD")
      const priceMatch = product.price?.match(/(\d+\.?\d*)/)
      const price = priceMatch ? parseFloat(priceMatch[1]) : 0
      
      // Verificar si ya existe (por retailer_id como external_id)
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('store_id', storeId)
        .eq('external_id', product.retailer_id)
        .single()
      
      const productData = {
        store_id: storeId,
        name: product.name,
        description: product.description || '',
        price,
        image_url: product.image_url,
        active: product.availability === 'in stock',
        external_id: product.retailer_id,
        external_source: 'whatsapp_business',
        updated_at: new Date().toISOString()
      }
      
      if (existing) {
        // Actualizar
        await supabase
          .from('products')
          .update(productData)
          .eq('id', existing.id)
        result.updated++
      } else {
        // Crear nuevo
        await supabase
          .from('products')
          .insert({ ...productData, created_at: new Date().toISOString() })
        result.imported++
      }
    }
  } catch (error: any) {
    result.errors.push(error.message)
  }
  
  return result
}
```

---

## Componente UI (React)

```tsx
// src/components/products/ImportFromWhatsApp.tsx
import { useState } from 'react'

interface Catalog {
  id: string
  name: string
  product_count: number
}

export default function ImportFromWhatsApp() {
  const [isConnected, setIsConnected] = useState(false)
  const [catalogs, setCatalogs] = useState<Catalog[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)

  async function connectMeta() {
    window.location.href = '/api/meta/auth'
  }

  async function loadCatalogs() {
    const response = await fetch('/api/meta/catalogs')
    const data = await response.json()
    setCatalogs(data.catalogs)
  }

  async function importCatalog(catalogId: string) {
    setImporting(true)
    try {
      const response = await fetch('/api/meta/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalogId })
      })
      const data = await response.json()
      setResult(data)
    } finally {
      setImporting(false)
    }
  }

  if (!isConnected) {
    return (
      <button 
        onClick={connectMeta}
        className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        Conectar WhatsApp Business
      </button>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Selecciona un catálogo para importar:</h3>
      
      {catalogs.map(catalog => (
        <div key={catalog.id} className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <p className="font-medium">{catalog.name}</p>
            <p className="text-sm text-gray-500">{catalog.product_count} productos</p>
          </div>
          <button
            onClick={() => importCatalog(catalog.id)}
            disabled={importing}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {importing ? 'Importando...' : 'Importar'}
          </button>
        </div>
      ))}
      
      {result && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800">
            ✅ {result.imported} productos importados, {result.updated} actualizados
          </p>
        </div>
      )}
    </div>
  )
}
```

---

## Migraciones Necesarias

```sql
-- Agregar campos para tracking de productos externos
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS external_id TEXT,
ADD COLUMN IF NOT EXISTS external_source TEXT;

-- Crear índice para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_products_external 
ON products(store_id, external_id, external_source);

-- Tabla para guardar tokens de Meta (opcional, más seguro)
CREATE TABLE IF NOT EXISTS meta_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL, -- Encriptar en producción
  token_expires_at TIMESTAMPTZ,
  business_id TEXT,
  catalog_id TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id)
);
```

---

## Consideraciones de Seguridad

1. **Encriptar tokens**: Usar encriptación AES-256 para guardar access tokens
2. **Tokens de corta duración**: Los tokens de Meta expiran, implementar refresh
3. **Rate limiting**: Meta tiene límites de API, implementar cola de trabajos
4. **CSRF protection**: Usar state parameter en OAuth
5. **Validar webhook signatures**: Si se implementan webhooks de Meta

---

## Tiempo Estimado de Implementación

| Tarea | Tiempo |
|-------|--------|
| Crear y configurar app en Meta | 1 día |
| Solicitar y esperar aprobación de permisos | 1-2 semanas |
| Implementar flujo OAuth | 2 días |
| Implementar importación de productos | 2 días |
| UI y testing | 2 días |
| **Total** | **~3 semanas** |

---

## Referencias

- [Meta for Developers](https://developers.facebook.com)
- [Graph API - Product Catalog](https://developers.facebook.com/docs/marketing-api/reference/product-catalog)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [OAuth 2.0 de Facebook](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow)

---

> **Nota:** Esta documentación fue creada el 4 de diciembre de 2024. Verificar documentación oficial de Meta antes de implementar ya que las APIs pueden cambiar.



