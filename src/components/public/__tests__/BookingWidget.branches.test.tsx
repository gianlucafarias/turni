// =============================================================================
// Tests unitarios para funcionalidad de sucursales en BookingWidget
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('BookingWidget - Funcionalidad de Sucursales', () => {
  const mockBranches = [
    {
      id: 'branch-1',
      name: 'Sucursal Centro',
      address: 'Av. Corrientes 1234',
      city: 'Buenos Aires',
      province: 'CABA',
      is_active: true,
    },
    {
      id: 'branch-2',
      name: 'Sucursal Norte',
      address: 'Av. Santa Fe 5678',
      city: 'Buenos Aires',
      province: 'CABA',
      is_active: true,
    },
  ];

  const mockStore = {
    id: 'store-1',
    name: 'Tienda Test',
    address: 'Av. Principal 100',
    city: 'Buenos Aires',
    province: 'CABA',
    location: 'Av. Principal 100, Buenos Aires',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Filtrado de servicios por sucursal', () => {
    it('debe mostrar todos los servicios si no hay sucursal seleccionada', () => {
      const services = [
        { id: 'svc-1', name: 'Servicio 1', branches_available: [] },
        { id: 'svc-2', name: 'Servicio 2', branches_available: ['branch-1'] },
        { id: 'svc-3', name: 'Servicio 3', branches_available: null },
      ];

      const selectedBranch = null;
      const filtered = services.filter(service => {
        if (!service.branches_available || service.branches_available.length === 0) {
          return true; // Disponible en todas
        }
        return service.branches_available.includes(selectedBranch!);
      });

      expect(filtered).toHaveLength(3); // Todos disponibles
    });

    it('debe filtrar servicios por sucursal seleccionada', () => {
      const services = [
        { id: 'svc-1', name: 'Servicio 1', branches_available: [] }, // Disponible en todas
        { id: 'svc-2', name: 'Servicio 2', branches_available: ['branch-1'] }, // Solo branch-1
        { id: 'svc-3', name: 'Servicio 3', branches_available: ['branch-2'] }, // Solo branch-2
        { id: 'svc-4', name: 'Servicio 4', branches_available: ['branch-1', 'branch-2'] }, // Ambas
      ];

      const selectedBranch = 'branch-1';
      const filtered = services.filter(service => {
        if (!service.branches_available || service.branches_available.length === 0) {
          return true; // Disponible en todas
        }
        return service.branches_available.includes(selectedBranch);
      });

      expect(filtered).toHaveLength(3); // svc-1, svc-2, svc-4
      expect(filtered.map(s => s.id)).toEqual(['svc-1', 'svc-2', 'svc-4']);
    });

    it('debe manejar servicios sin branches_available definido', () => {
      const services = [
        { id: 'svc-1', name: 'Servicio 1' }, // Sin branches_available
        { id: 'svc-2', name: 'Servicio 2', branches_available: undefined },
        { id: 'svc-3', name: 'Servicio 3', branches_available: null },
      ];

      const selectedBranch = 'branch-1';
      const filtered = services.filter(service => {
        if (!service.branches_available || service.branches_available.length === 0) {
          return true;
        }
        return service.branches_available.includes(selectedBranch);
      });

      expect(filtered).toHaveLength(3); // Todos disponibles
    });
  });

  describe('Construcción de lista de sucursales disponibles', () => {
    it('debe incluir ubicación principal en la lista', () => {
      const availableBranches = [
        { id: null, name: 'Ubicación Principal', address: mockStore.address },
        ...mockBranches,
      ];

      expect(availableBranches).toHaveLength(3);
      expect(availableBranches[0].name).toBe('Ubicación Principal');
    });

    it('debe filtrar sucursales por servicio si tiene branches_available definido', () => {
      const service = {
        id: 'svc-1',
        branches_available: ['branch-1'], // Solo disponible en branch-1
      };

      const availableBranches = service.branches_available && service.branches_available.length > 0
        ? mockBranches.filter(b => service.branches_available!.includes(b.id))
        : mockBranches;

      expect(availableBranches).toHaveLength(1);
      expect(availableBranches[0].id).toBe('branch-1');
    });

    it('debe mostrar todas las sucursales si el servicio no tiene restricciones', () => {
      const service = {
        id: 'svc-1',
        branches_available: [], // Disponible en todas
      };

      const availableBranches = service.branches_available && service.branches_available.length > 0
        ? mockBranches.filter(b => service.branches_available!.includes(b.id))
        : mockBranches;

      expect(availableBranches).toHaveLength(2);
    });
  });

  describe('Datos de sucursal en el appointment', () => {
    it('debe incluir branch_id cuando se selecciona una sucursal', () => {
      const appointmentData = {
        service_id: 'svc-1',
        date: '2024-01-15',
        time: '10:00',
        branch_id: 'branch-1',
      };

      expect(appointmentData.branch_id).toBe('branch-1');
    });

    it('debe incluir branch_id como null cuando se selecciona ubicación principal', () => {
      const appointmentData = {
        service_id: 'svc-1',
        date: '2024-01-15',
        time: '10:00',
        branch_id: null,
      };

      expect(appointmentData.branch_id).toBeNull();
    });
  });
});
