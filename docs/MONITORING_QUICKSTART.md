# Setup Rápido de Monitoreo (20 minutos)

## 🎯 Objetivo

Configurar monitoreo básico completo en 20 minutos:
- ✅ Uptime monitoring
- ✅ Error tracking
- ✅ Health checks
- ✅ Alertas básicas

---

## ⚡ Setup Paso a Paso

### Paso 1: UptimeRobot (5 minutos)

1. **Crear cuenta:**
   - Ir a [uptimerobot.com](https://uptimerobot.com)
   - Registrarse (gratis)

2. **Agregar Monitor Principal:**
   - Click en "Add New Monitor"
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** Tiendita - Homepage
   - **URL:** `https://tudominio.com`
   - **Monitoring Interval:** 5 minutes
   - **Alert Contacts:** Tu email
   - Click "Create Monitor"

3. **Agregar Monitor de Health Check:**
   - Click en "Add New Monitor"
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** Tiendita - Health Check
   - **URL:** `https://tudominio.com/api/health`
   - **Monitoring Interval:** 5 minutes
   - **Alert Contacts:** Tu email
   - Click "Create Monitor"

4. **Agregar Monitor SSL:**
   - Click en "Add New Monitor"
   - **Monitor Type:** SSL Certificate
   - **Friendly Name:** Tiendita - SSL
   - **URL:** `https://tudominio.com`
   - **Alert Contacts:** Tu email
   - Click "Create Monitor"

**✅ Listo:** Ya tienes monitoreo de uptime básico

---

### Paso 2: Sentry Error Tracking (10 minutos)

1. **Crear cuenta:**
   - Ir a [sentry.io](https://sentry.io)
   - Registrarse (plan Developer es gratis)

2. **Crear Proyecto:**
   - Click en "Create Project"
   - **Platform:** Astro
   - **Project Name:** tiendita
   - Click "Create Project"

3. **Instalar SDK:**
   ```bash
   npm install @sentry/astro @sentry/react
   ```

4. **Configurar Sentry:**

   **Crear `sentry.client.config.ts`:**
   ```typescript
   import * as Sentry from "@sentry/astro";

   Sentry.init({
     dsn: import.meta.env.PUBLIC_SENTRY_DSN,
     integrations: [
       Sentry.browserTracingIntegration(),
       Sentry.replayIntegration(),
     ],
     tracesSampleRate: 0.1,
     replaysSessionSampleRate: 0.1,
     replaysOnErrorSampleRate: 1.0,
     environment: import.meta.env.MODE,
   });
   ```

   **Actualizar `astro.config.mjs`:**
   ```javascript
   import { sentry } from "@sentry/astro";

   export default defineConfig({
     integrations: [
       tailwind(),
       react(),
       sentry({
         dsn: import.meta.env.PUBLIC_SENTRY_DSN,
       }),
     ],
   });
   ```

5. **Agregar Variable de Entorno:**
   - Copiar DSN de Sentry
   - Agregar a `.env.production`:
     ```env
     PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
     ```

6. **Probar:**
   - Agregar error de prueba en algún componente
   - Verificar que aparece en Sentry

**✅ Listo:** Error tracking activo

---

### Paso 3: Health Check Endpoint (Ya creado)

El endpoint `/api/health` ya está creado. Solo verifica que funciona:

```bash
curl https://tudominio.com/api/health
```

Deberías ver:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-06T...",
  "checks": {
    "database": { "status": true, "latency": 45 },
    "environment": { "status": true },
    "application": { "status": true, "latency": 50 }
  },
  "latency": 50
}
```

---

### Paso 4: Script de Monitoreo Local (Ya creado)

**Linux/Mac:**
```bash
chmod +x scripts/monitor.sh
bash scripts/monitor.sh
```

**Windows:**
```powershell
.\scripts\monitor.ps1
```

---

## 📊 Dashboard Recomendado

### UptimeRobot Dashboard:
1. Ir a "My Settings" → "Public Status Pages"
2. Crear status page público
3. Compartir URL con usuarios (opcional)

### Sentry Dashboard:
- Ya está disponible automáticamente
- Ver errores en tiempo real
- Filtrar por tipo, usuario, fecha

---

## 🚨 Configurar Alertas

### UptimeRobot:
1. Ir a "Alert Contacts"
2. Agregar:
   - Email (ya configurado)
   - Telegram (opcional):
     - Crear bot con [@BotFather](https://t.me/botfather)
     - Obtener token
     - Agregar como contacto en UptimeRobot

### Sentry:
1. Project Settings → Alerts
2. Crear alerta:
   - **Name:** Critical Errors
   - **Conditions:** When an issue is created
   - **Actions:** Send email notification
   - Click "Save"

---

## ✅ Checklist de Verificación

- [ ] UptimeRobot monitoreando homepage
- [ ] UptimeRobot monitoreando health check
- [ ] UptimeRobot monitoreando SSL
- [ ] Sentry instalado y configurado
- [ ] Health check endpoint funcionando
- [ ] Alertas de email configuradas
- [ ] Script de monitoreo local funcionando

---

## 🎓 Próximos Pasos (Opcional)

1. **Telegram Bot para Alertas:**
   - Más rápido que email
   - Notificaciones push
   - Ver guía en `docs/TELEGRAM_ALERTS.md` (crear si necesitas)

2. **Grafana para Métricas:**
   - Dashboards avanzados
   - Métricas históricas
   - Más complejo de setup

3. **Log Aggregation:**
   - Centralizar logs
   - Búsqueda avanzada
   - Usar Logtail o similar

---

## 💰 Costos

**Gratis:**
- ✅ UptimeRobot (50 monitores, 5 min intervalo)
- ✅ Sentry (5,000 errores/mes)
- ✅ Health check endpoint
- ✅ Scripts de monitoreo

**Total: $0/mes** para monitoreo básico completo

---

## 📞 Soporte

Si algo no funciona:
1. Verificar logs: `docker compose logs app`
2. Verificar health check: `curl https://tudominio.com/api/health`
3. Verificar variables de entorno
4. Revisar documentación de cada servicio
