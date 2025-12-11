import type { ProductForm } from '../types/events';
import { publicationStore } from '../store/publicationStore';
import { validateProduct, validateImage } from './validation';
import { readImageAsDataURL, compressImage } from './imageHandling';
import { showError } from '../utils/notifications';
import type { ProductData } from '../types/index';

export const initializeImageUpload = () => {
    const dropZone = document.querySelector('.border-dashed');
    const imageInput = document.getElementById('imagen') as HTMLInputElement;
    const previewContainer = document.createElement('div');
    previewContainer.className = 'mt-4';

    dropZone?.parentElement?.appendChild(previewContainer);

    // Manejar drag & drop
    dropZone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-indigo-500');
    });

    dropZone?.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-indigo-500');
    });

    dropZone?.addEventListener('drop', async (e) => {
        const dragEvent = e as DragEvent;
        dragEvent.preventDefault();
        dropZone.classList.remove('border-indigo-500');
        
        if (dragEvent.dataTransfer?.files.length) {
            await handleImageUpload(dragEvent.dataTransfer.files[0]);
        }
    });

    // Manejar selección de archivo
    imageInput?.addEventListener('change', async (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.files?.length) {
            await handleImageUpload(target.files[0]);
        }
    });
};

export const initializeFormValidation = () => {
    const form = document.getElementById('producto-form') as ProductForm;
    if (!form) return;

    const inputs = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select');

    inputs.forEach(input => {
        input.addEventListener('input', () => validateField(input));
        input.addEventListener('blur', () => validateField(input));
    });

    form.addEventListener('submit', handleFormSubmit);
};

const handleFormSubmit = async (e: Event) => {
    e.preventDefault();
    const form = e.target as ProductForm;
    
    const formData = new FormData(form);
    const productData: Partial<ProductData> = {
        nombre: formData.get('nombre') as string,
        categoria: formData.get('categoria') as string,
        descripcion: formData.get('descripcion') as string,
        precio: Number(formData.get('precio')),
        precioAnterior: Number(formData.get('precioAnterior')) || undefined,
        stock: Number(formData.get('stock')),
        caracteristicas: Array.from(formData.getAll('caracteristicas[]') as string[])
            .filter(c => c.trim() !== ''),
        whatsapp: formData.get('whatsapp') as string,
    };

    const validation = validateProduct(productData);
    if (!validation.isValid) {
        validation.errors.forEach(error => showError(error));
        return;
    }

    try {
        publicationStore.setProductData(productData as ProductData);
        publicationStore.setStep(2);
    } catch (error) {
        showError('Error al procesar el formulario');
        console.error(error);
    }
};

export const initializeCharacteristics = () => {
    const container = document.getElementById('caracteristicas-container');
    const addButton = container?.querySelector('button');

    addButton?.addEventListener('click', () => {
        const newField = createCharacteristicField();
        container?.appendChild(newField);
    });
};

const createCharacteristicField = () => {
    const div = document.createElement('div');
    div.className = 'flex gap-3';
    div.innerHTML = `
        <input 
            type="text" 
            name="caracteristicas[]" 
            class="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 focus:ring-0 focus:border-indigo-500 transition-colors text-gray-800 placeholder-gray-400"
            placeholder="Ej: Pantalla AMOLED 6.5\""
        />
        <button 
            type="button"
            class="px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
            onclick="this.parentElement.remove()"
        >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
        </button>
    `;
    return div;
};

const validateField = (input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
    const value = input.value.trim();
    const errorElement = document.getElementById(`${input.id}-error`);

    if (!errorElement) return;

    let error = '';

    switch (input.name) {
        case 'nombre':
            if (!value) {
                error = 'El nombre es requerido';
            } else if (value.length < 3) {
                error = 'El nombre debe tener al menos 3 caracteres';
            }
            break;

        case 'precio':
            if (!value) {
                error = 'El precio es requerido';
            } else if (Number(value) <= 0) {
                error = 'El precio debe ser mayor a 0';
            }
            break;

        case 'whatsapp':
            if (!value) {
                error = 'El número de WhatsApp es requerido';
            } else if (!/^[0-9]{10,15}$/.test(value)) {
                error = 'Ingrese un número de WhatsApp válido';
            }
            break;
    }

    if (error) {
        errorElement.textContent = error;
        errorElement.classList.remove('hidden');
        input.classList.add('border-red-500');
    } else {
        errorElement.classList.add('hidden');
        input.classList.remove('border-red-500');
    }
};

const handleImageUpload = async (file: File) => {
    const validation = validateImage(file);
    if (!validation.isValid) {
        alert(validation.error);
        return;
    }

    try {
        const compressedImage = await compressImage(file);
        const preview = await readImageAsDataURL(new File([compressedImage], file.name, { type: file.type }));
        publicationStore.setImagePreview(preview);
        updateImagePreview(preview);
    } catch (error) {
        alert('Error al procesar la imagen');
        console.error(error);
    }
};

const updateImagePreview = (preview: string) => {
    const previewContainer = document.querySelector('.border-dashed')?.parentElement?.querySelector('.mt-4');
    if (!previewContainer) return;

    previewContainer.innerHTML = `
        <div class="relative">
            <img src="${preview}" alt="Preview" class="w-full h-48 object-cover rounded-lg"/>
            <button type="button" onclick="removeImage()" 
                    class="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        </div>
    `;
};

export const removeImage = () => {
    publicationStore.setImagePreview(null);
    const imageInput = document.getElementById('imagen') as HTMLInputElement;
    imageInput.value = '';
    const previewContainer = document.querySelector('.border-dashed')?.parentElement?.querySelector('.mt-4');
    if (previewContainer) {
        previewContainer.innerHTML = '';
    }
};

// Exponer funciones necesarias globalmente
(window as any).removeImage = removeImage; 