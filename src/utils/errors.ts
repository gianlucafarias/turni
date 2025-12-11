import type { AppErrorData } from '../types/index';

// Errores de validación simples para formularios/inputs
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON(): AppErrorData {
    return {
      code: this.code,
      message: this.message,
      details: this.details
    };
  }
}

// Utilidad para manejar errores en endpoints
export async function handleApiError(error: unknown): Promise<Response> {
  console.error('API Error:', error);

  if (error instanceof AppError) {
    return new Response(
      JSON.stringify(error.toJSON()),
      {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Error desconocido
  const unknownError = new AppError(
    'Error interno del servidor',
    500,
    'INTERNAL_ERROR',
    { originalError: error instanceof Error ? error.message : String(error) }
  );

  return new Response(
    JSON.stringify(unknownError.toJSON()),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }
  );
} 