// =============================================================================
// Tests unitarios para utilidades de mapas
// =============================================================================

import { describe, it, expect } from 'vitest';
import { getGoogleMapsUrl } from '../maps';

describe('getGoogleMapsUrl', () => {
  it('debe construir URL correcta con solo dirección', () => {
    const url = getGoogleMapsUrl('Av. Corrientes 1234');
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=Av.%20Corrientes%201234');
  });

  it('debe construir URL correcta con dirección y ciudad', () => {
    const url = getGoogleMapsUrl('Av. Corrientes 1234', 'Buenos Aires');
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=Av.%20Corrientes%201234%2C%20Buenos%20Aires');
  });

  it('debe construir URL correcta con dirección, ciudad y provincia', () => {
    const url = getGoogleMapsUrl('Av. Corrientes 1234', 'Buenos Aires', 'CABA');
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=Av.%20Corrientes%201234%2C%20Buenos%20Aires%2C%20CABA');
  });

  it('debe manejar caracteres especiales correctamente', () => {
    const url = getGoogleMapsUrl('Av. Santa Fe 1234, Piso 5', 'Buenos Aires', 'CABA');
    expect(url).toContain('Av.%20Santa%20Fe%201234');
    expect(url).toContain('Buenos%20Aires');
    expect(url).toContain('CABA');
  });

  it('debe manejar valores vacíos o undefined', () => {
    const url1 = getGoogleMapsUrl('Av. Corrientes 1234', '', 'CABA');
    expect(url1).toBe('https://www.google.com/maps/search/?api=1&query=Av.%20Corrientes%201234%2C%20CABA');
    
    const url2 = getGoogleMapsUrl('Av. Corrientes 1234', undefined, 'CABA');
    expect(url2).toBe('https://www.google.com/maps/search/?api=1&query=Av.%20Corrientes%201234%2C%20CABA');
  });

  it('debe incluir el prefijo correcto de Google Maps', () => {
    const url = getGoogleMapsUrl('Test Address');
    expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
  });
});
