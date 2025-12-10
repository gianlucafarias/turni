# Configuración de AWS SES con DonWeb

Guía paso a paso para configurar el correo electrónico de tu dominio en AWS SES usando el panel de DonWeb.

## Configuración Inicial de AWS SES

### Paso 1: Verificar Dirección de Correo Electrónico

Si es tu primera vez usando AWS SES, el asistente te pedirá verificar una dirección de correo:

1. **Ingresa tu dirección de correo electrónico** en el campo proporcionado
   - Puede ser cualquier email que tengas acceso (ej: `tu@email.com`)
   - Este email recibirá un correo de verificación de AWS
   - La dirección puede contener hasta 320 caracteres

2. **Revisa tu bandeja de entrada** (y spam) del email que ingresaste

3. **Haz clic en el enlace de verificación** en el email de AWS

4. Una vez verificado, podrás continuar al siguiente paso

**Nota**: Este paso es solo para comenzar. Para producción, necesitarás verificar tu dominio completo (Paso 2).

### Paso 2: Verificar el Dominio en AWS SES

1. En el asistente de AWS SES, selecciona **"Agregar su dominio de envío"**
2. Ingresa tu dominio completo (ej: `tudominio.com`)
   - No incluyas `www` ni `http://`
3. Selecciona **"Use a default DKIM signing key"** (recomendado)
4. Haz clic en **"Create identity"** o **"Verificar dominio"**

**Importante**: Después de este paso, AWS te mostrará los registros DNS que necesitas agregar en DonWeb.

## Paso 2: Obtener los Registros DNS de AWS

Después de crear la identidad, AWS te mostrará los registros DNS que necesitas agregar:

### Registros de Verificación del Dominio
- **Tipo**: TXT
- **Nombre**: `_amazonses.tudominio.com` (o solo `_amazonses` dependiendo del panel)
- **Valor**: Un código largo que AWS proporciona (ej: `"v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC..."`)

### Registros DKIM (3 registros CNAME)
AWS proporciona 3 registros CNAME para DKIM:

1. **Registro 1**:
   - **Tipo**: CNAME
   - **Nombre**: `[código1]._domainkey.tudominio.com`
   - **Valor**: `[código1].dkim.amazonses.com`

2. **Registro 2**:
   - **Tipo**: CNAME
   - **Nombre**: `[código2]._domainkey.tudominio.com`
   - **Valor**: `[código2].dkim.amazonses.com`

3. **Registro 3**:
   - **Tipo**: CNAME
   - **Nombre**: `[código3]._domainkey.tudominio.com`
   - **Valor**: `[código3].dkim.amazonses.com`

## Paso 4: Configurar Registros en DonWeb

### Acceder al Panel de DNS de DonWeb

1. Inicia sesión en tu cuenta de [DonWeb](https://www.donweb.com/)
2. Ve a **Mis Productos** → **Dominios**
3. Selecciona tu dominio
4. Busca la sección **DNS** o **Zona DNS**
5. Haz clic en **Gestionar DNS** o **Editar zona DNS**

### Agregar Registros TXT para Verificación

1. Haz clic en **Agregar registro** o **Nuevo registro**
2. Selecciona tipo **TXT**
3. En el campo **Nombre** o **Host**, ingresa: `_amazonses`
   - Nota: Algunos paneles requieren `_amazonses.tudominio.com`, otros solo `_amazonses`
4. En el campo **Valor** o **Contenido**, pega el valor completo que AWS proporcionó (incluyendo las comillas si las tiene)
5. **TTL**: Deja el valor por defecto (3600 o 1 hora)
6. Guarda el registro

### Agregar Registros CNAME para DKIM

Para cada uno de los 3 registros DKIM:

1. Haz clic en **Agregar registro**
2. Selecciona tipo **CNAME**
3. En el campo **Nombre** o **Host**, ingresa el nombre completo del registro DKIM:
   - Ejemplo: `abc123def456._domainkey`
   - No incluyas el dominio completo, solo la parte antes del dominio
4. En el campo **Valor** o **Apunta a**, ingresa el valor del registro DKIM:
   - Ejemplo: `abc123def456.dkim.amazonses.com`
5. **TTL**: Deja el valor por defecto
6. Guarda el registro
7. Repite para los otros 2 registros DKIM

### Agregar Registro SPF (Recomendado)

1. Haz clic en **Agregar registro**
2. Selecciona tipo **TXT**
3. En el campo **Nombre**, ingresa: `@` o deja vacío (depende del panel)
4. En el campo **Valor**, ingresa:
   ```
   v=spf1 include:amazonses.com ~all
   ```
5. **TTL**: Deja el valor por defecto
6. Guarda el registro

**Nota**: Si ya tienes un registro SPF, debes modificarlo para incluir `include:amazonses.com` en lugar de crear uno nuevo.

### Agregar Registro DMARC (Opcional pero Recomendado)

1. Haz clic en **Agregar registro**
2. Selecciona tipo **TXT**
3. En el campo **Nombre**, ingresa: `_dmarc`
4. En el campo **Valor**, ingresa:
   ```
   v=DMARC1; p=quarantine; rua=mailto:admin@tudominio.com
   ```
   (Reemplaza `admin@tudominio.com` con tu email)
5. **TTL**: Deja el valor por defecto
6. Guarda el registro

## Paso 5: Verificar la Configuración

### En DonWeb
1. Verifica que todos los registros estén guardados correctamente
2. Espera unos minutos para que los cambios se propaguen

### En AWS SES
1. Vuelve a la consola de AWS SES
2. Ve a **Verified identities**
3. Selecciona tu dominio
4. El estado debería cambiar a **Verified** (puede tardar hasta 48 horas, pero generalmente es más rápido)
5. Verifica que los 3 registros DKIM muestren estado **Success**

## Paso 6: Solicitar Salida del Sandbox (Producción)

**Importante**: Por defecto, AWS SES está en modo "Sandbox". Esto significa que:
- Solo puedes enviar emails a direcciones de correo que hayas verificado previamente
- Tienes un límite de 200 emails por día y 1 email por segundo

Para usar SES en producción y enviar a cualquier dirección, necesitas solicitar salida del Sandbox:

Por defecto, AWS SES está en modo "Sandbox" que solo permite enviar a direcciones verificadas. Para producción:

1. En AWS SES, ve a **Account dashboard**
2. Haz clic en **Request production access**
3. Completa el formulario explicando tu caso de uso
4. Espera la aprobación (generalmente 24-48 horas)

## Ejemplo de Configuración Completa en DonWeb

Aquí tienes un ejemplo visual de cómo deberían verse los registros:

```
Tipo    Nombre                    Valor
----    ------                    -----
TXT     _amazonses                "v=DKIM1; k=rsa; p=MIGfMA0..."
CNAME   abc123._domainkey         abc123.dkim.amazonses.com
CNAME   def456._domainkey         def456.dkim.amazonses.com
CNAME   ghi789._domainkey         ghi789.dkim.amazonses.com
TXT     @                         v=spf1 include:amazonses.com ~all
TXT     _dmarc                    v=DMARC1; p=quarantine; rua=mailto:admin@tudominio.com
```

## Troubleshooting

### El dominio no se verifica después de 48 horas

1. Verifica que los registros TXT estén correctos (sin espacios extra, con comillas si AWS las requiere)
2. Usa herramientas como [MXToolbox](https://mxtoolbox.com/TXTLookup.aspx) para verificar que los registros se propagaron
3. Verifica que no haya registros duplicados o conflictivos

### Los registros DKIM no funcionan

1. Asegúrate de que los 3 registros CNAME estén correctos
2. Verifica que el nombre del registro incluya `._domainkey` pero no el dominio completo
3. Espera hasta 72 horas para la propagación completa

### Errores al enviar emails

1. Verifica que el dominio esté completamente verificado en AWS SES
2. Si estás en Sandbox, asegúrate de verificar también las direcciones de destino
3. Revisa los logs de AWS SES para ver errores específicos

## Recursos Adicionales

- [Documentación oficial de AWS SES](https://docs.aws.amazon.com/ses/latest/dg/creating-identities.html)
- [Guía de configuración DNS de AWS SES](https://docs.aws.amazon.com/ses/latest/dg/dns-txt-records.html)
- [Soporte de DonWeb](https://www.donweb.com/soporte)

## Notas Importantes

- Los cambios DNS pueden tardar entre 15 minutos y 48 horas en propagarse completamente
- AWS SES requiere que verifiques el dominio antes de poder enviar emails desde cualquier dirección de ese dominio
- En modo Sandbox, solo puedes enviar a direcciones de email verificadas
- Para producción, necesitas solicitar salida del Sandbox

