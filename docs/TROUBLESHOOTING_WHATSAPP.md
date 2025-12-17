# Troubleshooting - WhatsApp Notificaciones

## Checklist de Problemas Comunes

### 1. Verificar Configuración

Usa el endpoint de debug para verificar que todo esté configurado:

```
GET /api/notifications/debug
```

Esto te mostrará:
- Si las variables de entorno están configuradas
- Estado de la configuración
- Variables parciales (sin exponer tokens completos)

### 2. Probar con un Turno Existente

```
GET /api/notifications/debug?appointment_id=TU_APPOINTMENT_ID
```

Esto enviará un mensaje real usando los datos del turno.

### 3. Verificar Variables de Entorno

Asegúrate de tener estas variables en tu `.env`:

```env
WHATSAPP_API_TOKEN=tu-token-aqui
WHATSAPP_PHONE_NUMBER_ID=tu-phone-number-id
WHATSAPP_BUSINESS_ACCOUNT_ID=tu-business-account-id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=tu-verify-token
```

### 4. Verificar Template en Meta Business Suite

El template debe estar:
- ✅ **Aprobado** (status: APPROVED)
- ✅ **Nombre exacto**: `appointment_reminder`
- ✅ **Categoría**: `Utility`
- ✅ **Idioma**: `es_AR` o `Spanish (Argentina)`
- ✅ **Variables correctas**: 5 variables en el body ({{1}} a {{5}})
- ✅ **Botón URL** (opcional): Si lo tienes, debe tener `https://tu-dominio.com/appointment/{{1}}`

### 5. Verificar Formato del Teléfono

El código formatea automáticamente números argentinos:
- `011 1234-5678` → `5491112345678`
- `+54 11 1234-5678` → `5491112345678`
- `541112345678` → `5491112345678`

Para probar el formateo:
```
GET /api/notifications/debug?phone=01112345678
```

### 6. Errores Comunes de la API

#### Error 100: Invalid parameter
- **Causa**: El template no existe o el nombre no coincide
- **Solución**: Verifica que el template esté aprobado y se llame exactamente `appointment_reminder`

#### Error 131047: Message template does not exist
- **Causa**: El template no existe en la cuenta de WhatsApp Business
- **Solución**: Crea el template en Meta Business Suite

#### Error 131026: Parameter value mismatch
- **Causa**: El número de variables no coincide con el template
- **Solución**: Verifica que el template tenga exactamente 5 variables ({{1}} a {{5}})

#### Error 131051: Template parameter type mismatch
- **Causa**: El tipo de variable no coincide (ej: espera fecha pero envias texto)
- **Solución**: Verifica que las variables del body sean todas tipo `text`

#### Error 130429: Rate limit exceeded
- **Causa**: Demasiados mensajes en poco tiempo
- **Solución**: Espera unos minutos o verifica tus límites de rate

#### Error 130472: Recipient phone number not registered
- **Causa**: El número no tiene WhatsApp o no aceptó recibir mensajes del negocio
- **Solución**: El usuario debe tener WhatsApp activo y haber iniciado una conversación contigo antes

### 7. Verificar Logs en Consola

El código ahora loguea más información. Busca en la consola del servidor:

```
[WhatsApp] Sending message to: https://graph.facebook.com/...
[WhatsApp] Request body: {...}
[WhatsApp] Response status: 200
```

Si hay errores:
```
[WhatsApp] API Error: { code: ..., message: ..., ... }
```

### 8. Probar Envío Manual

Puedes probar enviar un mensaje manualmente usando la API:

```bash
curl -X POST http://localhost:4321/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "type": "appointment_reminder",
    "appointment_id": "TU_APPOINTMENT_ID"
  }'
```

### 9. Verificar Webhook (Opcional)

Si quieres recibir actualizaciones de estado, verifica que el webhook esté configurado:

1. En Meta Business Suite → Configuración → Webhooks
2. URL: `https://tu-dominio.com/api/webhooks/whatsapp`
3. Verify token: El mismo que `WHATSAPP_WEBHOOK_VERIFY_TOKEN`

### 10. Números de Prueba

Para desarrollo, puedes usar números de prueba de Meta:
- Configúralos en Meta Business Suite → Configuración → Números de prueba
- Solo funcionan en modo sandbox/test

## Comandos Útiles

### Verificar configuración
```bash
curl http://localhost:4321/api/notifications/debug
```

### Probar formateo de teléfono
```bash
curl "http://localhost:4321/api/notifications/debug?phone=01112345678"
```

### Enviar notificación de prueba
```bash
curl "http://localhost:4321/api/notifications/debug?appointment_id=TU_ID"
```

### Enviar manualmente
```bash
curl -X POST http://localhost:4321/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{"type": "appointment_reminder", "appointment_id": "TU_ID"}'
```

## Próximos Pasos

Si después de verificar todo lo anterior sigue sin funcionar:

1. Revisa los logs del servidor para ver el error exacto
2. Verifica que el template esté aprobado (no solo creado)
3. Prueba con un número de teléfono que sepas que tiene WhatsApp activo
4. Asegúrate de que el número de teléfono esté registrado en WhatsApp Business (el usuario debe haber iniciado una conversación contigo antes)

