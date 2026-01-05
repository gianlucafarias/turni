import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSubscriptionLimits } from '../../hooks/useSubscriptionLimits'
import { PremiumPaywall } from './PremiumPaywall'
import AddressAutocomplete from '../ui/AddressAutocomplete'
import { ARGENTINA_PROVINCES } from '../../utils/argentinaProvinces'

interface Branch {
  id: string
  store_id: string
  name: string
  city: string
  province: string
  address: string
  phone: string
  email: string
  display_order: number
  is_active: boolean
}

interface BranchesManagerProps {
  storeId: string
}

export default function BranchesManager({ storeId }: BranchesManagerProps) {
  const { isPremium } = useSubscriptionLimits()
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [showForm, setShowForm] = useState(false)

  // Estados del formulario
  const [formName, setFormName] = useState('')
  const [formCity, setFormCity] = useState('')
  const [formProvince, setFormProvince] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')

  useEffect(() => {
    if (isPremium) {
      loadBranches()
    }
  }, [storeId, isPremium])

  async function loadBranches() {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('store_id', storeId)
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      if (error) throw error
      setBranches(data || [])
    } catch (error: any) {
      console.error('Error cargando sucursales:', error)
      setError('Error al cargar las sucursales')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFormName('')
    setFormCity('')
    setFormProvince('')
    setFormAddress('')
    setFormPhone('')
    setFormEmail('')
    setEditingBranch(null)
    setShowForm(false)
  }

  function handleEdit(branch: Branch) {
    setEditingBranch(branch)
    setFormName(branch.name)
    setFormCity(branch.city)
    setFormProvince(branch.province)
    setFormAddress(branch.address)
    setFormPhone(branch.phone)
    setFormEmail(branch.email)
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    
    console.log('handleSave llamado')
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      if (!formName.trim()) {
        setError('El nombre de la sucursal es obligatorio')
        setSaving(false)
        return
      }

      const branchData: any = {
        store_id: storeId,
        name: formName.trim(),
        city: formCity.trim(),
        province: formProvince.trim(),
        address: formAddress.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim(),
        is_active: true,
      }

      if (editingBranch) {
        // Actualizar
        const { data, error: updateError } = await supabase
          .from('branches')
          .update(branchData)
          .eq('id', editingBranch.id)
          .select()

        if (updateError) {
          console.error('Error actualizando sucursal:', updateError)
          throw updateError
        }
        console.log('Sucursal actualizada:', data)
      } else {
        // Crear
        const maxOrder = branches.length > 0 
          ? Math.max(...branches.map(b => b.display_order || 0)) + 1 
          : 0
        branchData.display_order = maxOrder

        console.log('Intentando crear sucursal con datos:', branchData)
        const { data, error: insertError } = await supabase
          .from('branches')
          .insert(branchData)
          .select()

        if (insertError) {
          console.error('Error insertando sucursal:', insertError)
          throw insertError
        }
        console.log('Sucursal creada:', data)
      }

      setSuccess(true)
      resetForm()
      await loadBranches()
      setTimeout(() => setSuccess(false), 3000)
    } catch (error: any) {
      console.error('Error guardando sucursal:', error)
      const errorMessage = error?.message || error?.error_description || 'Error al guardar la sucursal'
      setError(errorMessage)
      
      // Si es un error de RLS o permisos, mostrar mensaje más específico
      if (errorMessage.includes('permission') || errorMessage.includes('policy') || errorMessage.includes('RLS')) {
        setError('No tenés permisos para crear sucursales. Verificá que la migración se haya ejecutado correctamente.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(branchId: string) {
    if (!confirm('¿Estás seguro de que querés eliminar esta sucursal?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('branches')
        .update({ is_active: false })
        .eq('id', branchId)

      if (error) throw error
      await loadBranches()
    } catch (error: any) {
      console.error('Error eliminando sucursal:', error)
      setError(error.message || 'Error al eliminar la sucursal')
    }
  }

  if (!isPremium) {
    return (
      <PremiumPaywall 
        feature="multiple_branches" 
        storeId={storeId}
        variant="inline"
      />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">📍</span> Sucursales
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Gestioná múltiples ubicaciones para tu negocio
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Agregar Sucursal
          </button>
        )}
      </div>

      {/* Alertas */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-xl flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Sucursal guardada correctamente
        </div>
      )}

      {/* Formulario */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">
              {editingBranch ? 'Editar Sucursal' : 'Nueva Sucursal'}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleSave(e)
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de la sucursal *
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder="Sucursal Centro"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ciudad
                </label>
                <input
                  type="text"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  placeholder="Buenos Aires"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Provincia
                </label>
                <select
                  value={formProvince}
                  onChange={(e) => setFormProvince(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white"
                >
                  {ARGENTINA_PROVINCES.map((prov) => (
                    <option key={prov.value} value={prov.value}>
                      {prov.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dirección completa
              </label>
              <AddressAutocomplete
                value={formAddress}
                onChange={(newAddress) => setFormAddress(newAddress)}
                city={formCity}
                province={formProvince}
                placeholder="Av. Corrientes 1234, CABA"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  placeholder="(011) 1234-5678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  placeholder="sucursal@ejemplo.com"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleSave(e as any)
                }}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de sucursales */}
      {branches.length === 0 && !showForm && (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
          <p className="text-gray-500">No tenés sucursales agregadas</p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            Agregar primera sucursal
          </button>
        </div>
      )}

      {branches.length > 0 && (
        <div className="space-y-3">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1">{branch.name}</h4>
                  {branch.address && (
                    <p className="text-sm text-gray-600 mb-1">{branch.address}</p>
                  )}
                  {(branch.city || branch.province) && (
                    <p className="text-sm text-gray-500">
                      {[branch.city, branch.province].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {branch.phone && (
                    <p className="text-sm text-gray-500 mt-1">📞 {branch.phone}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(branch)}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(branch.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
