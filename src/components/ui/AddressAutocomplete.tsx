import { useEffect, useRef, useState } from 'react'

interface AddressAutocompleteProps {
  value: string
  onChange: (address: string, placeDetails?: any) => void
  city?: string
  province?: string
  placeholder?: string
  className?: string
  required?: boolean
}

declare global {
  interface Window {
    google: any
    initGoogleMaps: () => void
  }
}

export default function AddressAutocomplete({
  value,
  onChange,
  city,
  province,
  placeholder = 'Ingresa una dirección',
  className = '',
  required = false
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Cargar Google Maps Places API
  useEffect(() => {
    if (window.google?.maps?.places) {
      setIsLoaded(true)
      setIsLoading(false)
      return
    }

    // Verificar si ya se está cargando
    if (window.initGoogleMaps) {
      return
    }

    setIsLoading(true)
    const apiKey = import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      console.warn('PUBLIC_GOOGLE_MAPS_API_KEY no está configurada. El autocompletado no funcionará.')
      setIsLoading(false)
      return
    }

    // Función para inicializar cuando se carga el script
    window.initGoogleMaps = () => {
      setIsLoaded(true)
      setIsLoading(false)
    }

    // Verificar si el script ya existe
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
    if (existingScript) {
      // Si el script existe pero google no está disponible, esperar un poco
      const checkInterval = setInterval(() => {
        if (window.google?.maps?.places) {
          setIsLoaded(true)
          setIsLoading(false)
          clearInterval(checkInterval)
        }
      }, 100)
      return () => clearInterval(checkInterval)
    }

    // Cargar el script
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`
    script.async = true
    script.defer = true
    script.onerror = () => {
      console.error('Error cargando Google Maps API')
      setIsLoading(false)
    }
    document.head.appendChild(script)

    return () => {
      // Limpiar callback global si es necesario
      if (window.initGoogleMaps) {
        delete window.initGoogleMaps
      }
    }
  }, [])

  // Inicializar autocompletado cuando Google Maps esté listo
  useEffect(() => {
    if (!isLoaded || !inputRef.current) return

    // Limpiar autocompletado anterior si existe
    if (autocompleteRef.current && window.google?.maps?.event) {
      window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
    }

    // Configurar restricciones de búsqueda
    const options: any = {
      types: ['address'],
      componentRestrictions: { country: 'ar' }, // Restringir a Argentina
    }

    // Crear el autocompletado estándar
    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, options)
    autocompleteRef.current = autocomplete

    // Listener para cuando se selecciona una dirección
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      
      if (place.formatted_address) {
        onChange(place.formatted_address, place)
      }
    })

    return () => {
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, [isLoaded, onChange])

  // Filtrar resultados del autocompletado por ciudad y provincia
  useEffect(() => {
    if (!isLoaded || !inputRef.current || (!city && !province)) return

    const filterResults = () => {
      const pacContainer = document.querySelector('.pac-container')
      if (pacContainer) {
        const items = pacContainer.querySelectorAll('.pac-item')
        items.forEach((item) => {
          const text = (item.textContent || '').toLowerCase()
          const cityLower = city?.toLowerCase() || ''
          const provinceLower = province?.toLowerCase() || ''
          
          let shouldHide = false
          
          // Si hay ciudad y no está en el texto, ocultar
          if (cityLower && !text.includes(cityLower)) {
            shouldHide = true
          }
          
          // Si hay provincia y no está en el texto, ocultar
          if (provinceLower && !text.includes(provinceLower)) {
            shouldHide = true
          }
          
          if (shouldHide) {
            ;(item as HTMLElement).style.display = 'none'
          } else {
            ;(item as HTMLElement).style.display = ''
          }
        })
      }
    }

    // Observar cambios en el DOM para filtrar resultados
    const observer = new MutationObserver(() => {
      filterResults()
    })

    // Observar el body para detectar cuando aparecen las sugerencias
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    })

    // También filtrar cuando el usuario escribe
    const inputElement = inputRef.current
    const handleInput = () => {
      // Pequeño delay para que Google renderice las sugerencias primero
      setTimeout(filterResults, 100)
    }

    inputElement.addEventListener('input', handleInput)

    return () => {
      observer.disconnect()
      inputElement.removeEventListener('input', handleInput)
    }
  }, [isLoaded, city, province])

  // Actualizar valor del input cuando cambia externamente
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value
    }
  }, [value])

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        defaultValue={value}
        placeholder={placeholder}
        required={required}
        className={className}
        onChange={(e) => {
          // Permitir edición manual
          if (!autocompleteRef.current?.getPlace()) {
            onChange(e.target.value)
          }
        }}
      />
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      )}
      {!isLoaded && !isLoading && (
        <p className="mt-1 text-xs text-gray-400">
          Autocompletado no disponible (falta API key)
        </p>
      )}
    </div>
  )
}
