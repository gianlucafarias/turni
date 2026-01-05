/**
 * Rubros de negocio disponibles
 */
export const BUSINESS_CATEGORIES = [
  {
    id: 'profesional',
    name: 'Profesional',
    description: 'Abogados, contadores, consultores, etc.',
  },
  {
    id: 'peluqueria',
    name: 'Peluquería',
    description: 'Cortes, peinados, tinturas, etc.',
  },
  {
    id: 'salud',
    name: 'Sector Salud',
    description: 'Médicos, dentistas, psicólogos, etc.',
  },
  {
    id: 'estetica',
    name: 'Estética',
    description: 'Depilación, uñas, tratamientos faciales, etc.',
  },
  {
    id: 'fitness',
    name: 'Fitness y Deportes',
    description: 'Gimnasios, entrenadores, clases, etc.',
  },
  {
    id: 'otro',
    name: 'Otro',
    description: 'Otro tipo de negocio',
  },
]

/**
 * Obtiene el nombre del rubro por su ID
 */
export function getBusinessCategoryName(categoryId: string | null | undefined): string {
  if (!categoryId) return ''
  const category = BUSINESS_CATEGORIES.find(c => c.id === categoryId)
  return category?.name || categoryId
}
