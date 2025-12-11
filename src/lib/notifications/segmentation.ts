// =============================================================================
// Servicio de Segmentación de Clientes para Notificaciones
// Permite filtrar clientes por etiquetas, inactividad, etc.
// =============================================================================

import { supabase } from '../supabase';
import type { ClientSegmentationFilter, NotificationRecipient } from './types';

/**
 * Servicio de segmentación de clientes
 */
export class ClientSegmentationService {
  
  /**
   * Obtiene clientes según filtros de segmentación
   */
  async getClients(filter: ClientSegmentationFilter): Promise<NotificationRecipient[]> {
    let query = supabase
      .from('clients')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        store_id,
        last_appointment_date,
        is_active
      `)
      .eq('store_id', filter.storeId);
    
    // Filtro por estado activo
    if (filter.isActive !== undefined) {
      query = query.eq('is_active', filter.isActive);
    }
    
    // Filtro por disponibilidad de contacto
    if (filter.hasPhone) {
      query = query.not('phone', 'is', null);
    }
    if (filter.hasEmail) {
      query = query.not('email', 'is', null);
    }
    
    // Filtro por inactividad
    if (filter.inactiveDays !== undefined && filter.inactiveDays > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - filter.inactiveDays);
      query = query.lt('last_appointment_date', cutoffDate.toISOString().split('T')[0]);
    }
    
    // Límite
    if (filter.limit) {
      query = query.limit(filter.limit);
    }
    
    const { data: clients, error } = await query;
    
    if (error) {
      console.error('[SegmentationService] Error fetching clients:', error);
      return [];
    }
    
    let recipients: NotificationRecipient[] = (clients || []).map(client => ({
      id: client.id,
      firstName: client.first_name,
      lastName: client.last_name || undefined,
      email: client.email || undefined,
      phone: client.phone || undefined,
      storeId: client.store_id,
    }));
    
    // Filtro por etiquetas (requiere query adicional)
    if (filter.tagIds && filter.tagIds.length > 0) {
      recipients = await this.filterByTags(
        recipients,
        filter.tagIds,
        filter.tagMatchMode || 'any'
      );
    }
    
    // Filtro por preferencias de opt-in
    if (filter.optInWhatsApp !== undefined || filter.optInEmail !== undefined) {
      recipients = await this.filterByOptIn(
        recipients,
        filter.storeId,
        filter.optInWhatsApp,
        filter.optInEmail
      );
    }
    
    return recipients;
  }
  
  /**
   * Filtra clientes por etiquetas
   */
  private async filterByTags(
    recipients: NotificationRecipient[],
    tagIds: string[],
    matchMode: 'any' | 'all'
  ): Promise<NotificationRecipient[]> {
    const clientIds = recipients.map(r => r.id);
    
    // Obtener relaciones cliente-etiqueta
    const { data: relations, error } = await supabase
      .from('client_tag_relations')
      .select('client_id, tag_id')
      .in('client_id', clientIds)
      .in('tag_id', tagIds);
    
    if (error) {
      console.error('[SegmentationService] Error fetching tag relations:', error);
      return recipients;
    }
    
    // Agrupar por cliente
    const clientTagMap = new Map<string, Set<string>>();
    for (const rel of relations || []) {
      if (!clientTagMap.has(rel.client_id)) {
        clientTagMap.set(rel.client_id, new Set());
      }
      clientTagMap.get(rel.client_id)!.add(rel.tag_id);
    }
    
    // Filtrar según modo
    return recipients.filter(recipient => {
      const clientTags = clientTagMap.get(recipient.id);
      if (!clientTags) return false;
      
      if (matchMode === 'any') {
        // Al menos una etiqueta coincide
        return tagIds.some(tagId => clientTags.has(tagId));
      } else {
        // Todas las etiquetas deben coincidir
        return tagIds.every(tagId => clientTags.has(tagId));
      }
    });
  }
  
  /**
   * Filtra clientes por preferencias de opt-in
   */
  private async filterByOptIn(
    recipients: NotificationRecipient[],
    storeId: string,
    optInWhatsApp?: boolean,
    optInEmail?: boolean
  ): Promise<NotificationRecipient[]> {
    const clientIds = recipients.map(r => r.id);
    
    // Obtener preferencias
    const { data: preferences, error } = await supabase
      .from('client_notification_preferences')
      .select('client_id, whatsapp_enabled, email_enabled')
      .eq('store_id', storeId)
      .in('client_id', clientIds);
    
    if (error) {
      console.error('[SegmentationService] Error fetching preferences:', error);
      return recipients;
    }
    
    // Crear mapa de preferencias
    const prefsMap = new Map<string, { whatsapp: boolean; email: boolean }>();
    for (const pref of preferences || []) {
      prefsMap.set(pref.client_id, {
        whatsapp: pref.whatsapp_enabled,
        email: pref.email_enabled,
      });
    }
    
    return recipients.filter(recipient => {
      const prefs = prefsMap.get(recipient.id);
      
      // Si no tiene preferencias, asumimos opt-in por defecto
      const whatsappEnabled = prefs?.whatsapp ?? true;
      const emailEnabled = prefs?.email ?? true;
      
      if (optInWhatsApp !== undefined && whatsappEnabled !== optInWhatsApp) {
        return false;
      }
      if (optInEmail !== undefined && emailEnabled !== optInEmail) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Obtiene clientes inactivos usando la función de DB
   */
  async getInactiveClients(
    storeId: string,
    inactiveDays: number = 30,
    limit: number = 100
  ): Promise<NotificationRecipient[]> {
    const { data, error } = await supabase.rpc('get_inactive_clients', {
      p_store_id: storeId,
      p_inactive_days: inactiveDays,
      p_limit: limit,
    });
    
    if (error) {
      console.error('[SegmentationService] Error getting inactive clients:', error);
      return [];
    }
    
    return (data || []).map((client: any) => ({
      id: client.id,
      firstName: client.first_name,
      lastName: client.last_name || undefined,
      email: client.email || undefined,
      phone: client.phone || undefined,
      storeId,
    }));
  }
  
  /**
   * Obtiene todas las etiquetas de una tienda
   */
  async getTags(storeId: string): Promise<Array<{
    id: string;
    name: string;
    color: string;
    clientCount: number;
  }>> {
    const { data: tags, error } = await supabase
      .from('client_tags')
      .select('id, name, color')
      .eq('store_id', storeId);
    
    if (error) {
      console.error('[SegmentationService] Error fetching tags:', error);
      return [];
    }
    
    // Contar clientes por etiqueta
    const tagIds = (tags || []).map(t => t.id);
    const { data: counts, error: countError } = await supabase
      .from('client_tag_relations')
      .select('tag_id')
      .in('tag_id', tagIds);
    
    const countMap = new Map<string, number>();
    if (!countError && counts) {
      for (const rel of counts) {
        countMap.set(rel.tag_id, (countMap.get(rel.tag_id) || 0) + 1);
      }
    }
    
    return (tags || []).map(tag => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      clientCount: countMap.get(tag.id) || 0,
    }));
  }
  
  /**
   * Obtiene clientes por etiqueta
   */
  async getClientsByTag(
    storeId: string,
    tagId: string
  ): Promise<NotificationRecipient[]> {
    const { data: relations, error: relError } = await supabase
      .from('client_tag_relations')
      .select('client_id')
      .eq('tag_id', tagId);
    
    if (relError || !relations || relations.length === 0) {
      return [];
    }
    
    const clientIds = relations.map(r => r.client_id);
    
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, first_name, last_name, email, phone, store_id')
      .eq('store_id', storeId)
      .in('id', clientIds)
      .eq('is_active', true);
    
    if (error) {
      console.error('[SegmentationService] Error fetching clients by tag:', error);
      return [];
    }
    
    return (clients || []).map(client => ({
      id: client.id,
      firstName: client.first_name,
      lastName: client.last_name || undefined,
      email: client.email || undefined,
      phone: client.phone || undefined,
      storeId: client.store_id,
    }));
  }
  
  /**
   * Cuenta clientes según filtros (sin cargar todos los datos)
   */
  async countClients(filter: ClientSegmentationFilter): Promise<number> {
    const clients = await this.getClients({ ...filter, limit: undefined });
    return clients.length;
  }
}

/**
 * Instancia singleton del servicio
 */
let segmentationServiceInstance: ClientSegmentationService | null = null;

/**
 * Obtiene la instancia del servicio de segmentación
 */
export function getSegmentationService(): ClientSegmentationService {
  if (!segmentationServiceInstance) {
    segmentationServiceInstance = new ClientSegmentationService();
  }
  return segmentationServiceInstance;
}



