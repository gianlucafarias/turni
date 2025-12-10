// =============================================================================
// API para métricas de notificaciones
// =============================================================================

import type { APIRoute } from 'astro';
import { getNotificationService } from '../../../lib/notifications';
import { getSegmentationService } from '../../../lib/notifications/segmentation';

/**
 * GET: Obtiene métricas de notificaciones de una tienda
 */
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const storeId = url.searchParams.get('store_id');
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');
  
  if (!storeId) {
    return new Response(JSON.stringify({ error: 'store_id required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  try {
    const notificationService = getNotificationService();
    const segmentationService = getSegmentationService();
    
    // Obtener métricas de notificaciones
    const metrics = await notificationService.getMetrics(
      storeId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );
    
    // Obtener conteos de segmentación
    const [tags, inactiveClientsCount] = await Promise.all([
      segmentationService.getTags(storeId),
      segmentationService.countClients({
        storeId,
        inactiveDays: 30,
        isActive: true,
      }),
    ]);
    
    // Obtener canales disponibles
    const availableChannels = notificationService.getAvailableChannels();
    
    return new Response(JSON.stringify({
      metrics,
      segmentation: {
        tags,
        inactive_clients_30_days: inactiveClientsCount,
      },
      available_channels: availableChannels,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Metrics API] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal server error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

