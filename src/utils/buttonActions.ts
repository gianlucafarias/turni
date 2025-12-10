import { publicationStore } from '../store/publicationStore';
import { showNotification } from './notifications';
import type { ButtonAction } from '../types/button';

export const handleButtonAction = async (action: ButtonAction): Promise<void> => {
    try {
        switch (action.type) {
            case 'AGREGAR_CARACTERISTICA':
                const container = document.getElementById('caracteristicas-container');
                if (container) {
                    const newField = createCaracteristicaField();
                    container.appendChild(newField);
                }
                break;

            case 'SELECCIONAR_PLAN':
                const { id, nombre, precio, duracion, caracteristicas } = action.payload;
                
                try {
                    await publicationStore.setPlan({
                        id,
                        nombre,
                        precio,
                        duracion,
                        caracteristicas
                    });
                    
                    const productData = publicationStore.getProductData();
                    if (!productData) {
                        showNotification('Por favor complete la información del producto primero', 'error');
                        publicationStore.setStep(1);
                        return;
                    }
                    
                    publicationStore.setStep(3);
                    showNotification(`Plan ${nombre} seleccionado`, 'success');
                } catch (error) {
                    console.error('Error al seleccionar el plan:', error);
                    showNotification('Error al seleccionar el plan', 'error');
                }
                break;

            case 'VOLVER':
                history.back();
                break;

            case 'SIGUIENTE_PASO':
                const currentStep = publicationStore.getCurrentStep();
                if (await validateStep(currentStep)) {
                    publicationStore.setStep(currentStep + 1);
                }
                break;

            case 'INICIAR_PAGO':
                const { whatsappNumber } = action.payload;
                const productData = publicationStore.getProductData();
                const selectedPlan = publicationStore.getSelectedPlan();
                const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked') as HTMLInputElement;

                if (!productData || !selectedPlan || !paymentMethod) {
                    showNotification('Error al procesar el pago', 'error');
                    return;
                }

                const discount = paymentMethod.value === 'efectivo' ? 0.1 : 0;
                const total = (productData.precio + selectedPlan.precio) * (1 - discount);

                const mensaje = `¡Hola! Quiero publicar un producto:%0A%0A` +
                    `*Detalles del Producto:*%0A` +
                    `Nombre: ${productData.nombre}%0A` +
                    `Precio: $${productData.precio}%0A` +
                    `Categoría: ${productData.categoria}%0A%0A` +
                    `*Plan Seleccionado:*%0A` +
                    `Plan: ${selectedPlan.nombre}%0A` +
                    `Precio del plan: $${selectedPlan.precio}%0A%0A` +
                    `*Método de Pago:*%0A` +
                    `${paymentMethod.value === 'efectivo' ? 'Efectivo (10% descuento)' : 'Financiado'}%0A` +
                    `Total a pagar: $${total.toFixed(2)}%0A%0A` +
                    `¿Podemos coordinar el pago?`;

                window.open(`https://wa.me/${whatsappNumber}?text=${mensaje}`, '_blank');
                break;

            default:
                console.warn(`Acción no manejada: ${action.type}`);
        }
    } catch (error) {
        console.error('Error al ejecutar la acción:', error);
        showNotification('Error al procesar la acción', 'error');
    }
};

const createCaracteristicaField = (): HTMLDivElement => {
    const div = document.createElement('div');
    div.className = 'flex gap-3';
    div.innerHTML = `
        <input 
            type="text" 
            name="caracteristicas[]" 
            class="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 focus:ring-0 focus:border-indigo-500 transition-colors"
            placeholder="Ej: Pantalla AMOLED 6.5"
        />
        <button 
            type="button"
            class="px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
            data-action='{"type": "ELIMINAR_CARACTERISTICA"}'
        >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
        </button>
    `;
    return div;
};

const validateStep = async (step: number): Promise<boolean> => {
    switch (step) {
        case 1:
            const form = document.getElementById('producto-form') as HTMLFormElement;
            if (!form) return false;

            const formData = new FormData(form);
            const isValid = Array.from(formData.entries()).every(([key, value]) => {
                const input = form.querySelector(`[name="${key}"]`) as HTMLInputElement;
                return !input.required || (value && value !== '');
            });

            if (!isValid) {
                showNotification('Por favor complete todos los campos requeridos', 'error');
                return false;
            }
            return true;

        case 2:
            if (!publicationStore.getSelectedPlan()) {
                showNotification('Por favor seleccione un plan', 'error');
                return false;
            }
            return true;

        default:
            return true;
    }
}; 