interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function GoogleCalendarUpgradeModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">Sincronización con Google Calendar</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-indigo-50 rounded-xl">
            <svg className="w-6 h-6 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium text-indigo-900 mb-1">Sincronización bidireccional</p>
              <p className="text-sm text-indigo-700">
                Los turnos que crees aquí se guardarán automáticamente en tu Google Calendar, y los eventos que agendes en Google Calendar aparecerán también aquí.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-indigo-50 rounded-xl">
            <svg className="w-6 h-6 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium text-indigo-900 mb-1">Siempre sincronizado</p>
              <p className="text-sm text-indigo-700">
                Mantén tus turnos organizados en un solo lugar. Cualquier cambio se refleja automáticamente en ambos lados.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-indigo-50 rounded-xl">
            <svg className="w-6 h-6 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <p className="font-medium text-indigo-900 mb-1">Seguro y privado</p>
              <p className="text-sm text-indigo-700">
                Solo tú tienes acceso a tu calendario. Los datos se manejan de forma segura y privada.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-4 text-center">
              Esta funcionalidad está disponible para usuarios con plan <span className="font-semibold text-indigo-600">Pro</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 text-gray-700 bg-white border border-gray-200 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  onClose()
                  window.location.href = '/dashboard/subscription'
                }}
                className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
              >
                Actualizar a Pro
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}




