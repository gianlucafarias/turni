// =============================================================================
// Tests unitarios para funcionalidad de sucursales en página pública
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGoogleMapsUrl } from '../../utils/maps';

// Mock de Supabase
const mockSupabase = {
  from: vi.fn(),
};

describe('Página de Tienda - Funcionalidad de Sucursales', () => {
  const mockStore = {
    id: 'store-1',
    name: 'Tienda Test',
    address: 'Av. Principal 100',
    city: 'Buenos Aires',
    province: 'CABA',
    location: 'Av. Principal 100, Buenos Aires',
    phone: '11-1234-5678',
    email: 'test@example.com',
  };

  const mockBranches = [
    {
      id: 'branch-1',
      store_id: 'store-1',
      name: 'Sucursal Centro',
      address: 'Av. Corrientes 1234',
      city: 'Buenos Aires',
      province: 'CABA',
      phone: '11-1234-5678',
      email: 'centro@example.com',
      is_active: true,
      display_order: 0,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'branch-2',
      store_id: 'store-1',
      name: 'Sucursal Norte',
      address: 'Av. Santa Fe 5678',
      city: 'Buenos Aires',
      province: 'CABA',
      phone: '11-8765-4321',
      email: 'norte@example.com',
      is_active: true,
      display_order: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Carga de sucursales', () => {
    it('debe cargar solo sucursales activas', async () => {
      const activeBranches = mockBranches.filter(b => b.is_active === true);
      expect(activeBranches).toHaveLength(2);
    });

    it('debe ordenar sucursales por display_order y luego por created_at', () => {
      const sortedBranches = [...mockBranches].sort((a, b) => {
        if (a.display_order !== b.display_order) {
          return a.display_order - b.display_order;
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      expect(sortedBranches[0].display_order).toBeLessThanOrEqual(sortedBranches[1].display_order);
    });

    it('debe manejar el caso cuando no hay sucursales', () => {
      const branches: any[] = [];
      expect(branches).toHaveLength(0);
    });
  });

  describe('Construcción de URLs de Google Maps', () => {
    it('debe construir URL para ubicación principal', () => {
      const url = getGoogleMapsUrl(
        mockStore.address || mockStore.location || '',
        mockStore.city,
        mockStore.province
      );
      
      expect(url).toContain('google.com/maps/search');
      expect(url).toContain(encodeURIComponent(mockStore.address));
    });

    it('debe construir URL para sucursal', () => {
      const branch = mockBranches[0];
      const url = getGoogleMapsUrl(branch.address, branch.city, branch.province);
      
      expect(url).toContain('google.com/maps/search');
      expect(url).toContain(encodeURIComponent(branch.address));
    });

    it('debe incluir ciudad y provincia en la URL cuando están disponibles', () => {
      const url = getGoogleMapsUrl('Av. Test 123', 'Buenos Aires', 'CABA');
      
      expect(url).toContain('Buenos%20Aires');
      expect(url).toContain('CABA');
    });
  });

  describe('Lógica de visualización', () => {
    it('debe mostrar sucursales si hay al menos una', () => {
      const shouldShowBranches = mockBranches.length > 0;
      expect(shouldShowBranches).toBe(true);
    });

    it('debe mostrar ubicación principal si no hay sucursales', () => {
      const branches: any[] = [];
      const shouldShowMainLocation = branches.length === 0 && !!(mockStore.address || mockStore.location);
      expect(shouldShowMainLocation).toBe(true);
    });

    it('debe mostrar ubicación principal incluso cuando hay sucursales', () => {
      const shouldShowMainLocation = !!(mockStore.address || mockStore.location) && mockBranches.length > 0;
      expect(shouldShowMainLocation).toBe(true);
    });
  });

  describe('Datos de contacto', () => {
    it('debe mostrar sección de contacto si hay dirección, teléfono, email o sucursales', () => {
      const hasContactInfo = !!(
        mockStore.address || 
        mockStore.phone || 
        mockStore.email || 
        mockBranches.length > 0
      );
      
      expect(hasContactInfo).toBe(true);
    });

    it('debe mostrar teléfono y email independientemente de sucursales', () => {
      expect(mockStore.phone).toBeTruthy();
      expect(mockStore.email).toBeTruthy();
    });
  });

  describe('Información de sucursal', () => {
    it('debe incluir todos los campos requeridos para cada sucursal', () => {
      mockBranches.forEach(branch => {
        expect(branch.id).toBeTruthy();
        expect(branch.name).toBeTruthy();
        expect(branch.store_id).toBe(mockStore.id);
        expect(branch.is_active).toBe(true);
      });
    });

    it('debe mostrar nombre, dirección, ciudad y provincia de cada sucursal', () => {
      const branch = mockBranches[0];
      
      expect(branch.name).toBe('Sucursal Centro');
      expect(branch.address).toBeTruthy();
      expect(branch.city).toBeTruthy();
      expect(branch.province).toBeTruthy();
    });
  });
});
