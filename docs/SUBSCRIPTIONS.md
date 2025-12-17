# Sistema de Suscripciones - Tiendita

## Índice
1. [Configuración](#configuración)
2. [Variables de Entorno](#variables-de-entorno)
3. [Ejecutar Migraciones](#ejecutar-migraciones)
4. [Configurar Mercado Pago](#configurar-mercado-pago)
5. [Uso en el Código](#uso-en-el-código)
6. [API Endpoints](#api-endpoints)
7. [Cron Jobs](#cron-jobs)
8. [Pruebas](#pruebas)

---

## Configuración

### Variables de Entorno

Agregá estas variables a tu archivo `.env`:

```env
# Mercado Pago (REQUERIDO)
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MERCADOPAGO_PUBLIC_KEY=APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# URL del sitio (para callbacks)
PUBLIC_SITE_URL=https://tudominio.com

# Cron Job Secret (para proteger el endpoint)
CRON_SECRET=tu-token-secreto-aleatorio

# (Opcional) IDs de planes pre-creados en MP
# MP_PLAN_ID_PREMIUM=2c938xxxxx
# MP_PLAN_ID_PREMIUM_ANNUAL=2c938xxxxx
```

### Obtener Credenciales de Mercado Pago

1. Ir a [Mercado Pago Developers](https://www.mercadopago.com.ar/developers)
2. Crear una aplicación o seleccionar existente
3. En "Credenciales de producción", copiar:
   - `Access Token` → `MERCADOPAGO_ACCESS_TOKEN`
   - `Public Key` → `MERCADOPAGO_PUBLIC_KEY`

---

## Ejecutar Migraciones

### Opción 1: Ejecutar desde Supabase Dashboard

1. Ir a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Ir a **SQL Editor**
3. Copiar y pegar el contenido de `supabase/migrations/20240215_create_subscriptions.sql`
4. Ejecutar

### Opción 2: Usando Supabase CLI

```bash
# Si tenés Supabase CLI instalado
supabase db push

# O específicamente esta migración
supabase db execute -f supabase/migrations/20240215_create_subscriptions.sql
```

---

## Configurar Mercado Pago

### 1. Configurar Webhook

En tu panel de Mercado Pago Developers:

1. Ir a **Webhooks** → **Configurar notificaciones**
2. URL de producción: `https://tudominio.com/api/subscriptions/webhook`
3. Eventos a escuchar:
   - `subscription_preapproval` - Cambios en suscripciones
   - `subscription_authorized_payment` - Pagos de suscripción
   - `payment` - Pagos genéricos

### 2. URLs de Callback

Las URLs de callback se configuran automáticamente en el código:
- Callback URL: `{PUBLIC_SITE_URL}/dashboard/subscription/callback`
- Back URL: `{PUBLIC_SITE_URL}/dashboard/subscription?status=callback`

---

## Uso en el Código

### Verificar si un usuario tiene acceso premium

```typescript
import { hasActivePremium, canAccessFeature } from '../lib/subscription';

// En tu componente o API
const subscription = await getSubscription(storeId);

// Verificar acceso premium general
if (hasActivePremium(subscription)) {
  // Mostrar features premium
}

// Verificar feature específica
const check = canAccessFeature(subscription, 'clients_management');
if (check.allowed) {
  // Mostrar gestión de clientes
} else {
  // Mostrar paywall
}
```

### Verificar límites antes de crear recursos

```typescript
import { checkProductsLimit, checkServicesLimit } from '../lib/subscription';

// Antes de crear un producto
const productsCheck = checkProductsLimit(subscription, currentProductCount);
if (!productsCheck.allowed) {
  throw new Error(productsCheck.message);
}

// Antes de crear un servicio
const servicesCheck = checkServicesLimit(subscription, currentServiceCount);
if (!servicesCheck.allowed) {
  throw new Error(servicesCheck.message);
}
```

### Mostrar Paywall en UI

```tsx
import { PremiumPaywall } from '../components/dashboard/PremiumPaywall';

// En tu componente React
function ClientsPage({ storeId, isPremium }) {
  if (!isPremium) {
    return <PremiumPaywall feature="clients_management" storeId={storeId} />;
  }
  
  return <ClientsList />;
}
```

### Mostrar Banner de Trial

```tsx
import { TrialBanner } from '../components/dashboard/TrialBanner';

// En el layout del dashboard
function DashboardLayout({ subscription, storeId, children }) {
  const trialDays = getTrialDaysRemaining(subscription);
  
  return (
    <div>
      {trialDays > 0 && (
        <TrialBanner daysRemaining={trialDays} storeId={storeId} />
      )}
      {children}
    </div>
  );
}
```

---

## API Endpoints

### POST `/api/subscriptions/create`
Crea una suscripción y devuelve URL de checkout de Mercado Pago.

**Request:**
```json
{
  "storeId": "uuid-de-la-tienda",
  "planId": "premium" // o "premium_annual"
}
```

**Response:**
```json
{
  "success": true,
  "checkoutUrl": "https://www.mercadopago.com.ar/checkout/...",
  "subscriptionId": "2c938xxxxx"
}
```

### POST `/api/subscriptions/cancel`
Cancela la suscripción del usuario.

**Request:**
```json
{
  "storeId": "uuid-de-la-tienda",
  "reason": "Motivo opcional"
}
```

### GET `/api/subscriptions/status?storeId=xxx`
Obtiene el estado actual de la suscripción.

**Response:**
```json
{
  "subscription": { ... },
  "summary": {
    "planId": "premium",
    "planName": "Premium",
    "isPremium": true,
    "isTrialActive": false,
    "trialDaysRemaining": 0,
    "status": "active",
    "limits": { ... }
  },
  "recentPayments": [ ... ]
}
```

### POST `/api/subscriptions/webhook`
Recibe notificaciones de Mercado Pago (no llamar manualmente).

### GET `/api/subscriptions/cron`
Procesa expiraciones y envía recordatorios. Protegido por token.

**Headers:**
```
Authorization: Bearer {CRON_SECRET}
```

### GET `/api/subscriptions/metrics`
Obtiene métricas de suscripciones (admin).

---

## Cron Jobs

### Configurar Cron Externo

El endpoint `/api/subscriptions/cron` debe ejecutarse periódicamente para:
- Expirar trials vencidos
- Downgrade de suscripciones con pago fallido
- Enviar recordatorios de trial

**Frecuencia recomendada:** Cada hora o diariamente

### Ejemplos de configuración:

#### Vercel Cron (vercel.json)
```json
{
  "crons": [{
    "path": "/api/subscriptions/cron",
    "schedule": "0 * * * *"
  }]
}
```

#### GitHub Actions
```yaml
name: Subscription Cron
on:
  schedule:
    - cron: '0 * * * *'
jobs:
  cron:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X GET "${{ secrets.SITE_URL }}/api/subscriptions/cron" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

#### cron-job.org o EasyCron
```
URL: https://tudominio.com/api/subscriptions/cron
Method: GET
Headers: Authorization: Bearer {tu-cron-secret}
Schedule: Every hour
```

---

## Pruebas

### Probar el Flujo Completo

1. **Crear una tienda nueva** - Se crea automáticamente con trial de 14 días
2. **Ir a `/dashboard/subscription`** - Ver el panel de suscripción
3. **Hacer clic en "Actualizar a Premium"** - Redirige a checkout de MP
4. **Completar pago** (usar [tarjetas de prueba](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/test/cards))
5. **Verificar callback** - Debe redirigir de vuelta y mostrar suscripción activa

### Tarjetas de Prueba (Sandbox)

| Tarjeta | Número | CVV | Vencimiento |
|---------|--------|-----|-------------|
| Mastercard (aprobado) | 5031 7557 3453 0604 | 123 | 11/25 |
| Visa (aprobado) | 4509 9535 6623 3704 | 123 | 11/25 |
| Mastercard (rechazado) | 5031 7557 3453 0604 | 123 | 11/25 |

**DNI de prueba:** 12345678

### Probar Webhook Localmente

Usar [ngrok](https://ngrok.com/) para exponer tu localhost:

```bash
ngrok http 4321

# Configurar la URL de ngrok en MP:
# https://xxxxx.ngrok.io/api/subscriptions/webhook
```

---

## Planes y Precios

Los planes están definidos en `src/lib/subscription/plans.ts`:

| Plan | Precio Mensual | Trial | Límites |
|------|---------------|-------|---------|
| Free | $0 | - | 5 productos, 1 servicio, 30 turnos/mes |
| Trial | $0 | 14 días | Ilimitado (igual que Premium) |
| Premium | $4.990 | 14 días | Ilimitado |
| Premium Anual | $49.900/año | - | Ilimitado + 2 meses gratis |

### Modificar Precios

Editar `src/lib/subscription/plans.ts`:

```typescript
export const PRICING = {
  PREMIUM_MONTHLY: 4990,      // Cambiar precio mensual
  PREMIUM_ANNUAL: 49900,      // Cambiar precio anual
  TRIAL_DAYS: 14,             // Cambiar días de trial
  GRACE_PERIOD_DAYS: 3,       // Días de gracia para pagos fallidos
};
```

---

## Features Premium

Las features premium están bloqueadas para el plan Free:

| Feature | Código | Plan Free | Premium |
|---------|--------|-----------|---------|
| Gestión de Clientes | `clients_management` | ❌ | ✅ |
| Notificaciones | `notifications` | ❌ | ✅ |
| Múltiples Servicios | `multiple_services` | ❌ | ✅ |
| Productos Ilimitados | `unlimited_products` | ❌ | ✅ |
| Estadísticas Avanzadas | `advanced_stats` | ❌ | ✅ |
| Soporte Prioritario | `priority_support` | ❌ | ✅ |
| Personalización | `custom_branding` | ❌ | ✅ |
| Exportar Datos | `export_data` | ❌ | ✅ |

---

## Troubleshooting

### "Error al crear suscripción"
- Verificar que `MERCADOPAGO_ACCESS_TOKEN` esté configurado
- Verificar que el usuario tenga email verificado

### "Webhook no recibe notificaciones"
- Verificar URL del webhook en panel de MP
- Verificar que el endpoint responda 200 OK
- Revisar logs del servidor

### "Trial no expira"
- Verificar que el cron job esté configurado y corriendo
- Ejecutar manualmente: `GET /api/subscriptions/cron` con el token

### "Límites no se aplican"
- Verificar que la migración se ejecutó correctamente
- Los triggers en la DB validan los límites automáticamente

---

## Soporte

Para problemas con la integración de Mercado Pago:
- [Documentación oficial](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/landing)
- [Comunidad de desarrolladores](https://www.mercadopago.com.ar/developers/es/support)






