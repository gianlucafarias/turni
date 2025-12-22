import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

interface Client {
  id: string
  first_name: string
  last_name: string | null
  email: string | null
  phone: string | null
}

interface ClientAutocompleteProps {
  storeId: string
  value: string
  onChange: (value: string) => void
  onClientSelect: (client: Client) => void
  className?: string
  placeholder?: string
  required?: boolean
}

export default function ClientAutocomplete({
  storeId,
  value,
  onChange,
  onClientSelect,
  className = '',
  placeholder = 'Nombre completo',
  required = false
}: ClientAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Client[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Cerrar sugerencias al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Buscar clientes cuando el usuario escribe
  useEffect(() => {
    const searchClients = async () => {
      if (!value || value.trim().length < 2) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }

      setIsSearching(true)
      try {
        const searchTerm = value.trim()
        
        // Buscar por nombre o apellido usando OR
        // La sintaxis de Supabase para OR con ilike es: campo.ilike.valor,campo2.ilike.valor2
        const { data, error } = await supabase
          .from('clients')
          .select('id, first_name, last_name, email, phone')
          .eq('store_id', storeId)
          .eq('is_active', true)
          .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`)
          .limit(10)
          .order('last_appointment_date', { ascending: false, nullsFirst: false })

        if (error) throw error

        setSuggestions(data || [])
        setShowSuggestions((data || []).length > 0)
      } catch (error) {
        console.error('Error buscando clientes:', error)
        setSuggestions([])
        setShowSuggestions(false)
      } finally {
        setIsSearching(false)
      }
    }

    const debounceTimer = setTimeout(searchClients, 300)
    return () => clearTimeout(debounceTimer)
  }, [value, storeId])

  const handleSelectClient = (client: Client) => {
    const fullName = `${client.first_name}${client.last_name ? ' ' + client.last_name : ''}`
    onChange(fullName)
    onClientSelect(client)
    setShowSuggestions(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
    setShowSuggestions(true)
  }

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true)
    }
  }

  const getClientDisplayName = (client: Client) => {
    return `${client.first_name}${client.last_name ? ' ' + client.last_name : ''}`
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        required={required}
        className={className}
        placeholder={placeholder}
        autoComplete="off"
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {isSearching && (
            <div className="px-4 py-2 text-sm text-gray-500 text-center">
              Buscando...
            </div>
          )}
          {suggestions.map((client) => (
            <button
              key={client.id}
              type="button"
              onClick={() => handleSelectClient(client)}
              className="w-full px-4 py-3 text-left hover:bg-indigo-50 transition-colors border-b border-gray-100 last:border-b-0"
            >
              <div className="font-medium text-gray-900">
                {getClientDisplayName(client)}
              </div>
              <div className="text-xs text-gray-500 mt-0.5 space-x-3">
                {client.email && <span>📧 {client.email}</span>}
                {client.phone && <span>📱 {client.phone}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

