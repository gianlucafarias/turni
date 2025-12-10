import { ValidationError } from './errors';

export function validateRequired(value: any, field: string): void {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(`El campo ${field} es requerido`);
  }
}

export function validateString(value: any, field: string, options: { 
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
} = {}): void {
  validateRequired(value, field);

  if (typeof value !== 'string') {
    throw new ValidationError(`El campo ${field} debe ser un texto`);
  }

  if (options.minLength && value.length < options.minLength) {
    throw new ValidationError(
      `El campo ${field} debe tener al menos ${options.minLength} caracteres`
    );
  }

  if (options.maxLength && value.length > options.maxLength) {
    throw new ValidationError(
      `El campo ${field} debe tener máximo ${options.maxLength} caracteres`
    );
  }

  if (options.pattern && !options.pattern.test(value)) {
    throw new ValidationError(
      `El campo ${field} no tiene un formato válido`
    );
  }
}

export function validateNumber(value: any, field: string, options: {
  min?: number;
  max?: number;
  integer?: boolean;
} = {}): void {
  validateRequired(value, field);

  const num = Number(value);
  if (isNaN(num)) {
    throw new ValidationError(`El campo ${field} debe ser un número`);
  }

  if (options.integer && !Number.isInteger(num)) {
    throw new ValidationError(`El campo ${field} debe ser un número entero`);
  }

  if (options.min !== undefined && num < options.min) {
    throw new ValidationError(
      `El campo ${field} debe ser mayor o igual a ${options.min}`
    );
  }

  if (options.max !== undefined && num > options.max) {
    throw new ValidationError(
      `El campo ${field} debe ser menor o igual a ${options.max}`
    );
  }
}

export function validateUrl(value: any, field: string): void {
  validateRequired(value, field);
  validateString(value, field);

  try {
    new URL(value);
  } catch {
    throw new ValidationError(`El campo ${field} debe ser una URL válida`);
  }
}

export function validateImageUrl(value: any, field: string): void {
  if (!value) return; // Permitir vacío
  validateUrl(value, field);

  const imagePattern = /\.(jpg|jpeg|png|gif|webp)$/i;
  if (!imagePattern.test(value)) {
    throw new ValidationError(
      `El campo ${field} debe ser una URL de imagen válida (jpg, jpeg, png, gif, webp)`
    );
  }
}

export function validateWhatsappNumber(value: any, field: string = 'número de WhatsApp'): void {
  if (!value) return; // Permitir vacío
  validateString(value, field);

  // Formato: código de país + número, solo dígitos
  const whatsappPattern = /^\d{10,15}$/;
  if (!whatsappPattern.test(value)) {
    throw new ValidationError(
      `El ${field} debe contener solo números (10-15 dígitos incluyendo código de país)`
    );
  }
}

// Validaciones específicas para entidades

export function validateStore(data: any) {
  validateString(data.name, 'nombre', { minLength: 2, maxLength: 100 });
  
  if (data.description) {
    validateString(data.description, 'descripción', { maxLength: 500 });
  }
  
  if (data.location) {
    validateString(data.location, 'ubicación', { maxLength: 200 });
  }
  
  if (data.whatsapp_url) {
    validateWhatsappNumber(data.whatsapp_url);
  }
  
  if (data.banner_image_url) {
    validateImageUrl(data.banner_image_url, 'banner');
  }
  
  if (data.profile_image_url) {
    validateImageUrl(data.profile_image_url, 'imagen de perfil');
  }
}

export function validateProduct(data: any) {
  validateString(data.name, 'nombre', { minLength: 2, maxLength: 100 });
  validateNumber(data.price, 'precio', { min: 0 });
  validateNumber(data.stock, 'stock', { min: 0, integer: true });
  
  if (data.description) {
    validateString(data.description, 'descripción', { maxLength: 1000 });
  }
  
  if (data.image_url) {
    validateImageUrl(data.image_url, 'imagen');
  }
} 