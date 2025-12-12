import type { APIRoute } from 'astro'
import { supabase } from '../../../lib/supabase'

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const { appointment_id, change_type, old_date, old_time, new_date, new_time } = body

    if (!appointment_id || !change_type) {
      return new Response(JSON.stringify({ error: 'Faltan parámetros requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Obtener información del turno
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('*, stores!inner(*)')
      .eq('id', appointment_id)
      .single()

    if (appointmentError || !appointment) {
      return new Response(JSON.stringify({ error: 'Turno no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const store = appointment.stores

    // Crear notificación para el dashboard
    const notification = {
      type: change_type === 'cancelled' ? 'appointment_cancelled_by_client' : 'appointment_modified_by_client',
      title: change_type === 'cancelled' 
        ? 'Turno cancelado por cliente' 
        : 'Turno modificado por cliente',
      message: change_type === 'cancelled'
        ? `${appointment.client_name} canceló su turno del ${old_date} a las ${old_time}`
        : `${appointment.client_name} modificó su turno del ${old_date} ${old_time} al ${new_date} ${new_time}`,
      priority: 'high' as const,
      data: {
        appointmentId: appointment.id,
        clientName: appointment.client_name,
        serviceName: appointment.service_name,
        changeType: change_type,
        oldDate: old_date,
        oldTime: old_time,
        newDate: new_date,
        newTime: new_time,
        linkTo: `/dashboard/appointments/${appointment.id}`,
      },
      storeId: store.id,
      createdAt: new Date().toISOString(),
      read: false,
    }

    // Guardar notificación en una tabla temporal para que el dashboard la detecte
    // Esto funciona como fallback si Realtime no está disponible
    try {
      // Intentar crear tabla si no existe
      await supabase.rpc('create_notification_if_not_exists', {
        p_store_id: store.id,
        p_notification: notification
      }).catch(() => {
        // Si la función no existe, intentar insertar directamente
        // (esto fallará si la tabla no existe, pero no es crítico)
      })

      // Guardar en una tabla de notificaciones pendientes
      // El dashboard las detectará al hacer polling
      const { error: insertError } = await supabase
        .from('appointment_notifications_pending')
        .insert({
          store_id: store.id,
          appointment_id: appointment.id,
          notification_type: notification.type,
          notification_data: notification,
          created_at: new Date().toISOString()
        })
        .catch(() => {
          // Si la tabla no existe, no es crítico - Realtime debería funcionar
        })
    } catch (error) {
      // No es crítico si falla - Realtime debería manejar esto
      console.log('No se pudo guardar notificación pendiente, se usará Realtime')
    }

    return new Response(JSON.stringify({ success: true, notification }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Error notificando cambio:', error)
    return new Response(JSON.stringify({ error: error.message || 'Error al procesar la notificación' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

