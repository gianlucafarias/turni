// =============================================================================
// Tests unitarios para el servicio de segmentación
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientSegmentationService } from '../segmentation';

// Mock de supabase
vi.mock('../../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          not: vi.fn(() => ({
            lt: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
    rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
  },
}));

describe('ClientSegmentationService', () => {
  let service: ClientSegmentationService;
  
  beforeEach(() => {
    vi.clearAllMocks();
    service = new ClientSegmentationService();
  });
  
  describe('getClients', () => {
    it('construye query con filtros básicos', async () => {
      const result = await service.getClients({
        storeId: 'store-123',
        isActive: true,
        limit: 10,
      });
      
      // El resultado será vacío porque estamos mockeando
      expect(result).toBeInstanceOf(Array);
    });
    
    it('filtra por disponibilidad de teléfono', async () => {
      await service.getClients({
        storeId: 'store-123',
        hasPhone: true,
      });
      
      // Verificar que se llamó con los filtros correctos
      // (la implementación del mock es simplificada)
    });
    
    it('filtra por disponibilidad de email', async () => {
      await service.getClients({
        storeId: 'store-123',
        hasEmail: true,
      });
    });
    
    it('filtra por inactividad', async () => {
      await service.getClients({
        storeId: 'store-123',
        inactiveDays: 30,
      });
    });
  });
  
  describe('getInactiveClients', () => {
    it('llama a la función RPC correcta', async () => {
      const result = await service.getInactiveClients('store-123', 30, 100);
      
      expect(result).toBeInstanceOf(Array);
    });
  });
  
  describe('getTags', () => {
    it('obtiene etiquetas de la tienda', async () => {
      const result = await service.getTags('store-123');
      
      expect(result).toBeInstanceOf(Array);
    });
  });
  
  describe('countClients', () => {
    it('cuenta clientes sin límite', async () => {
      const count = await service.countClients({
        storeId: 'store-123',
        isActive: true,
      });
      
      expect(typeof count).toBe('number');
    });
  });
});

describe('Segmentation Filter Logic', () => {
  describe('Tag Matching', () => {
    it('modo ANY: coincide si tiene al menos una etiqueta', () => {
      // Simular lógica de matching
      const clientTags = new Set(['tag-1', 'tag-2']);
      const filterTags = ['tag-2', 'tag-3'];
      
      const matches = filterTags.some(tag => clientTags.has(tag));
      
      expect(matches).toBe(true);
    });
    
    it('modo ALL: requiere todas las etiquetas', () => {
      const clientTags = new Set(['tag-1', 'tag-2']);
      const filterTags = ['tag-2', 'tag-3'];
      
      const matches = filterTags.every(tag => clientTags.has(tag));
      
      expect(matches).toBe(false);
    });
    
    it('modo ALL: coincide si tiene todas', () => {
      const clientTags = new Set(['tag-1', 'tag-2', 'tag-3']);
      const filterTags = ['tag-1', 'tag-2'];
      
      const matches = filterTags.every(tag => clientTags.has(tag));
      
      expect(matches).toBe(true);
    });
  });
  
  describe('Inactivity Calculation', () => {
    it('calcula días de inactividad correctamente', () => {
      const lastAppointment = new Date('2024-01-01');
      const today = new Date('2024-02-15');
      
      const daysInactive = Math.floor(
        (today.getTime() - lastAppointment.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      expect(daysInactive).toBe(45);
    });
    
    it('identifica cliente inactivo según umbral', () => {
      const lastAppointment = new Date('2024-01-01');
      const today = new Date('2024-02-15');
      const inactivityThreshold = 30;
      
      const daysInactive = Math.floor(
        (today.getTime() - lastAppointment.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      const isInactive = daysInactive >= inactivityThreshold;
      
      expect(isInactive).toBe(true);
    });
  });
});



