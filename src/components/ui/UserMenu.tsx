import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Props {
  store?: {
    id: string;
  };
}

export default function UserMenu({ store }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [userStore, setUserStore] = useState<any>(store || null);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Verificar sesión al cargar y escuchar cambios
  useEffect(() => {
    async function checkSession() {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);

        // Si hay sesión pero no hay store, intentar obtenerla
        if (currentSession && !userStore) {
          const { data: storeData } = await supabase
            .from('stores')
            .select('id, name, profile_image_url')
            .eq('user_id', currentSession.user.id)
            .single();
          
          if (storeData) {
            setUserStore(storeData);
            setProfileImageUrl(storeData.profile_image_url || null);
          }
        } else if (currentSession && userStore && !profileImageUrl) {
          // Cargar profile_image_url si no está
          const { data: storeData } = await supabase
            .from('stores')
            .select('profile_image_url')
            .eq('id', userStore.id)
            .single();
          
          if (storeData?.profile_image_url) {
            setProfileImageUrl(storeData.profile_image_url);
          }
        }
      } catch (error) {
        console.error('Error verificando sesión:', error);
      }
    }

    checkSession();

    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      
      if (session) {
        // Recargar la tienda si hay sesión
        supabase
          .from('stores')
          .select('id, name')
          .eq('user_id', session.user.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setUserStore(data);
              setProfileImageUrl(data.profile_image_url || null);
            }
          });
      } else {
        setUserStore(null);
      }

      // Si se cerró sesión, redirigir
      if (event === 'SIGNED_OUT') {
        window.location.href = '/login';
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [userStore]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && buttonRef.current && 
          !menuRef.current.contains(event.target as Node) && 
          !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.href = '/login';
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      setLoading(false);
    }
  };

  // Controlar visibilidad de botones de auth basado en la sesión
  useEffect(() => {
    const authButtons = document.getElementById('auth-buttons');
    if (authButtons) {
      if (!session) {
        authButtons.style.display = 'flex';
      } else {
        authButtons.style.display = 'none';
      }
    }
  }, [session]);

  // Si no hay sesión, no mostrar nada (se mostrará el botón de iniciar sesión)
  if (!session) {
    return <div data-user-menu style={{ display: 'none' }}></div>;
  }

  const userEmail = session.user?.email || '';
  const userName = userEmail.split('@')[0] || 'Usuario';
  const userInitial = userEmail[0]?.toUpperCase() || 'U';

  return (
    <div className="flex items-center space-x-4" data-user-menu>
      {userStore && (
        <a
          href={`/${userStore.id}`}
          className="hidden sm:flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          <span>Ver mi tienda</span>
        </a>
      )}
      
      <div className="relative" ref={menuRef}>
        <button
          ref={buttonRef}
          type="button"
          className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-gray-900">{userName}</p>
            {userStore && (
              <p className="text-xs text-gray-500">{userStore.name}</p>
            )}
          </div>
          {profileImageUrl ? (
            <img 
              src={profileImageUrl} 
              alt={userStore?.name || userName} 
              className="h-9 w-9 rounded-full object-cover border-2 border-white shadow-sm"
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-sm">
              <span className="text-sm font-semibold text-white">{userInitial}</span>
            </div>
          )}
          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div
            className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
            role="menu"
            aria-orientation="vertical"
            tabIndex={-1}
          >
            <div className="py-1">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{userEmail}</p>
                {userStore && (
                  <p className="text-xs text-gray-500 mt-0.5">{userStore.name}</p>
                )}
              </div>

              <a
                href="/dashboard"
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                role="menuitem"
                onClick={() => setIsOpen(false)}
              >
                <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Dashboard
              </a>

              <a
                href="/dashboard/profile"
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                role="menuitem"
                onClick={() => setIsOpen(false)}
              >
                <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Mi Perfil
              </a>

              {userStore && (
                <a
                  href={`/${userStore.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors sm:hidden"
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                >
                  <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Ver mi tienda
                </a>
              )}

              <div className="border-t border-gray-100"></div>

              <button
                onClick={handleLogout}
                disabled={loading}
                className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                role="menuitem"
              >
                <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {loading ? 'Cerrando sesión...' : 'Cerrar sesión'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
