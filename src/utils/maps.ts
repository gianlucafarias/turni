/**
 * Utilidades para trabajar con mapas y direcciones
 */

/**
 * Construye una URL de Google Maps para buscar una dirección
 * @param address - Dirección principal
 * @param city - Ciudad (opcional)
 * @param province - Provincia (opcional)
 * @returns URL de Google Maps con la búsqueda
 */
export function getGoogleMapsUrl(address: string, city?: string, province?: string): string {
  const fullAddress = [address, city, province].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
}
