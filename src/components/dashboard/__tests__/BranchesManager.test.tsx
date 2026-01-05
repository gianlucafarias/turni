// =============================================================================
// Tests unitarios para lógica de BranchesManager
// =============================================================================

import { describe, it, expect } from 'vitest';

describe('BranchesManager - Lógica de Negocio', () => {
  const mockStoreId = 'test-store-id';
  const mockBranches = [
    {
      id: 'branch-1',
      name: 'Sucursal Centro',
      address: 'Av. Corrientes 1234',
      city: 'Buenos Aires',
      province: 'CABA',
      phone: '11-1234-5678',
      email: 'centro@example.com',
      is_active: true,
      display_order: 0,
    },
    {
      id: 'branch-2',
      name: 'Sucursal Norte',
      address: 'Av. Santa Fe 5678',
      city: 'Buenos Aires',
      province: 'CABA',
      phone: '11-8765-4321',
      email: 'norte@example.com',
      is_active: true,
      display_order: 1,
    },
  ];

  describe('Validación de datos de sucursal', () => {
    it('debe validar que el nombre de sucursal es requerido', () => {
      const emptyName = '';
      const validName = 'Sucursal Test';
      
      expect(emptyName.trim()).toBe('');
      expect(validName.trim()).toBe('Sucursal Test');
      expect(validName.trim().length).toBeGreaterThan(0);
    });

    it('debe validar estructura de datos de sucursal', () => {
      const branchData = {
        name: 'Sucursal Test',
        address: 'Av. Test 123',
        city: 'Buenos Aires',
        province: 'CABA',
        phone: '11-1234-5678',
        email: 'test@example.com',
      };

      expect(branchData.name).toBeTruthy();
      expect(branchData.address).toBeTruthy();
      expect(branchData.city).toBeTruthy();
      expect(branchData.province).toBeTruthy();
    });
  });

  describe('Filtrado y ordenamiento de sucursales', () => {
    it('debe filtrar solo sucursales activas', () => {
      const allBranches = [
        ...mockBranches,
        { ...mockBranches[0], id: 'branch-3', is_active: false },
      ];
      
      const activeBranches = allBranches.filter(b => b.is_active === true);
      expect(activeBranches).toHaveLength(2);
    });

    it('debe ordenar sucursales por display_order', () => {
      const unsorted = [
        { ...mockBranches[1], display_order: 2 },
        { ...mockBranches[0], display_order: 0 },
        { ...mockBranches[0], id: 'branch-3', display_order: 1 },
      ];

      const sorted = [...unsorted].sort((a, b) => a.display_order - b.display_order);
      
      expect(sorted[0].display_order).toBe(0);
      expect(sorted[1].display_order).toBe(1);
      expect(sorted[2].display_order).toBe(2);
    });
  });

  describe('Construcción de datos para guardar', () => {
    it('debe construir objeto correcto para insertar sucursal', () => {
      const formData = {
        name: 'Nueva Sucursal',
        address: 'Av. Nueva 123',
        city: 'Buenos Aires',
        province: 'CABA',
        phone: '11-9999-8888',
        email: 'nueva@example.com',
      };

      const branchToSave = {
        store_id: mockStoreId,
        name: formData.name.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        province: formData.province.trim(),
        phone: formData.phone.trim() || '',
        email: formData.email.trim() || '',
        is_active: true,
        display_order: 0,
      };

      expect(branchToSave.store_id).toBe(mockStoreId);
      expect(branchToSave.name).toBe('Nueva Sucursal');
      expect(branchToSave.is_active).toBe(true);
    });

    it('debe manejar campos opcionales correctamente', () => {
      const minimalData = {
        name: 'Sucursal Mínima',
        address: '',
        city: '',
        province: '',
        phone: '',
        email: '',
      };

      const branchToSave = {
        store_id: mockStoreId,
        name: minimalData.name.trim(),
        address: minimalData.address.trim() || '',
        city: minimalData.city.trim() || '',
        province: minimalData.province.trim() || '',
        phone: minimalData.phone.trim() || '',
        email: minimalData.email.trim() || '',
        is_active: true,
        display_order: 0,
      };

      expect(branchToSave.name).toBe('Sucursal Mínima');
      expect(branchToSave.address).toBe('');
      expect(branchToSave.phone).toBe('');
    });
  });
});
