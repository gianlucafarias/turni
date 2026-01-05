import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface UserProfile {
  id: string
  user_id: string
  first_name: string
  last_name: string
  phone: string
  provincia: string
  localidad: string
  birth_date: string | null
  notifications_enabled: boolean
  newsletter_subscribed: boolean
}

export default function UserProfile() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [store, setStore] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'edit' | 'password'>('info')

  // Estados para editar perfil
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [provincia, setProvincia] = useState('')
  const [localidad, setLocalidad] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false)

  // Estados para cambiar contraseña
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [changingPassword, setChangingPassword] = useState(false)

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

      setUser(session.user)

      // Cargar perfil del usuario
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (profileData) {
        setProfile(profileData)
        setFirstName(profileData.first_name || '')
        setLastName(profileData.last_name || '')
        setPhone(profileData.phone || '')
        setProvincia(profileData.provincia || '')
        setLocalidad(profileData.localidad || '')
        setBirthDate(profileData.birth_date || '')
        setNotificationsEnabled(profileData.notifications_enabled !== false)
        setNewsletterSubscribed(profileData.newsletter_subscribed || false)
      } else {
        // Crear perfil si no existe
        const { data: newProfile } = await supabase
          .from('user_profiles')
          .insert({
            user_id: session.user.id,
            first_name: '',
            last_name: '',
            phone: '',
            provincia: '',
            localidad: '',
            notifications_enabled: true,
            newsletter_subscribed: false
          })
          .select()
          .single()

        if (newProfile) {
          setProfile(newProfile)
        }
      }

      // Cargar información de la tienda
      const { data: storeData } = await supabase
        .from('stores')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (storeData) {
        setStore(storeData)
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
      setError('Error al cargar la información')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No hay sesión activa')
      }

      const updateData: any = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        provincia: provincia.trim(),
        localidad: localidad.trim(),
        notifications_enabled: notificationsEnabled,
        newsletter_subscribed: newsletterSubscribed,
        updated_at: new Date().toISOString()
      }

      if (birthDate) {
        updateData.birth_date = birthDate
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('user_id', session.user.id)

      if (updateError) throw updateError

      // Recargar datos
      await loadData()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      setActiveTab('info')
    } catch (error: any) {
      console.error('Error actualizando perfil:', error)
      setError(error.message || 'Error al actualizar el perfil')
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError(null)
    setChangingPassword(true)

    try {
      // Validar que las contraseñas coincidan
      if (newPassword !== confirmPassword) {
        setPasswordError('Las contraseñas no coinciden')
        return
      }

      // Validar longitud mínima
      if (newPassword.length < 6) {
        setPasswordError('La contraseña debe tener al menos 6 caracteres')
        return
      }

      // Verificar contraseña actual
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No hay sesión activa')
      }

      // Guardar el token de sesión actual
      const currentAccessToken = session.access_token

      // Intentar iniciar sesión con la contraseña actual para verificar
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: session.user.email!,
        password: currentPassword
      })

      if (verifyError) {
        setPasswordError('La contraseña actual es incorrecta')
        return
      }

      // Actualizar contraseña
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) throw updateError

      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => {
        setSuccess(false)
        setActiveTab('info')
      }, 3000)
    } catch (error: any) {
      console.error('Error cambiando contraseña:', error)
      setPasswordError(error.message || 'Error al cambiar la contraseña')
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return null

  const tabs = [
    { id: 'info', label: 'Información', icon: '👤' },
    { id: 'edit', label: 'Editar Perfil', icon: '✏️' },
    { id: 'password', label: 'Contraseña', icon: '🔒' },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
        <p className="text-gray-500 mt-1">Gestiona tu información personal y configuración de cuenta</p>
      </div>

      {/* Alertas */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-xl flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Cambios guardados correctamente
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id as any)
              setError(null)
              setPasswordError(null)
            }}
            className={`flex-1 min-w-max flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB: Información */}
      {activeTab === 'info' && (
        <div className="space-y-6">
          {/* Información del Usuario */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-xl">👤</span> Información Personal
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <p className="text-gray-900 font-medium">{user.email}</p>
                <p className="text-xs text-gray-400 mt-1">El email no se puede cambiar desde aquí</p>
              </div>
             
              {profile && (
                <>
                  {(profile.first_name || profile.last_name) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                      <p className="text-gray-900 font-medium">
                        {[profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'No especificado'}
                      </p>
                    </div>
                  )}
                  {profile.phone && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                      <p className="text-gray-900 font-medium">{profile.phone}</p>
                    </div>
                  )}
                  {(profile.provincia || profile.localidad) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                      <p className="text-gray-900 font-medium">
                        {[profile.localidad, profile.provincia].filter(Boolean).join(', ') || 'No especificada'}
                      </p>
                    </div>
                  )}
                  {profile.birth_date && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de nacimiento</label>
                      <p className="text-gray-900 font-medium">
                        {new Date(profile.birth_date).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                  )}
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Último acceso</label>
                <p className="text-gray-900 font-medium">
                  {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('es-AR') : 'Nunca'}
                </p>
              </div>
            </div>
          </div>

          {/* Información de la Tienda */}
          {store && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-xl">🏪</span> Información de la Tienda
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Tienda</label>
                  <p className="text-gray-900 font-medium">{store.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Tienda</label>
                  <p className="text-gray-900 font-medium">
                    {store.store_type === 'products' ? 'Productos' : store.store_type === 'appointments' ? 'Turnos' : 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plan Actual</label>
                  <p className="text-gray-900 font-medium capitalize">{store.plan || 'Gratuito'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Creación</label>
                  <p className="text-gray-900 font-medium">
                    {store.created_at ? new Date(store.created_at).toLocaleDateString('es-AR') : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Preferencias */}
          {profile && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-xl">⚙️</span> Preferencias
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-gray-900">Notificaciones habilitadas</p>
                    <p className="text-sm text-gray-500">Recibir notificaciones del sistema</p>
                  </div>
                  <div className={`w-12 h-6 rounded-full flex items-center px-1 ${
                    profile.notifications_enabled ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                      profile.notifications_enabled ? 'translate-x-6' : ''
                    }`} />
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-gray-900">Suscripción a newsletter</p>
                    <p className="text-sm text-gray-500">Recibir novedades y ofertas</p>
                  </div>
                  <div className={`w-12 h-6 rounded-full flex items-center px-1 ${
                    profile.newsletter_subscribed ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                      profile.newsletter_subscribed ? 'translate-x-6' : ''
                    }`} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: Editar Perfil */}
      {activeTab === 'edit' && (
        <form onSubmit={handleUpdateProfile} className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <span className="text-xl">✏️</span> Editar Información Personal
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  placeholder="Juan"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Apellido
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  placeholder="Pérez"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Teléfono
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder="(011) 1234-5678"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Provincia
                </label>
                <input
                  type="text"
                  value={provincia}
                  onChange={(e) => setProvincia(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  placeholder="Buenos Aires"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Localidad
                </label>
                <input
                  type="text"
                  value={localidad}
                  onChange={(e) => setLocalidad(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  placeholder="Ciudad Autónoma de Buenos Aires"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de nacimiento
              </label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-gray-900">Notificaciones habilitadas</p>
                  <p className="text-sm text-gray-500">Recibir notificaciones del sistema</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    notificationsEnabled ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${
                      notificationsEnabled ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-gray-900">Suscripción a newsletter</p>
                  <p className="text-sm text-gray-500">Recibir novedades y ofertas</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewsletterSubscribed(!newsletterSubscribed)}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    newsletterSubscribed ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${
                      newsletterSubscribed ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => {
                setActiveTab('info')
                loadData()
              }}
              className="px-6 py-3 text-gray-700 bg-white border border-gray-200 rounded-xl font-medium hover:bg-gray-50 transition-colors shadow-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-200"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Guardando...
                </span>
              ) : 'Guardar cambios'}
            </button>
          </div>
        </form>
      )}

      {/* TAB: Cambiar Contraseña */}
      {activeTab === 'password' && (
        <form onSubmit={handleChangePassword} className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <span className="text-xl">🔒</span> Cambiar Contraseña
            </h2>

            {passwordError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {passwordError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña actual *
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder="Ingresa tu contraseña actual"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nueva contraseña *
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder="Mínimo 6 caracteres"
              />
              <p className="mt-1 text-sm text-gray-400">La contraseña debe tener al menos 6 caracteres</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirmar nueva contraseña *
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder="Repite la nueva contraseña"
              />
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => {
                setActiveTab('info')
                setCurrentPassword('')
                setNewPassword('')
                setConfirmPassword('')
                setPasswordError(null)
              }}
              className="px-6 py-3 text-gray-700 bg-white border border-gray-200 rounded-xl font-medium hover:bg-gray-50 transition-colors shadow-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-200"
            >
              {changingPassword ? (
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Cambiando...
                </span>
              ) : 'Cambiar contraseña'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
