import type { ApiResponse } from '../types/index';

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    const response = await fetch(endpoint, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error en la solicitud');
    }

    return data;
  } catch (error) {
    return {
      error: (error as Error)?.message || 'Error en la solicitud'
    };
  }
}

export function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const validParams = Object.entries(params)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');

  return validParams ? `?${validParams}` : '';
}

export function getApiUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const baseUrl = import.meta.env.PUBLIC_API_URL || window.location.origin;
  const queryString = params ? buildQueryString(params) : '';
  return `${baseUrl}${path}${queryString}`;
}

// Utilidades para manejo de respuestas
export function isSuccessResponse<T>(response: ApiResponse<T>): response is { data: T } {
  return !!(response as any).data;
}

export function isErrorResponse<T>(response: ApiResponse<T>): response is { error: string } {
  return !!(response as any).error;
}

// Cache simple para respuestas de API
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export async function cachedApiRequest<T>(
  endpoint: string,
  options: RequestInit & { cacheTTL?: number } = {}
): Promise<ApiResponse<T>> {
  const cacheKey = `${endpoint}-${JSON.stringify(options)}`;
  const cached = apiCache.get(cacheKey);
  const ttl = options.cacheTTL || CACHE_TTL;

  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }

  const response = await apiRequest<T>(endpoint, options);
  
  if (isSuccessResponse(response)) {
    apiCache.set(cacheKey, {
      data: response,
      timestamp: Date.now()
    });
  }

  return response;
}

// Limpiar cache
export function clearApiCache(): void {
  apiCache.clear();
}

export function invalidateCache(endpoint?: string): void {
  if (endpoint) {
    // Eliminar todas las entradas que coincidan con el endpoint
    for (const key of apiCache.keys()) {
      if (key.startsWith(endpoint)) {
        apiCache.delete(key);
      }
    }
  } else {
    clearApiCache();
  }
} 