# Guía de Monitoreo y Observabilidad

## 🎯 Qué Monitorear

### 1. **Uptime / Disponibilidad**
- ¿Está la aplicación online?
- Tiempo de respuesta
- Downtime histórico

### 2. **Errores y Excepciones**
- Errores de JavaScript en el frontend
- Errores de API en el backend
- Errores de base de datos
- Stack traces completos

### 3. **Performance**
- Tiempo de carga de páginas
- Tiempo de respuesta de APIs
- Uso de recursos (CPU, memoria, disco)

### 4. **Logs Centralizados**
- Logs de aplicación
- Logs de nginx
- Logs de Docker
- Logs de errores

### 5. **Métricas de Negocio**
- Turnos creados
- Notificaciones enviadas
- Errores por tipo
- Usuarios activos

---

## 🛠️ Soluciones Recomendadas

### Opción 1: Stack Gratuito (Recomendado para empezar)

#### **Uptime Monitoring: UptimeRobot** (Gratis)
- ✅ Monitoreo cada 5 minutos (gratis)
- ✅ Alertas por email/SMS/Telegram
- ✅ Historial de uptime
- ✅ Monitoreo de SSL
- ✅ Dashboard público opcional

**Setup:**
1. Crear cuenta en [uptimerobot.com](https://uptimerobot.com)
2. Agregar monitor:
   - Tipo: HTTP(s)
   - URL: `https://tudominio.com`
   - Intervalo: 5 minutos
   - Alertas: Email + Telegram

#### **Error Tracking: Sentry** (Plan gratuito generoso)
- ✅ 5,000 errores/mes gratis
- ✅ Stack traces completos
- ✅ Contexto de usuario
- ✅ Alertas por email/Slack
- ✅ Integración con GitHub

**Setup:**
```bash
npm install @sentry/astro @sentry/react
```

#### **Logs: Docker Logs + Grep** (Básico)
- Ver logs en tiempo real:
  ```bash
  docker compose logs -f app
  docker compose logs -f nginx
  ```

#### **Métricas: Prometheus + Grafana** (Auto-hospedado)
- ✅ Gratis
- ✅ Métricas de Docker
- ✅ Dashboards personalizables
- ⚠️ Requiere configuración

---

### Opción 2: Stack Profesional (Pago)

#### **Uptime: Better Uptime** ($10/mes)
- Monitoreo cada 30 segundos
- Status pages públicos
- Alertas avanzadas

#### **Errors: Sentry** ($26/mes)
- Más errores/mes
- Performance monitoring
- Session replay

#### **Logs: Logtail / Datadog** ($20-50/mes)
- Logs centralizados
- Búsqueda avanzada
- Alertas inteligentes

#### **APM: New Relic / Datadog** ($100+/mes)
- Performance completo
- Trazado distribuido
- Análisis profundo

---

## 🚀 Implementación Recomendada (Gratis)

### 1. Uptime Monitoring con UptimeRobot

**Pasos:**

1. **Crear cuenta** en [uptimerobot.com](https://uptimerobot.com)

2. **Agregar Monitores:**
   - **Homepage:**
     - URL: `https://tudominio.com`
     - Tipo: HTTP(s)
     - Intervalo: 5 minutos
   
   - **API Health:**
     - URL: `https://tudominio.com/api/health` (crear endpoint)
     - Tipo: HTTP(s)
     - Intervalo: 5 minutos
   
   - **SSL Certificate:**
     - URL: `https://tudominio.com`
     - Tipo: SSL Certificate
     - Alerta si expira en menos de 30 días

3. **Configurar Alertas:**
   - Email: Tu email
   - Telegram: Bot de Telegram (opcional)
   - SMS: Para críticos (opcional, pago)

4. **Dashboard Público (Opcional):**
   - Crear status page público
   - Compartir con usuarios

---

### 2. Error Tracking con Sentry

#### Instalación:

```bash
npm install @sentry/astro @sentry/react
```

#### Configuración:

**`sentry.client.config.ts`:**
```typescript
import * as Sentry from "@sentry/astro";

Sentry.init({
  dsn: import.meta.env.PUBLIC_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 0.1, // 10% de transacciones
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  environment: import.meta.env.MODE,
});
```

**`astro.config.mjs`:**
```javascript
import { sentry } from "@sentry/astro";

export default defineConfig({
  integrations: [
    sentry({
      dsn: import.meta.env.PUBLIC_SENTRY_DSN,
    }),
  ],
});
```

**Variables de entorno:**
```env
PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

#### Capturar Errores Manualmente:

```typescript
import * as Sentry from "@sentry/astro";

try {
  // código
} catch (error) {
  Sentry.captureException(error, {
    tags: { section: 'appointments' },
    extra: { userId, storeId },
  });
}
```

---

### 3. Health Check Endpoint

Crear endpoint para monitoreo:

**`src/pages/api/health.ts`:**
```typescript
import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export const GET: APIRoute = async () => {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {} as Record<string, boolean>,
  };

  // Check database
  try {
    const { error } = await supabase.from('stores').select('id').limit(1);
    checks.checks.database = !error;
  } catch {
    checks.checks.database = false;
  }

  // Check environment
  checks.checks.env = !!(
    import.meta.env.PUBLIC_SUPABASE_URL &&
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY
  );

  const allHealthy = Object.values(checks.checks).every(v => v);

  return new Response(JSON.stringify(checks), {
    status: allHealthy ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

Monitorear: `https://tudominio.com/api/health`

---

### 4. Logs Centralizados (Básico)

#### Ver Logs en Tiempo Real:

```bash
# Logs de la aplicación
docker compose logs -f app

# Logs de nginx
docker compose logs -f nginx

# Logs de ambos
docker compose logs -f

# Últimas 100 líneas
docker compose logs --tail=100 app

# Filtrar errores
docker compose logs app | grep -i error
```

#### Guardar Logs:

```bash
# Exportar logs a archivo
docker compose logs app > app-$(date +%Y%m%d).log
docker compose logs nginx > nginx-$(date +%Y%m%d).log
```

#### Rotación de Logs (Docker):

Agregar a `docker-compose.yml`:
```yaml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

### 5. Métricas Básicas con Scripts

**`scripts/monitor.sh`:**
```bash
#!/bin/bash

# Verificar estado de contenedores
echo "=== Estado de Contenedores ==="
docker compose ps

# Verificar uso de recursos
echo -e "\n=== Uso de Recursos ==="
docker stats --no-stream

# Verificar espacio en disco
echo -e "\n=== Espacio en Disco ==="
df -h

# Verificar últimos errores
echo -e "\n=== Últimos Errores (últimas 20 líneas) ==="
docker compose logs --tail=20 app | grep -i error
```

Ejecutar: `bash scripts/monitor.sh`

---

## 📊 Dashboard de Monitoreo

### Opción 1: UptimeRobot Status Page (Gratis)
- Dashboard público
- Historial de uptime
- Incidentes públicos

### Opción 2: Grafana (Auto-hospedado)
- Dashboards personalizables
- Métricas de Docker
- Alertas avanzadas

### Opción 3: Datadog (Pago)
- Todo-en-uno
- Muy completo
- Caro ($100+/mes)

---

## 🚨 Alertas Recomendadas

### Críticas (Inmediatas):
- ✅ Aplicación caída (UptimeRobot)
- ✅ SSL expirando (UptimeRobot)
- ✅ Errores críticos (Sentry)
- ✅ Contenedor caído (Docker healthcheck)

### Importantes (Diarias):
- ⚠️ Alto número de errores (Sentry)
- ⚠️ Performance degradado
- ⚠️ Uso alto de recursos

### Informativas (Semanales):
- 📊 Reporte semanal de métricas
- 📊 Uptime del mes
- 📊 Errores más comunes

---

## 🔧 Configuración de Alertas

### UptimeRobot:
1. Ir a "Alert Contacts"
2. Agregar:
   - Email
   - Telegram (opcional)
3. Configurar en cada monitor

### Sentry:
1. Project Settings → Alerts
2. Crear alerta:
   - Trigger: "Issues" → "New Issue"
   - Condición: Cualquier error
   - Acción: Email/Slack

### Telegram Bot (Opcional):

1. Crear bot con [@BotFather](https://t.me/botfather)
2. Obtener token
3. Configurar en UptimeRobot o crear script propio

---

## 📈 Métricas Clave a Monitorear

### Infraestructura:
- ✅ Uptime (%)
- ✅ Response time (ms)
- ✅ CPU usage (%)
- ✅ Memory usage (%)
- ✅ Disk usage (%)
- ✅ SSL certificate expiry

### Aplicación:
- ✅ Errores por minuto
- ✅ Requests por minuto
- ✅ Tiempo de respuesta promedio
- ✅ Tasa de error (%)
- ✅ Páginas más lentas

### Negocio:
- ✅ Turnos creados/hora
- ✅ Notificaciones enviadas/hora
- ✅ Usuarios activos
- ✅ Conversión (si aplica)

---

## 🎯 Setup Rápido (15 minutos)

### Paso 1: UptimeRobot (5 min)
1. Crear cuenta
2. Agregar monitor de homepage
3. Configurar alertas

### Paso 2: Sentry (10 min)
1. Crear cuenta en [sentry.io](https://sentry.io)
2. Crear proyecto (Astro)
3. Instalar SDK
4. Configurar variables de entorno
5. Probar con error de prueba

### Paso 3: Health Check (5 min)
1. Crear `/api/health`
2. Agregar monitor en UptimeRobot
3. Verificar que funciona

**Total: ~20 minutos para monitoreo básico completo**

---

## 🔍 Troubleshooting con Monitoreo

### Si la app está caída:
1. **UptimeRobot** → Ver último check
2. **Docker logs** → `docker compose logs app`
3. **Health check** → Ver qué componente falló
4. **Sentry** → Ver errores recientes

### Si hay muchos errores:
1. **Sentry** → Ver errores más frecuentes
2. **Filtrar por** tipo, usuario, sección
3. **Corregir** los más críticos primero
4. **Monitorear** tendencia después del fix

### Si es lento:
1. **UptimeRobot** → Ver response time histórico
2. **Docker stats** → Ver uso de recursos
3. **Sentry Performance** → Ver transacciones lentas
4. **Nginx logs** → Ver requests más pesados

---

## 📚 Recursos

- [UptimeRobot Docs](https://uptimerobot.com/api/)
- [Sentry Docs](https://docs.sentry.io/platforms/javascript/guides/astro/)
- [Docker Logging](https://docs.docker.com/config/containers/logging/)
- [Nginx Logging](https://nginx.org/en/docs/http/ngx_http_log_module.html)

---

## 💡 Próximos Pasos

1. ✅ Configurar UptimeRobot (hoy)
2. ✅ Instalar Sentry (esta semana)
3. ✅ Crear health check endpoint
4. ⏭️ Configurar alertas de Telegram (opcional)
5. ⏭️ Setup Grafana para métricas avanzadas (futuro)
