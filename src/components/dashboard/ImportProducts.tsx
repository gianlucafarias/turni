import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

interface ImportResult {
  total: number
  imported: number
  errors: { row: number; error: string }[]
}

interface Category {
  id: string
  name: string
}

interface Props {
  storeId: string
  categories: Category[]
  onImportComplete: () => void
  onClose: () => void
}

export default function ImportProducts({ storeId, categories, onImportComplete, onClose }: Props) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const requiredFields = ['name', 'price']
  const optionalFields = ['description', 'stock', 'image_url', 'category', 'active']
  const allFields = [...requiredFields, ...optionalFields]

  function parseCSV(text: string): { headers: string[]; rows: string[][] } {
    const lines = text.split('\n').filter(line => line.trim())
    if (lines.length < 2) {
      throw new Error('El archivo debe tener al menos una fila de encabezados y una de datos')
    }

    // Detectar separador (coma, punto y coma, o tab)
    const firstLine = lines[0]
    let separator = ','
    if (firstLine.includes(';')) separator = ';'
    else if (firstLine.includes('\t')) separator = '\t'

    const headers = lines[0].split(separator).map(h => h.trim().replace(/^["']|["']$/g, ''))
    const rows = lines.slice(1).map(line => {
      // Manejo básico de comillas en CSV
      const values: string[] = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"' && !inQuotes) {
          inQuotes = true
        } else if (char === '"' && inQuotes) {
          inQuotes = false
        } else if (char === separator && !inQuotes) {
          values.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      values.push(current.trim())
      
      return values.map(v => v.replace(/^["']|["']$/g, ''))
    })

    return { headers, rows }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setError(null)
    setFile(selectedFile)

    try {
      const text = await selectedFile.text()
      const { headers, rows } = parseCSV(text)

      // Auto-mapear columnas por nombre similar
      const mapping: Record<string, string> = {}
      headers.forEach((header, index) => {
        const normalized = header.toLowerCase()
          .replace(/[áàä]/g, 'a')
          .replace(/[éèë]/g, 'e')
          .replace(/[íìï]/g, 'i')
          .replace(/[óòö]/g, 'o')
          .replace(/[úùü]/g, 'u')
          .replace(/ñ/g, 'n')
        
        if (normalized.includes('nombre') || normalized === 'name' || normalized === 'producto') {
          mapping[index.toString()] = 'name'
        } else if (normalized.includes('precio') || normalized === 'price') {
          mapping[index.toString()] = 'price'
        } else if (normalized.includes('descripcion') || normalized === 'description') {
          mapping[index.toString()] = 'description'
        } else if (normalized.includes('stock') || normalized.includes('cantidad') || normalized.includes('inventario')) {
          mapping[index.toString()] = 'stock'
        } else if (normalized.includes('imagen') || normalized === 'image' || normalized === 'image_url' || normalized === 'foto') {
          mapping[index.toString()] = 'image_url'
        } else if (normalized.includes('categoria') || normalized === 'category') {
          mapping[index.toString()] = 'category'
        } else if (normalized.includes('activo') || normalized === 'active' || normalized === 'estado') {
          mapping[index.toString()] = 'active'
        }
      })

      setColumnMapping(mapping)
      setPreviewData(rows.slice(0, 5).map((row, rowIndex) => ({
        _rowIndex: rowIndex,
        _original: row,
        ...headers.reduce((acc, header, index) => {
          acc[header] = row[index] || ''
          return acc
        }, {} as Record<string, string>)
      })))

      // Guardar headers para uso posterior
      ;(window as any).__importHeaders = headers
      ;(window as any).__importRows = rows

      setStep('preview')
    } catch (err: any) {
      setError(err.message || 'Error al leer el archivo')
    }
  }

  async function handleImport() {
    if (!file) return

    setImporting(true)
    setStep('importing')

    const headers = (window as any).__importHeaders as string[]
    const rows = (window as any).__importRows as string[][]
    
    const importResult: ImportResult = {
      total: rows.length,
      imported: 0,
      errors: []
    }

    // Crear mapa de categorías por nombre
    const categoryMap: Record<string, string> = {}
    categories.forEach(cat => {
      categoryMap[cat.name.toLowerCase()] = cat.id
    })

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      
      try {
        // Construir objeto de producto basado en mapping
        const product: Record<string, any> = {
          store_id: storeId,
          active: true
        }

        // Aplicar mapping
        Object.entries(columnMapping).forEach(([colIndex, field]) => {
          const value = row[parseInt(colIndex)]
          
          if (field === 'name') {
            product.name = value?.trim()
          } else if (field === 'price') {
            // Limpiar precio (remover $, espacios, convertir coma a punto)
            const cleanPrice = value?.replace(/[^0-9.,]/g, '').replace(',', '.')
            product.price = parseFloat(cleanPrice) || 0
          } else if (field === 'description') {
            product.description = value?.trim() || ''
          } else if (field === 'stock') {
            product.stock = parseInt(value) || 0
          } else if (field === 'image_url') {
            product.image_url = value?.trim() || ''
          } else if (field === 'category') {
            // Buscar categoría por nombre
            const catName = value?.trim().toLowerCase()
            if (catName && categoryMap[catName]) {
              product.category_id = categoryMap[catName]
            }
          } else if (field === 'active') {
            const val = value?.toLowerCase()
            product.active = val !== 'no' && val !== 'false' && val !== '0' && val !== 'inactivo'
          }
        })

        // Validar campos requeridos
        if (!product.name) {
          throw new Error('Falta el nombre del producto')
        }
        if (product.price === undefined || isNaN(product.price)) {
          throw new Error('Precio inválido')
        }

        // Valores por defecto
        if (!product.description) product.description = ''
        if (!product.image_url) product.image_url = ''
        if (product.stock === undefined) product.stock = 0

        // Insertar en la base de datos
        const { error: insertError } = await supabase
          .from('products')
          .insert(product)

        if (insertError) {
          throw new Error(insertError.message)
        }

        importResult.imported++
      } catch (err: any) {
        importResult.errors.push({
          row: i + 2, // +2 porque es 1-indexed y hay header
          error: err.message
        })
      }
    }

    setResult(importResult)
    setImporting(false)
    setStep('complete')

    if (importResult.imported > 0) {
      onImportComplete()
    }
  }

  function downloadTemplate() {
    const template = `nombre,descripcion,precio,stock,imagen_url,categoria,activo
"Producto de ejemplo","Descripción del producto",1500,10,"https://ejemplo.com/imagen.jpg","Mi Categoría","si"
"Otro producto","Otra descripción",2500,5,"","","si"`
    
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'plantilla_productos.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Overlay */}
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        
        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Importar Productos</h2>
              <p className="text-sm text-gray-500 mt-1">
                {step === 'upload' && 'Sube un archivo CSV o Excel con tus productos'}
                {step === 'preview' && 'Verifica el mapeo de columnas'}
                {step === 'importing' && 'Importando productos...'}
                {step === 'complete' && 'Importación completada'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {step === 'upload' && (
              <div className="space-y-6">
                {/* Dropzone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all"
                >
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-lg font-medium text-gray-700">
                    Arrastra tu archivo aquí o haz clic para seleccionar
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Formatos soportados: CSV, Excel (.xlsx, .xls)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    {error}
                  </div>
                )}

                {/* Template download */}
                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="font-medium text-gray-900 mb-2">📋 Plantilla de ejemplo</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Descarga nuestra plantilla CSV para asegurarte de que tu archivo tiene el formato correcto.
                  </p>
                  <button
                    onClick={downloadTemplate}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Descargar Plantilla
                  </button>
                </div>

                {/* Export from WhatsApp info */}
                <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-green-900">¿Tenés catálogo en WhatsApp Business?</h3>
                      <p className="text-sm text-green-700 mt-1">
                        Podés exportar tus productos desde el <strong>Commerce Manager de Meta</strong>:
                      </p>
                      <ol className="text-sm text-green-700 mt-2 list-decimal list-inside space-y-1">
                        <li>Ingresá a <a href="https://business.facebook.com/commerce" target="_blank" className="underline">business.facebook.com/commerce</a></li>
                        <li>Seleccioná tu catálogo de WhatsApp</li>
                        <li>Ve a "Artículos" → "Exportar"</li>
                        <li>Descargá el CSV y subilo acá</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 'preview' && (
              <div className="space-y-6">
                {/* File info */}
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <p className="font-medium text-gray-900">{file?.name}</p>
                    <p className="text-sm text-gray-500">
                      {(window as any).__importRows?.length || 0} productos encontrados
                    </p>
                  </div>
                </div>

                {/* Column mapping */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Mapeo de columnas</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Asegurate de que cada columna esté mapeada correctamente. Los campos marcados con * son obligatorios.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {((window as any).__importHeaders as string[] || []).map((header, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Columna: "{header}"
                          </label>
                          <select
                            value={columnMapping[index.toString()] || ''}
                            onChange={(e) => setColumnMapping(prev => ({
                              ...prev,
                              [index.toString()]: e.target.value
                            }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          >
                            <option value="">-- No importar --</option>
                            <optgroup label="Requeridos">
                              <option value="name">Nombre *</option>
                              <option value="price">Precio *</option>
                            </optgroup>
                            <optgroup label="Opcionales">
                              <option value="description">Descripción</option>
                              <option value="stock">Stock</option>
                              <option value="image_url">URL de imagen</option>
                              <option value="category">Categoría</option>
                              <option value="active">Activo</option>
                            </optgroup>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preview table */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Vista previa (primeros 5 productos)</h3>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {((window as any).__importHeaders as string[] || []).map((header, idx) => (
                            <th key={idx} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              {header}
                              {columnMapping[idx.toString()] && (
                                <span className="block text-blue-600 normal-case font-normal">
                                  → {columnMapping[idx.toString()]}
                                </span>
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {previewData.map((row, rowIdx) => (
                          <tr key={rowIdx}>
                            {row._original.map((cell: string, cellIdx: number) => (
                              <td key={cellIdx} className="px-4 py-2 whitespace-nowrap text-gray-700">
                                {cell?.substring(0, 50)}{cell?.length > 50 ? '...' : ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Validation */}
                {!Object.values(columnMapping).includes('name') || !Object.values(columnMapping).includes('price') ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
                    ⚠️ Debés mapear al menos las columnas de <strong>Nombre</strong> y <strong>Precio</strong> para continuar.
                  </div>
                ) : null}
              </div>
            )}

            {step === 'importing' && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-6"></div>
                <p className="text-lg font-medium text-gray-900">Importando productos...</p>
                <p className="text-gray-500 mt-2">Esto puede tomar unos segundos</p>
              </div>
            )}

            {step === 'complete' && result && (
              <div className="space-y-6">
                {/* Success message */}
                <div className={`p-6 rounded-xl ${result.imported > 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                  <div className="flex items-center gap-4">
                    {result.imported > 0 ? (
                      <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                    )}
                    <div>
                      <h3 className={`text-lg font-semibold ${result.imported > 0 ? 'text-green-900' : 'text-yellow-900'}`}>
                        {result.imported > 0 ? '¡Importación completada!' : 'Importación con errores'}
                      </h3>
                      <p className={result.imported > 0 ? 'text-green-700' : 'text-yellow-700'}>
                        {result.imported} de {result.total} productos importados correctamente
                      </p>
                    </div>
                  </div>
                </div>

                {/* Errors list */}
                {result.errors.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">
                      Errores ({result.errors.length})
                    </h3>
                    <div className="max-h-48 overflow-y-auto border rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium text-gray-500">Fila</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-500">Error</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {result.errors.slice(0, 20).map((err, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-2 text-gray-700">{err.row}</td>
                              <td className="px-4 py-2 text-red-600">{err.error}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {result.errors.length > 20 && (
                        <p className="p-2 text-center text-sm text-gray-500">
                          Y {result.errors.length - 20} errores más...
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t bg-gray-50">
            {step === 'upload' && (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                >
                  Cancelar
                </button>
                <div></div>
              </>
            )}

            {step === 'preview' && (
              <>
                <button
                  onClick={() => {
                    setStep('upload')
                    setFile(null)
                    setPreviewData([])
                    setColumnMapping({})
                  }}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                >
                  ← Volver
                </button>
                <button
                  onClick={handleImport}
                  disabled={!Object.values(columnMapping).includes('name') || !Object.values(columnMapping).includes('price')}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Importar {(window as any).__importRows?.length || 0} productos
                </button>
              </>
            )}

            {step === 'complete' && (
              <>
                <div></div>
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Cerrar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}



