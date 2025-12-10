export interface Store {
  id: string
  name: string
  description?: string
  user_id: string
  created_at: string
  updated_at: string
  store_type: 'products' | 'appointments'
  active: boolean
}

export interface Product {
  id: string
  name: string
  description?: string
  price: number
  stock: number
  store_id: string
  created_at: string
  updated_at: string
  active: boolean
  image_url?: string
}

export interface Appointment {
  id: string
  title: string
  description?: string
  start_time: string
  end_time: string
  store_id: string
  client_name: string
  client_email: string
  client_phone?: string
  status: 'pending' | 'confirmed' | 'cancelled'
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  created_at: string
  updated_at: string
}

// Tipos para respuestas de API
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// Tipos para errores personalizados
export interface AppErrorData {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// Tipos para el carrito
export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
}

// Enums para constantes
export enum StorageKeys {
  CART = 'cart',
  AUTH = 'auth'
} 