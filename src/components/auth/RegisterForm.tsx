import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function RegisterForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [storeName, setStoreName] = useState('')
  const [storeType, setStoreType] = useState('products')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createStore = async (userId: string) => {
    try {
      // Crear la tienda directamente usando el cliente de Supabase
      // Esto funciona mejor porque el cliente ya tiene la sesión configurada
      console.log('Creando tienda directamente con Supabase...');
      
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .insert({
          name: storeName,
          user_id: userId,
          store_type: storeType,
          plan: 'free',
          products_count: 0,
          setup_completed: false,
          description: '',
          location: '',
        })
        .select()
        .single();

      if (storeError) {
        console.error('Error al crear la tienda:', storeError);
        throw new Error(storeError.message || 'Error al crear la tienda');
      }

      console.log('Tienda creada exitosamente:', store);
      return store;
    } catch (error) {
      console.error('Error al crear la tienda:', error);
      throw error;
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      console.log('Iniciando registro...')

      // Validar email antes de enviarlo
      const trimmedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      if (!emailRegex.test(trimmedEmail)) {
        throw new Error('Por favor, ingresa un correo electrónico válido');
      }

      // 1. Registrar usuario
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      })

      if (authError) {
        console.error('Error en auth.signUp:', authError)
        // Mejorar el manejo de errores específicos de Supabase
        if (authError.message.includes('invalid') || authError.message.includes('Email address')) {
          throw new Error('El correo electrónico no es válido. Por favor verifica que esté escrito correctamente.');
        }
        throw authError
      }

      if (!authData.user?.id) {
        throw new Error('No se pudo crear el usuario - ID no disponible')
      }

      console.log('Usuario creado:', authData.user.id)
      console.log('Sesión disponible:', authData.session ? 'Sí' : 'No')

      // 2. Si no hay sesión, esperar un momento y obtenerla
      // Esto puede pasar si está habilitada la verificación de email
      if (!authData.session) {
        console.log('No hay sesión inmediata, esperando...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Intentar obtener la sesión actual
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('Sesión obtenida después de esperar');
        } else {
          console.log('Aún no hay sesión, pero continuamos con la creación de tienda');
        }
      }

      // 3. Crear tienda directamente con Supabase (el cliente ya tiene la sesión)
      await createStore(authData.user.id);

      // 4. Redirigir según el entorno
      // En desarrollo, ir al dashboard directamente
      // En producción, ir a verificación de email
      if (import.meta.env.PROD) {
        window.location.href = '/auth/verify-email'
      } else {
        // En desarrollo, verificar si tiene tienda y redirigir
        const { data: store } = await supabase
          .from('stores')
          .select('id')
          .eq('user_id', authData.user.id)
          .single()
        
        if (store) {
          window.location.href = '/dashboard/products'
        } else {
          window.location.href = '/setup/store'
        }
      }
      
    } catch (error: any) {
      console.error('Error en el registro:', error)
      let errorMessage = 'Error al crear la cuenta';
      
      if (error.message) {
        const msg = error.message.toLowerCase();
        
        if (msg.includes('duplicate') || msg.includes('already registered') || msg.includes('already exists')) {
          errorMessage = 'Ya existe una cuenta con este correo electrónico';
        } else if (msg.includes('invalid') || msg.includes('email address') || msg.includes('valid email')) {
          errorMessage = 'El correo electrónico no es válido. Por favor verifica que esté escrito correctamente.';
        } else if (msg.includes('password') && msg.includes('6')) {
          errorMessage = 'La contraseña debe tener al menos 6 caracteres';
        } else if (msg.includes('email not confirmed')) {
          errorMessage = 'Por favor confirma tu email antes de iniciar sesión';
        } else {
          errorMessage = error.message;
        }
      } else if (error.error_description) {
        errorMessage = error.error_description;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Crear Cuenta</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-6">
        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Nombre de tu tienda
          </label>
          <input
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
            required
            minLength={3}
          />
        </div>

        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2">
            ¿Qué quieres hacer?
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setStoreType('products')}
              className={`p-4 border rounded-lg text-center transition-colors ${
                storeType === 'products'
                  ? 'bg-blue-500 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
              }`}
            >
              <div className="font-bold mb-2">Vender Productos</div>
              <div className="text-sm">
                Crea tu tienda online y vende tus productos
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStoreType('appointments')}
              className={`p-4 border rounded-lg text-center transition-colors ${
                storeType === 'appointments'
                  ? 'bg-blue-500 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
              }`}
            >
              <div className="font-bold mb-2">Agendar Turnos</div>
              <div className="text-sm">
                Gestiona reservas y turnos para tu negocio
              </div>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
            required
            minLength={6}
          />
          <p className="mt-1 text-xs text-gray-500">
            La contraseña debe tener al menos 6 caracteres
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
        >
          {loading ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>

        <p className="text-center text-sm text-gray-600">
          ¿Ya tienes una cuenta?{' '}
          <a href="/login" className="text-blue-600 hover:text-blue-500">
            Inicia sesión
          </a>
        </p>
      </form>
    </div>
  )
} 