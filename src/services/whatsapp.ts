import type { ProductData, Plan } from '../types/index';
import { CONFIG } from '../config';

export const createWhatsAppMessage = (productData: ProductData, plan: Plan): string => {
    return `¡Hola! Quiero publicar un producto:%0A%0A` +
        `*Detalles del Producto:*%0A` +
        `Nombre: ${productData.nombre}%0A` +
        `Categoría: ${productData.categoria}%0A` +
        `Precio: $${productData.precio}%0A` +
        `Stock: ${productData.stock}%0A` +
        `Características:%0A${productData.caracteristicas.map((c: string) => `- ${c}`).join('%0A')}%0A%0A` +
        `*Plan Seleccionado:*%0A` +
        `Plan: ${plan.nombre}%0A` +
        `Duración: ${plan.duracion}%0A` +
        `Precio del plan: $${plan.precio}%0A%0A` +
        `Mi WhatsApp: ${productData.whatsapp}%0A%0A` +
        `¿Podemos coordinar el pago?`;
};

export const openWhatsApp = (message: string): void => {
    window.open(`https://wa.me/${CONFIG.whatsappNumber}?text=${message}`, '_blank');
}; 