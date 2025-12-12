# Templates de WhatsApp con Botón de URL Dinámica

## Cómo funciona

En Meta Business Suite, cuando defines un botón de tipo URL, puedes incluir la URL base en el template y usar una variable para la parte dinámica. Por ejemplo:

- **URL en el template**: `https://tu-dominio.com/appointment/{{1}}`
- **Token que enviamos**: `abc123xyz`
- **URL final**: `https://tu-dominio.com/appointment/abc123xyz`

El código solo necesita pasar el token (la parte dinámica), no la URL completa.

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
   - **URL**: `https://tu-dominio.com/appointment/{{1}}` (reemplaza `tu-dominio.com` con tu dominio real)
   
   **IMPORTANTE**: 
   - La URL base (`https://tu-dominio.com/appointment/`) va en el template
   - La variable `{{1}}` será reemplazada por el token del turno que enviamos desde el código
   - Solo necesitas cambiar `tu-dominio.com` por tu dominio real

5. **Ejemplo para revisión**:
   - Nombre: `Juan Pérez`
   - Servicio: `Corte de pelo`
   - Fecha: `martes 12 de marzo`
   - Hora: `10:00`
   - Negocio: `Mi Peluquería`
   - Token (para el botón): `abc123xyz` (solo la parte dinámica)

### Envío desde el código

El código automáticamente:
1. Obtiene el `public_token` del turno (ej: `abc123xyz`)
2. Lo pasa como parámetro del botón en el componente `button` con `sub_type: 'url'`
3. WhatsApp combina la URL base del template con el token: `https://tu-dominio.com/appointment/abc123xyz`
4. El botón aparecerá clickeable en el mensaje de WhatsApp

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
            "text": "abc123xyz"
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
- La URL puede ser dinámica usando `{{1}}` en la definición del template
- El texto del botón tiene un máximo de 25 caracteres
- Solo puedes tener **1 botón de URL** por template (puedes combinar con quick_reply buttons)

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
   - **URL**: `https://tu-dominio.com/appointment/{{1}}`

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
   - **URL**: `https://tu-dominio.com/appointment/{{1}}`

---

## Notas importantes

- **URL base en el template**: La URL base (`https://tu-dominio.com/appointment/`) debe estar en el template de Meta Business Suite
- **Solo el token se envía**: El código solo envía el token (ej: `abc123xyz`), no la URL completa
- **Reemplazar dominio**: Cambia `tu-dominio.com` por tu dominio real en cada template
- **HTTPS requerido**: La URL debe ser HTTPS
- **Máximo 1 botón URL**: Solo puedes tener 1 botón de tipo URL por template

