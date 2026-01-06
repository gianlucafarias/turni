# Sistema de Pagos Recurrentes - Mercado Pago

## Cómo Funciona

### Flujo de Suscripción

1. **Usuario se suscribe** → Se crea suscripción en MP con `preapproval`
2. **MP debita automáticamente** cada mes/año → Envía webhook `subscription_authorized_payment`
3. **Nuestro webhook** → Registra el pago en `subscription_payments` y renueva el período

### Tipos de Webhooks

| Tipo | Descripción | Acción |
|------|-------------|--------|
| `subscription_preapproval` | Cambio de estado de suscripción (autorizada, pausada, cancelada) | Actualiza estado en DB |
| `subscription_authorized_payment` | **Pago recurrente procesado** | Registra pago + renueva período |
| `payment` | Pago genérico | Solo si está relacionado a suscripción |

## Configuración en Mercado Pago

### 1. URL del Webhook

Configurá esta URL en tu aplicación de Mercado Pago:

```
https://tu-dominio.com/api/subscriptions/webhook
```

### 2. Eventos a Suscribir

En la configuración de webhooks de tu aplicación de MP, activa estos topics:

- ✅ `subscription_preapproval` - Cambios en suscripciones
- ✅ `subscription_authorized_payment` - Pagos de suscripción
- ✅ `payment` - Pagos (opcional, como fallback)

### 3. Verificar Configuración

Podés verificar la configuración desde:

1. **Panel de Mercado Pago Developers**: https://www.mercadopago.com.ar/developers/panel
2. Andá a tu aplicación → Webhooks → Verificá URL y topics activos

## Base de Datos

### Tablas Involucradas

```sql
-- Tabla de pagos
subscription_payments:
  - id (UUID)
  - subscription_id (FK)
  - store_id (FK)
  - amount (NUMERIC)
  - status (pending|approved|rejected|refunded)
  - mp_payment_id (ID de MP)
  - mp_status
  - mp_status_detail
  - paid_at (timestamp del pago)
  - created_at

-- Tabla de eventos (auditoría)
subscription_events:
  - event_type (payment_succeeded|payment_failed|mp_authorized, etc.)
  - event_data (JSON con detalles)
```

## Verificar que Funciona

### 1. Ver Logs en Servidor

Los logs del webhook muestran:
```
📥 Received MP Webhook: { type: 'subscription_authorized_payment', ... }
💳 Processing subscription payment: xxx
✅ Payment registered: { mp_payment_id: xxx, amount: 4990, status: 'approved' }
✅ Subscription period renewed until: 2024-03-15T...
```

### 2. Verificar en Base de Datos

```sql
-- Ver últimos pagos
SELECT * FROM subscription_payments 
ORDER BY created_at DESC 
LIMIT 10;

-- Ver eventos de suscripción
SELECT * FROM subscription_events 
WHERE event_type IN ('payment_succeeded', 'payment_failed')
ORDER BY created_at DESC;
```

### 3. Probar con Usuario Test

1. Crear usuario test en MP
2. Suscribirse con tarjeta de prueba
3. Esperar el primer débito (o forzar desde panel de MP)
4. Verificar que aparece en el historial

## Tarjetas de Prueba (Sandbox)

| Tarjeta | Número | CVV | Vencimiento | Resultado |
|---------|--------|-----|-------------|-----------|
| Mastercard | 5031 7557 3453 0604 | 123 | 11/25 | Aprobado |
| Visa | 4509 9535 6623 3704 | 123 | 11/25 | Aprobado |
| Rechazada | 5031 7557 3453 0605 | 123 | 11/25 | Rechazado |

## Troubleshooting

### Los pagos no se registran

1. **Verificar URL del webhook**: Debe ser accesible públicamente
2. **Verificar logs**: Buscar errores en el servidor
3. **Verificar MP_ACCESS_TOKEN**: Debe estar configurado

### Suscripción no se activa

1. Verificar que el webhook de `subscription_preapproval` llegue
2. Verificar que `external_reference` tenga formato `store_{storeId}_xxx`

### Pagos duplicados

El sistema ya verifica duplicados por `mp_payment_id`, pero si ves duplicados:
```sql
-- Encontrar duplicados
SELECT mp_payment_id, COUNT(*) 
FROM subscription_payments 
GROUP BY mp_payment_id 
HAVING COUNT(*) > 1;
```

## Testing Local

Para probar webhooks en desarrollo:

1. Usar ngrok o similar: `ngrok http 4321`
2. Configurar URL temporal en MP
3. Hacer prueba de suscripción

```bash
# Con ngrok
ngrok http 4321
# Copiar URL https://xxxx.ngrok.io/api/subscriptions/webhook
```
