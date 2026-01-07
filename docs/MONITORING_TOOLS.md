# Herramientas de Monitoreo - Comparativa

## 🆓 Opciones Gratuitas

### Uptime Monitoring

| Herramienta | Plan Gratis | Intervalo | Alertas | Status Page |
|------------|-------------|------------|---------|-------------|
| **UptimeRobot** ⭐ | 50 monitores | 5 min | Email/SMS/Telegram | ✅ Público |
| Better Uptime | 10 monitores | 1 min | Email/Slack/Discord | ✅ Público |
| Uptime Kuma | Ilimitado | Configurable | Múltiples | ✅ Auto-hospedado |
| Pingdom | 1 monitor | 1 min | Email/SMS | ❌ |

**Recomendación:** UptimeRobot (más generoso)

---

### Error Tracking

| Herramienta | Plan Gratis | Errores/mes | Features |
|------------|-------------|-------------|----------|
| **Sentry** ⭐ | Developer | 5,000 | Stack traces, contexto, alertas |
| Rollbar | Starter | 5,000 | Similar a Sentry |
| Bugsnag | Hobby | 7,500 | Buen para mobile |
| LogRocket | Trial | 1,000 sesiones | Session replay |

**Recomendación:** Sentry (mejor integración con Astro)

---

### Logs Centralizados

| Herramienta | Plan Gratis | Retención | Búsqueda |
|------------|-------------|-----------|----------|
| **Logtail** | 7 días | 7 días | ✅ Avanzada |
| Axiom | 500MB/mes | 30 días | ✅ Muy rápida |
| Datadog | 3 días | 3 días | ✅ Completa |
| Grafana Loki | Ilimitado | Configurable | ✅ Auto-hospedado |

**Recomendación:** Logtail (fácil setup) o Grafana Loki (auto-hospedado)

---

### APM (Application Performance Monitoring)

| Herramienta | Plan Gratis | Métricas | Trazado |
|------------|-------------|----------|---------|
| **Grafana + Prometheus** | Ilimitado | ✅ Completo | ✅ Auto-hospedado |
| New Relic | 100GB/mes | ✅ Completo | ✅ |
| Datadog | 3 días | ✅ Completo | ✅ |
| Sentry Performance | Incluido | ✅ Básico | ✅ |

**Recomendación:** Grafana (gratis) o Sentry Performance (ya incluido)

---

## 💰 Opciones de Pago (si escalas)

### Todo-en-Uno

**Datadog** ($15-31/host/mes)
- ✅ Logs, métricas, APM, errores
- ✅ Muy completo
- ⚠️ Caro para proyectos pequeños

**New Relic** ($99/mes base)
- ✅ Similar a Datadog
- ✅ Muy completo
- ⚠️ Caro

**Sentry** ($26/mes)
- ✅ Errores + Performance
- ✅ Buen precio
- ⚠️ No incluye logs completos

---

## 🎯 Stack Recomendado por Escenario

### Escenario 1: Proyecto Pequeño (Gratis)
```
✅ UptimeRobot (uptime)
✅ Sentry (errores)
✅ Health Check endpoint (básico)
✅ Docker logs (logs básicos)
💰 Costo: $0/mes
```

### Escenario 2: Proyecto Mediano (Algunos Pagos)
```
✅ UptimeRobot (uptime)
✅ Sentry Pro ($26/mes) (errores + performance)
✅ Logtail ($20/mes) (logs centralizados)
✅ Health Check endpoint
💰 Costo: ~$46/mes
```

### Escenario 3: Proyecto Grande (Completo)
```
✅ Better Uptime ($10/mes) (uptime avanzado)
✅ Datadog ($100+/mes) (todo-en-uno)
✅ Status page público
💰 Costo: $100+/mes
```

---

## 🔧 Herramientas Adicionales Útiles

### Monitoreo de SSL
- **UptimeRobot** (incluido)
- **SSL Labs** (gratis, análisis profundo)

### Monitoreo de DNS
- **UptimeRobot** (incluido)
- **DNS Checker** (gratis)

### Análisis de Performance Web
- **Google PageSpeed Insights** (gratis)
- **WebPageTest** (gratis)
- **Lighthouse CI** (gratis, integrable)

### Monitoreo de Base de Datos
- **Supabase Dashboard** (incluido)
- **pgAdmin** (gratis, para PostgreSQL)

---

## 📊 Métricas Clave por Herramienta

### UptimeRobot:
- ✅ Uptime %
- ✅ Response time
- ✅ SSL expiry
- ✅ Historial de downtime

### Sentry:
- ✅ Errores por tipo
- ✅ Errores por usuario
- ✅ Stack traces
- ✅ Performance de transacciones
- ✅ Release tracking

### Health Check:
- ✅ Estado de servicios
- ✅ Latencia de DB
- ✅ Variables de entorno
- ✅ Response time

### Docker Logs:
- ✅ Logs de aplicación
- ✅ Logs de nginx
- ✅ Errores en tiempo real
- ✅ Historial limitado

---

## 🚀 Setup Recomendado Inicial

**Para empezar (Gratis):**
1. ✅ UptimeRobot (5 min)
2. ✅ Sentry (10 min)
3. ✅ Health Check (ya creado)
4. ✅ Scripts de monitoreo (ya creados)

**Total: 15 minutos, $0/mes**

**Cuando crezcas:**
- Agregar Logtail para logs centralizados
- Upgrade Sentry para más errores
- Considerar Grafana para métricas avanzadas

---

## 📚 Recursos

- [UptimeRobot API](https://uptimerobot.com/api/)
- [Sentry Astro Integration](https://docs.sentry.io/platforms/javascript/guides/astro/)
- [Grafana Getting Started](https://grafana.com/docs/grafana/latest/getting-started/)
- [Docker Logging Best Practices](https://docs.docker.com/config/containers/logging/)
