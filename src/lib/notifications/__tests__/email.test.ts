// =============================================================================
// Tests unitarios para el cliente de Email
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailClient } from '../email';
import type { AppointmentForNotification, NotificationRecipient } from '../types';

// Mock de fetch global
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('EmailClient', () => {
  let client: EmailClient;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Crear cliente con configuración de SendGrid (más simple para tests)
    client = new EmailClient({
      provider: 'sendgrid',
      fromAddress: 'test@example.com',
      fromName: 'Test Store',
      sendgridApiKey: 'test-api-key',
    });
  });
  
  describe('isConfigured', () => {
    it('devuelve true si SendGrid está configurado', () => {
      expect(client.isConfigured()).toBe(true);
    });
    
    it('devuelve false si falta el from address', () => {
      const unconfiguredClient = new EmailClient({
        provider: 'sendgrid',
        fromAddress: '',
        sendgridApiKey: 'test',
      });
      expect(unconfiguredClient.isConfigured()).toBe(false);
    });
    
    it('devuelve false si falta la API key de SendGrid', () => {
      const unconfiguredClient = new EmailClient({
        provider: 'sendgrid',
        fromAddress: 'test@example.com',
        sendgridApiKey: '',
      });
      expect(unconfiguredClient.isConfigured()).toBe(false);
    });
  });
  
  describe('send via SendGrid', () => {
    it('envía email correctamente', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (key: string) => key === 'X-Message-Id' ? 'msg-123' : null,
        },
      });
      
      const result = await client.send({
        to: 'recipient@test.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      });
      
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(result.status).toBe('sent');
      expect(result.channel).toBe('email');
      expect(result.cost?.amount).toBeGreaterThan(0);
    });
    
    it('maneja errores de SendGrid correctamente', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid email address',
      });
      
      const result = await client.send({
        to: 'invalid-email',
        subject: 'Test',
        html: '<p>Test</p>',
      });
      
      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error?.code).toBe('SENDGRID_ERROR');
    });
    
    it('marca errores de rate limit como reintentables', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });
      
      const result = await client.send({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });
      
      expect(result.success).toBe(false);
      expect(result.error?.retryable).toBe(true);
    });
  });
  
  describe('send via Resend', () => {
    let resendClient: EmailClient;
    
    beforeEach(() => {
      resendClient = new EmailClient({
        provider: 'resend',
        fromAddress: 'test@example.com',
        resendApiKey: 'test-resend-key',
      });
    });
    
    it('envía email correctamente via Resend', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'resend-msg-123' }),
      });
      
      const result = await resendClient.send({
        to: 'recipient@test.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });
      
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('resend-msg-123');
      
      // Verificar que se llamó a la API de Resend
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-resend-key',
          }),
        })
      );
    });
  });
  
  describe('sendAppointmentReminder', () => {
    const mockAppointment: AppointmentForNotification = {
      id: 'apt-123',
      storeId: 'store-123',
      storeName: 'Test Store',
      clientId: 'client-123',
      clientName: 'María García',
      clientEmail: 'maria@test.com',
      clientPhone: '+54 11 1234-5678',
      serviceName: 'Manicura',
      servicePrice: 3500,
      date: '2024-03-20',
      time: '14:30',
      status: 'confirmed',
    };
    
    it('envía recordatorio por email correctamente', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'msg-reminder-123',
        },
      });
      
      const result = await client.sendAppointmentReminder(mockAppointment);
      
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Verificar contenido del email
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.subject).toContain('Recordatorio');
      expect(callBody.personalizations[0].to[0].email).toBe('maria@test.com');
    });
    
    it('retorna error si el cliente no tiene email', async () => {
      const appointmentWithoutEmail = { ...mockAppointment, clientEmail: undefined };
      
      const result = await client.sendAppointmentReminder(appointmentWithoutEmail);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NO_EMAIL');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
  
  describe('sendInactivityReminder', () => {
    const mockRecipient: NotificationRecipient = {
      id: 'client-456',
      firstName: 'Carlos',
      lastName: 'López',
      email: 'carlos@test.com',
      phone: '+54 11 9876-5432',
      storeId: 'store-789',
    };
    
    it('envía recordatorio de inactividad correctamente', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'msg-inactivity-123' },
      });
      
      const result = await client.sendInactivityReminder(mockRecipient, 'Mi Negocio');
      
      expect(result.success).toBe(true);
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.subject).toContain('extrañamos');
    });
  });
  
  describe('sendBatch', () => {
    it('envía múltiples emails con delay', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, headers: { get: () => 'msg-1' } })
        .mockResolvedValueOnce({ ok: true, headers: { get: () => 'msg-2' } })
        .mockResolvedValueOnce({ ok: true, headers: { get: () => 'msg-3' } });
      
      const payloads = [
        { to: 'test1@example.com', subject: 'Test 1', html: '<p>1</p>' },
        { to: 'test2@example.com', subject: 'Test 2', html: '<p>2</p>' },
        { to: 'test3@example.com', subject: 'Test 3', html: '<p>3</p>' },
      ];
      
      const results = await client.sendBatch(payloads, 10); // 10ms delay
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
    
    it('continúa con fallos parciales', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, headers: { get: () => 'msg-1' } })
        .mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'Error' })
        .mockResolvedValueOnce({ ok: true, headers: { get: () => 'msg-3' } });
      
      const payloads = [
        { to: 'test1@example.com', subject: 'Test 1', html: '<p>1</p>' },
        { to: 'invalid', subject: 'Test 2', html: '<p>2</p>' },
        { to: 'test3@example.com', subject: 'Test 3', html: '<p>3</p>' },
      ];
      
      const results = await client.sendBatch(payloads, 0);
      
      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });
  });
});



