// =============================================================================
// Tests unitarios para el cliente de WhatsApp
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhatsAppClient } from '../whatsapp';
import type { AppointmentForNotification } from '../types';

// Mock de fetch global
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('WhatsAppClient', () => {
  let client: WhatsAppClient;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Crear cliente con configuración de prueba
    client = new WhatsAppClient({
      apiToken: 'test-token',
      phoneNumberId: 'test-phone-id',
      businessAccountId: 'test-account-id',
    });
  });
  
  describe('isConfigured', () => {
    it('devuelve true si todas las variables están configuradas', () => {
      expect(client.isConfigured()).toBe(true);
    });
    
    it('devuelve false si falta el token', () => {
      const unconfiguredClient = new WhatsAppClient({
        apiToken: '',
        phoneNumberId: 'test',
        businessAccountId: 'test',
      });
      expect(unconfiguredClient.isConfigured()).toBe(false);
    });
  });
  
  describe('formatPhoneNumber', () => {
    // Usar método interno a través de sendTemplate
    const getFormattedPhone = (phone: string): string => {
      // @ts-ignore - accedemos al método privado para testing
      return client['formatPhoneNumber'](phone);
    };
    
    it('formatea número argentino con código de país', () => {
      expect(getFormattedPhone('+54 11 1234-5678')).toBe('5491112345678');
    });
    
    it('agrega código de país si no tiene', () => {
      expect(getFormattedPhone('1112345678')).toBe('5491112345678');
    });
    
    it('convierte número con 0 inicial a formato internacional', () => {
      expect(getFormattedPhone('011 1234-5678')).toBe('5491112345678');
    });
    
    it('agrega 9 para celulares argentinos', () => {
      expect(getFormattedPhone('541112345678')).toBe('5491112345678');
    });
  });
  
  describe('sendTemplate', () => {
    it('envía mensaje correctamente y retorna success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messaging_product: 'whatsapp',
          contacts: [{ input: '5491112345678', wa_id: '5491112345678' }],
          messages: [{ id: 'wamid.test123' }],
        }),
      });
      
      const result = await client.sendTemplate({
        to: '+54 11 1234-5678',
        templateName: 'test_template',
        languageCode: 'es_AR',
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: 'Test' }],
          },
        ],
      });
      
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('wamid.test123');
      expect(result.status).toBe('sent');
      expect(result.channel).toBe('whatsapp');
    });
    
    it('maneja errores de la API correctamente', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: 100,
            message: 'Invalid parameter',
            type: 'OAuthException',
            fbtrace_id: 'test123',
          },
        }),
      });
      
      const result = await client.sendTemplate({
        to: '+54 11 1234-5678',
        templateName: 'test_template',
        languageCode: 'es_AR',
        components: [],
      });
      
      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error?.code).toBe('100');
      expect(result.error?.retryable).toBe(false);
    });
    
    it('marca errores de rate limit como reintentables', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            code: 130429,
            message: 'Rate limit exceeded',
            type: 'OAuthException',
            fbtrace_id: 'test123',
          },
        }),
      });
      
      const result = await client.sendTemplate({
        to: '+54 11 1234-5678',
        templateName: 'test_template',
        languageCode: 'es_AR',
        components: [],
      });
      
      expect(result.success).toBe(false);
      expect(result.error?.retryable).toBe(true);
    });
    
    it('maneja errores de red correctamente', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      const result = await client.sendTemplate({
        to: '+54 11 1234-5678',
        templateName: 'test_template',
        languageCode: 'es_AR',
        components: [],
      });
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NETWORK_ERROR');
      expect(result.error?.retryable).toBe(true);
    });
  });
  
  describe('sendAppointmentReminder', () => {
    const mockAppointment: AppointmentForNotification = {
      id: 'apt-123',
      storeId: 'store-123',
      storeName: 'Test Store',
      clientId: 'client-123',
      clientName: 'Juan Pérez',
      clientEmail: 'juan@test.com',
      clientPhone: '+54 11 1234-5678',
      serviceName: 'Corte de pelo',
      servicePrice: 5000,
      date: '2024-03-15',
      time: '10:00',
      status: 'confirmed',
    };
    
    it('envía recordatorio correctamente', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messaging_product: 'whatsapp',
          contacts: [{ input: '5491112345678', wa_id: '5491112345678' }],
          messages: [{ id: 'wamid.reminder123' }],
        }),
      });
      
      const result = await client.sendAppointmentReminder(mockAppointment);
      
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Verificar que se usó la plantilla correcta
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.template.name).toBe('appointment_reminder');
    });
    
    it('retorna error si el cliente no tiene teléfono', async () => {
      const appointmentWithoutPhone = { ...mockAppointment, clientPhone: undefined };
      
      const result = await client.sendAppointmentReminder(appointmentWithoutPhone);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NO_PHONE');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
  
  describe('estimateCampaignCost', () => {
    it('calcula costo de campaña marketing correctamente', () => {
      const estimate = client.estimateCampaignCost(100, 'marketing');
      
      expect(estimate.costPerMessage).toBeGreaterThan(0);
      expect(estimate.totalCost).toBe(Number((100 * estimate.costPerMessage).toFixed(4)));
      expect(estimate.currency).toBe('USD');
    });
    
    it('calcula costo de campaña utility correctamente', () => {
      const estimate = client.estimateCampaignCost(100, 'utility');
      
      // Utility debe ser más barato que marketing
      const marketingEstimate = client.estimateCampaignCost(100, 'marketing');
      expect(estimate.totalCost).toBeLessThan(marketingEstimate.totalCost);
    });
  });
});





