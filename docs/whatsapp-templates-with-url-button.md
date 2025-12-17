# Templates de WhatsApp con Botón de URL Dinámica

## Cómo funciona

En Meta Business Suite, cuando defines un botón de tipo URL, puedes pasar la URL completa como variable. El código construye la URL completa usando el dominio configurado en `PUBLIC_SITE_URL`.

- **URL que enviamos**: `https://tu-dominio.com/appointment/abc123xyz` (URL completa)
- **URL en el template**: Solo `{{1}}` (sin URL base)
- **URL final**: `https://tu-dominio.com/appointment/abc123xyz`

El código construye la URL completa automáticamente usando `PUBLIC_SITE_URL` + `/appointment/` + `public_token`.

---

## Template: appointment_reminder

### Configuración en Meta Business Suite

1. **Ir a**: WhatsApp Manager → Account Tools → Message templates → Create template

2. **Datos básicos**:
   - **Nombre**: `appointment_reminder`
   - **Categoría**: `Utility`
   - **Idioma**: `Spanish (Argentina)` o `es_AR`

3. **Cuerpo del mensaje**:
   ```
   Hola {{1}}, te recordamos tu turno de {{2}} para hoy {{3}} a las {{4}} en {{5}}. ¡Te esperamos!
   ```
   
   **Variables**:
   - `{{1}}` = Nombre del cliente
   - `{{2}}` = Servicio
   - `{{3}}` = Fecha (ej: "martes 12 de marzo")
   - `{{4}}` = Hora (ej: "10:00")
   - `{{5}}` = Nombre del negocio

4. **Botón con URL dinámica**:
   - **Tipo de botón**: `URL`
   - **Texto del botón**: `Ver turno` (máximo 25 caracteres)
   - **URL**: Solo `{{1}}` (sin URL base, solo la variable)
   
   **IMPORTANTE**: 
   - El template debe tener SOLO `{{1}}` en el campo URL del botón
   - NO incluyas la URL base en el template
   - El código construye la URL completa automáticamente: `https://tu-dominio.com/appointment/token`
   - La variable `{{1}}` será reemplazada por la URL completa que enviamos desde el código

5. **Ejemplo para revisión**:
   - Nombre: `Juan Pérez`
   - Servicio: `Corte de pelo`
   - Fecha: `martes 12 de marzo`
   - Hora: `10:00`
   - Negocio: `Mi Peluquería`
   - URL completa (para el botón): `https://tu-dominio.com/appointment/abc123xyz`

### Envío desde el código

El código automáticamente:
1. Obtiene el `public_token` del turno (ej: `abc123xyz`)
2. Construye la URL completa usando `PUBLIC_SITE_URL`: `https://tu-dominio.com/appointment/abc123xyz`
3. Pasa la URL completa como parámetro del botón en el componente `button` con `sub_type: 'url'`
4. WhatsApp reemplaza `{{1}}` con la URL completa
5. El botón aparecerá clickeable en el mensaje de WhatsApp

**Nota**: Asegúrate de tener configurada la variable de entorno `PUBLIC_SITE_URL` con tu dominio (ej: `https://tu-dominio.com`)

### Estructura del payload enviado

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "5491112345678",
  "type": "template",
  "template": {
    "name": "appointment_reminder",
    "language": {
      "code": "es_AR"
    },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Juan Pérez" },
          { "type": "text", "text": "Corte de pelo" },
          { "type": "text", "text": "martes 12 de marzo" },
          { "type": "text", "text": "10:00" },
          { "type": "text", "text": "Mi Peluquería" }
        ]
      },
          {
            "type": "button",
            "sub_type": "url",
            "index": 0,
            "parameters": [
              {
                "type": "text",
                "text": "https://tu-dominio.com/appointment/abc123xyz"
              }
            ]
          }
    ]
  }
}
```

### Notas importantes

    - El botón de URL solo funciona en templates de categoría **Utility** o **Marketing**
    - La URL debe ser HTTPS
    - El template debe tener solo `{{1}}` como URL (sin URL base)
    - El código construye la URL completa automáticamente
    - El texto del botón tiene un máximo de 25 caracteres
    - Solo puedes tener **1 botón de URL** por template (puedes combinar con quick_reply buttons)
    - Asegúrate de tener `PUBLIC_SITE_URL` configurada en las variables de entorno

### Verificación

Una vez aprobado el template, puedes probarlo enviando un mensaje de prueba. El botón debería aparecer clickeable y llevar al usuario a la URL del turno.

---

## Template: appointment_confirmed

### Configuración en Meta Business Suite

1. **Datos básicos**:
   - **Nombre**: `appointment_confirmed`
   - **Categoría**: `Utility`
   - **Idioma**: `Spanish (Argentina)` o `es_AR`

2. **Cuerpo del mensaje**:
   ```
   Hola {{1}}, tu turno de {{2}} fue confirmado para el {{3}} a las {{4}} en {{5}}. Gracias por elegirnos.
   ```
   
   **Variables**:
   - `{{1}}` = Nombre del cliente
   - `{{2}}` = Servicio
   - `{{3}}` = Fecha
   - `{{4}}` = Hora
   - `{{5}}` = Nombre del negocio

    3. **Botón con URL dinámica**:
       - **Tipo de botón**: `URL`
       - **Texto del botón**: `Ver turno`
       - **URL**: Solo `{{1}}` (sin URL base)

---

## Template: appointment_status_change

### Configuración en Meta Business Suite

1. **Datos básicos**:
   - **Nombre**: `appointment_status_change`
   - **Categoría**: `Utility`
   - **Idioma**: `Spanish (Argentina)` o `es_AR`

2. **Cuerpo del mensaje**:
   ```
   Hola {{1}}, tu turno de {{2}} del {{3}} cambió a estado: {{4}}. Si tenés dudas, contactanos.
   ```
   
   **Variables**:
   - `{{1}}` = Nombre del cliente
   - `{{2}}` = Servicio
   - `{{3}}` = Fecha
   - `{{4}}` = Estado (Confirmado/Cancelado/Pendiente)

    3. **Botón con URL dinámica**:
       - **Tipo de botón**: `URL`
       - **Texto del botón**: `Ver turno`
       - **URL**: Solo `{{1}}` (sin URL base)

---

    ## Notas importantes

    - **URL completa en el código**: El código construye la URL completa automáticamente usando `PUBLIC_SITE_URL`
    - **Template solo con variable**: El template debe tener solo `{{1}}` como URL, sin URL base
    - **Variable de entorno**: Asegúrate de tener `PUBLIC_SITE_URL` configurada (ej: `https://tu-dominio.com`)
    - **HTTPS requerido**: La URL debe ser HTTPS
    - **Máximo 1 botón URL**: Solo puedes tener 1 botón de tipo URL por template

