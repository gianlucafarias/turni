# Sistema de Notificaciones WhatsApp + Email

## Resumen

Sistema de notificaciones para usuarios premium que permite enviar:
- Recordatorios de turnos (día del turno)
- Confirmaciones de estado de turno
- Campañas masivas por etiquetas o inactividad

## Arquitectura

```
src/
├── config/
│   └── notifications.ts       # Configuración de costos y plantillas
├── lib/
│   └── notifications/
│       ├── index.ts           # Servicio unificado
│       ├── types.ts           # Tipos TypeScript
│       ├── whatsapp.ts        # Cliente Cloud API
│       ├── email.ts           # Adapter multi-proveedor
│       ├── segmentation.ts    # Filtrado de clientes
│       └── scheduler.ts       # Jobs programados
├── pages/
│   └── api/
│       ├── webhooks/
│       │   └── whatsapp.ts    # Webhook de estados
│       └── notifications/
│           ├── cron.ts        # Procesamiento de jobs
│           ├── campaigns.ts   # Gestión de campañas
│           ├── send.ts        # Envío manual
│           └── metrics.ts     # Métricas
└── supabase/
    └── migrations/
        └── 20240219_notification_logs.sql  # Tablas de logs
```

## Costos Estimados (Argentina, 2025)

### WhatsApp Business API
| Categoría | Costo por mensaje (USD) | Uso típico |
|-----------|------------------------|------------|
| Utility | ~$0.008 | Recordatorios, confirmaciones |
| Marketing | ~$0.025 | Campañas, inactividad |
| Authentication | ~$0.0085 | OTP (no usado actualmente) |
| Service | $0 | Respuestas dentro de 24h |

### Email (Amazon SES)
- $0.10 por 1,000 emails
- 62,000 gratis/mes si se usa desde EC2
- Data out: $0.12/GB

### Estimación Mensual

Para un negocio con:
- 100 turnos/mes (recordatorios utility)
- 50 confirmaciones (utility)
- 1 campaña masiva a 200 clientes (marketing)

```
WhatsApp:
- 150 × $0.008 (utility) = $1.20
- 200 × $0.025 (marketing) = $5.00
- Total WhatsApp: ~$6.20/mes

Email (fallback):
- 350 emails = ~$0.04
```

## Configuración

### Variables de Entorno

```env
# WhatsApp Cloud API (obtener en developers.facebook.com)
WHATSAPP_API_TOKEN=your-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-id
WHATSAPP_BUSINESS_ACCOUNT_ID=your-account-id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your-verify-token

# Email (SES por defecto)
EMAIL_PROVIDER=ses  # ses | sendgrid | resend
EMAIL_FROM_ADDRESS=notificaciones@tudominio.com
EMAIL_FROM_NAME=Tu Negocio

# AWS (para SES)
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1

# Cron
CRON_SECRET_TOKEN=your-cron-token
```

### Plantillas de WhatsApp

Las plantillas deben ser creadas y aprobadas en [Meta Business Suite](https://business.facebook.com/latest/whatsapp_manager/message_templates):

1. **appointment_reminder** (utility)
   - Variables: nombre, servicio, fecha, hora, negocio
   
2. **appointment_confirmed** (utility)
   - Variables: nombre, servicio, fecha, hora, negocio

3. **appointment_status_change** (utility)
   - Variables: nombre, servicio, fecha, estado

4. **inactivity_reminder** (marketing)
   - Variables: nombre, negocio

5. **massive_campaign** (marketing)
   - Variables: mensaje personalizable

## Uso

### Enviar Recordatorio de Turno

```typescript
import { getNotificationService } from '@/lib/notifications';

const service = getNotificationService();
const result = await service.sendAppointmentReminder({
  id: 'apt-123',
  storeId: 'store-456',
  storeName: 'Mi Negocio',
  clientId: 'client-789',
  clientName: 'Juan Pérez',
  clientPhone: '+54 11 1234-5678',
  clientEmail: 'juan@example.com',
  serviceName: 'Corte de pelo',
  servicePrice: 5000,
  date: '2024-03-15',
  time: '10:00',
  status: 'confirmed',
});

if (result.success) {
  console.log('Enviado:', result.messageId);
} else {
  console.error('Error:', result.error);
}
```

### Crear Campaña Masiva

```typescript
import { getNotificationScheduler } from '@/lib/notifications/scheduler';

const scheduler = getNotificationScheduler();

// Por etiquetas
const campaignId = await scheduler.scheduleMassiveCampaign({
  storeId: 'store-456',
  name: 'Promo Verano',
  message: '¡Aprovechá nuestras promos de verano! Te esperamos.',
  channel: 'whatsapp',
  filters: {
    tagIds: ['tag-vip', 'tag-frecuente'],
  },
  scheduledFor: new Date('2024-12-20T10:00:00'),
});

// Por inactividad
const inactivityCampaign = await scheduler.scheduleMassiveCampaign({
  storeId: 'store-456',
  name: 'Reactivación',
  message: 'Hace tiempo que no te vemos, ¿agendamos un turno?',
  channel: 'whatsapp',
  filters: {
    inactiveDays: 30,
  },
});
```

### Segmentación de Clientes

```typescript
import { getSegmentationService } from '@/lib/notifications/segmentation';

const segmentation = getSegmentationService();

// Clientes con etiqueta específica
const vipClients = await segmentation.getClientsByTag('store-456', 'tag-vip');

// Clientes inactivos
const inactiveClients = await segmentation.getInactiveClients('store-456', 30);

// Filtro combinado
const targetClients = await segmentation.getClients({
  storeId: 'store-456',
  tagIds: ['tag-local'],
  inactiveDays: 15,
  hasPhone: true,
  isActive: true,
});
```

## API Endpoints

### POST /api/notifications/send
Envío manual de notificación individual.

```json
{
  "type": "appointment_reminder",
  "appointment_id": "apt-123"
}
```

### POST /api/notifications/campaigns
Crear/ejecutar campaña masiva.

```json
{
  "action": "preview",  // preview | execute | cancel
  "store_id": "store-456",
  "name": "Mi Campaña",
  "message": "Texto del mensaje",
  "channel": "whatsapp",
  "filters": {
    "tagIds": ["tag-1"],
    "inactiveDays": 30
  }
}
```

### GET /api/notifications/metrics
Métricas de notificaciones.

```
/api/notifications/metrics?store_id=store-456&start_date=2024-01-01
```

### GET /api/notifications/cron
Procesar jobs programados (llamar con cron cada 5 min).

```
Authorization: Bearer {CRON_SECRET_TOKEN}
```

## Webhook de WhatsApp

Configurar en Meta Business Suite:
- **URL**: `https://tu-dominio.com/api/webhooks/whatsapp`
- **Verify Token**: El mismo que `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- **Campos**: `messages` (para estados)

El webhook procesa:
- Actualizaciones de estado (sent → delivered → read)
- Mensajes entrantes (para comandos como "CANCELAR", "CONFIRMAR")

## Base de Datos

### Tablas Nuevas

- `notification_logs`: Historial de todas las notificaciones
- `client_notification_preferences`: Opt-in/opt-out por cliente
- `notification_campaigns`: Campañas masivas
- `scheduled_notification_jobs`: Jobs programados

### Funciones Útiles

```sql
-- Métricas de una tienda
SELECT * FROM get_notification_metrics('store-id', '2024-01-01', '2024-12-31');

-- Clientes inactivos
SELECT * FROM get_inactive_clients('store-id', 30, 100);
```

## Pruebas

### Ejecutar Tests

```bash
npm run test
```

### Tests Incluidos

- `whatsapp.test.ts`: Cliente de WhatsApp
- `email.test.ts`: Adapter de email
- `segmentation.test.ts`: Lógica de segmentación

### Prueba Manual

1. Configurar variables de entorno
2. Crear plantillas en Meta Business Suite
3. Enviar notificación de prueba:
   ```bash
   curl -X POST http://localhost:4321/api/notifications/send \
     -H "Content-Type: application/json" \
     -d '{"type": "appointment_reminder", "appointment_id": "YOUR_APT_ID"}'
   ```

## Consideraciones

### Opt-in/Opt-out
- Los clientes pueden responder "STOP" o "CANCELAR" por WhatsApp
- Se guarda en `client_notification_preferences`
- Respetar para cumplir con políticas de Meta

### Rate Limits
- WhatsApp: 80 msg/seg (tier inicial), 1000 destinatarios/día
- Aumenta con quality rating positivo

### Costos
- Las tarifas pueden cambiar trimestralmente
- Actualizar `WHATSAPP_PRICING` en `config/notifications.ts`
- Monitorear costos reales en Meta Business Suite

### Fallback
- Si WhatsApp falla, se intenta email automáticamente
- Loguear todos los intentos para debugging



