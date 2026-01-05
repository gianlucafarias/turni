# Tests para Funcionalidad de Sucursales

Este documento describe los tests implementados para asegurar que la funcionalidad de sucursales (branches) funcione correctamente.

## Tests Implementados

### 1. Tests de Utilidades de Mapas (`src/utils/__tests__/maps.test.ts`)

Prueban la función `getGoogleMapsUrl` que construye URLs de Google Maps:

- ✅ Construcción de URL con solo dirección
- ✅ Construcción de URL con dirección y ciudad
- ✅ Construcción de URL con dirección, ciudad y provincia
- ✅ Manejo de caracteres especiales
- ✅ Manejo de valores vacíos o undefined
- ✅ Validación del prefijo correcto de Google Maps

**Ejecutar:**
```bash
npm test -- src/utils/__tests__/maps.test.ts
```

### 2. Tests de Página Pública (`src/pages/__tests__/storeId.branches.test.ts`)

Prueban la funcionalidad de sucursales en la página pública de la tienda:

- ✅ Carga de sucursales activas
- ✅ Ordenamiento de sucursales por `display_order` y `created_at`
- ✅ Manejo del caso cuando no hay sucursales
- ✅ Construcción de URLs de Google Maps para ubicación principal
- ✅ Construcción de URLs de Google Maps para sucursales
- ✅ Lógica de visualización (mostrar sucursales vs ubicación principal)
- ✅ Validación de datos de contacto
- ✅ Validación de información de sucursal

**Ejecutar:**
```bash
npm test -- src/pages/__tests__/storeId.branches.test.ts
```

### 3. Tests de BookingWidget (`src/components/public/__tests__/BookingWidget.branches.test.tsx`)

Prueban la funcionalidad de sucursales en el widget de reservas:

- ✅ Filtrado de servicios por sucursal seleccionada
- ✅ Mostrar todos los servicios si no hay sucursal seleccionada
- ✅ Manejo de servicios sin `branches_available` definido
- ✅ Construcción de lista de sucursales disponibles
- ✅ Inclusión de ubicación principal en la lista
- ✅ Filtrado de sucursales por servicio
- ✅ Inclusión de `branch_id` en datos de appointment

**Ejecutar:**
```bash
npm test -- src/components/public/__tests__/BookingWidget.branches.test.tsx
```

### 4. Tests de BranchesManager (`src/components/dashboard/__tests__/BranchesManager.test.tsx`)

Prueban la lógica de negocio del componente de gestión de sucursales:

- ✅ Validación de nombre de sucursal requerido
- ✅ Validación de estructura de datos de sucursal
- ✅ Filtrado de sucursales activas
- ✅ Ordenamiento de sucursales por `display_order`
- ✅ Construcción de datos para guardar sucursal
- ✅ Manejo de campos opcionales

**Ejecutar:**
```bash
npm test -- src/components/dashboard/__tests__/BranchesManager.test.tsx
```

## Ejecutar Todos los Tests

Para ejecutar todos los tests relacionados con sucursales:

```bash
npm test -- branches
```

Para ejecutar todos los tests del proyecto:

```bash
npm test
```

Para ejecutar tests en modo watch (desarrollo):

```bash
npm run test:watch
```

## Cobertura de Tests

Los tests cubren:

1. **Funcionalidad Core:**
   - Carga de sucursales desde la base de datos
   - Filtrado y ordenamiento
   - Validación de datos

2. **Integración con UI:**
   - Mostrar sucursales en página pública
   - Selección de sucursal en widget de reservas
   - Gestión de sucursales en dashboard

3. **Utilidades:**
   - Construcción de URLs de Google Maps
   - Manejo de datos opcionales

## Notas

- Los tests no requieren una base de datos real (usan mocks)
- Los tests de componentes React están simplificados para no requerir React Testing Library
- Para tests más complejos de UI, se recomienda agregar `@testing-library/react` y `@testing-library/jest-dom`

## Próximos Pasos

Para mejorar la cobertura de tests, considerar:

1. Agregar tests de integración con Supabase (usando test database)
2. Agregar tests E2E para flujo completo de creación de sucursal
3. Agregar tests de componentes React con React Testing Library
4. Agregar tests de API endpoints relacionados con sucursales
