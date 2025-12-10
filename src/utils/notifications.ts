type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface NotificationOptions {
    duration?: number;
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export const showNotification = (
    message: string, 
    type: NotificationType = 'info',
    options: NotificationOptions = {}
) => {
    const {
        duration = 3000,
        position = 'bottom-right'
    } = options;

    // Crear el contenedor de notificaciones si no existe
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.className = `fixed z-50 ${getPositionClasses(position)} p-4 space-y-2`;
        document.body.appendChild(container);
    }

    // Crear la notificación
    const notification = document.createElement('div');
    notification.className = `
        max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto 
        ring-1 ring-black ring-opacity-5 overflow-hidden
        transform transition-all duration-300 ease-in-out
        translate-y-2 opacity-0
        ${getTypeClasses(type)}
    `;

    notification.innerHTML = `
        <div class="p-4">
            <div class="flex items-center">
                <div class="flex-shrink-0">
                    ${getIcon(type)}
                </div>
                <div class="ml-3 w-0 flex-1">
                    <p class="text-sm font-medium text-gray-900">
                        ${message}
                    </p>
                </div>
                <div class="ml-4 flex-shrink-0 flex">
                    <button class="rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none">
                        <span class="sr-only">Cerrar</span>
                        <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;

    // Agregar la notificación al contenedor
    container.appendChild(notification);

    // Animar la entrada
    requestAnimationFrame(() => {
        notification.classList.remove('translate-y-2', 'opacity-0');
    });

    // Configurar el botón de cerrar
    const closeButton = notification.querySelector('button');
    closeButton?.addEventListener('click', () => removeNotification(notification));

    // Auto-remover después del tiempo especificado
    setTimeout(() => removeNotification(notification), duration);
};

const removeNotification = (notification: HTMLElement) => {
    notification.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => notification.remove(), 300);
};

const getPositionClasses = (position: string) => {
    switch (position) {
        case 'top-right': return 'top-0 right-0';
        case 'top-left': return 'top-0 left-0';
        case 'bottom-left': return 'bottom-0 left-0';
        default: return 'bottom-0 right-0';
    }
};

const getTypeClasses = (type: NotificationType) => {
    switch (type) {
        case 'success': return 'bg-green-50 border-green-500';
        case 'error': return 'bg-red-50 border-red-500';
        case 'warning': return 'bg-yellow-50 border-yellow-500';
        default: return 'bg-blue-50 border-blue-500';
    }
};

const getIcon = (type: NotificationType) => {
    const iconClasses = {
        success: 'text-green-400',
        error: 'text-red-400',
        warning: 'text-yellow-400',
        info: 'text-blue-400'
    };

    return `
        <svg class="h-6 w-6 ${iconClasses[type]}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            ${getIconPath(type)}
        </svg>
    `;
};

const getIconPath = (type: NotificationType) => {
    switch (type) {
        case 'success':
            return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>';
        case 'error':
            return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>';
        case 'warning':
            return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>';
        default:
            return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>';
    }
};

export const showError = (message: string) => {
    showNotification(message, 'error');
};

export const showSuccess = (message: string) => {
    showNotification(message, 'success');
};

export const showWarning = (message: string) => {
    showNotification(message, 'warning');
};

export const showInfo = (message: string) => {
    showNotification(message, 'info');
}; 