# Configuración de GitHub Actions para Deploy Automático

Este documento explica cómo configurar GitHub Actions para hacer deploy automático a tu VPS.

## Secrets Requeridos en GitHub

Ve a tu repositorio en GitHub → **Settings** → **Secrets and variables** → **Actions**

En la pestaña **"Secrets"**, haz clic en **"New repository secret"** para agregar cada secret.

### Secrets Obligatorios para el Workflow

#### 1. Secrets de VPS (Conectividad)

**Importante**: Antes de agregar estos secrets, necesitas generar una clave SSH. Ver la guía completa en `docs/SSH_KEY_SETUP.md`

- **`VPS_HOST`**: IP o dominio de tu VPS (ej: `179.43.126.128` o `vps.tudominio.com`)
- **`VPS_USER`**: Usuario SSH del VPS (ej: `root`)
- **`VPS_SSH_KEY`**: Clave privada SSH completa (incluye `-----BEGIN OPENSSH PRIVATE KEY-----` hasta `-----END OPENSSH PRIVATE KEY-----`)
- **`VPS_SSH_PORT`**: Puerto SSH (ej: `5205`). Si usas el puerto 22, puedes omitir este secret.

#### 2. Secrets de Supabase
- **`PUBLIC_SUPABASE_URL`**: URL de tu proyecto Supabase
- **`PUBLIC_SUPABASE_ANON_KEY`**: Anon/public key de Supabase
- **`SUPABASE_SERVICE_ROLE_KEY`**: Service role key de Supabase (para operaciones del servidor)

#### 3. Secrets de AWS (Email SES y Storage S3)
- **`AWS_ACCESS_KEY_ID`**: Access Key ID de AWS
- **`AWS_SECRET_ACCESS_KEY`**: Secret Access Key de AWS
- **`AWS_REGION`**: Región de AWS (ej: `us-east-1`)
- **`S3_BUCKET`**: Nombre del bucket de S3 (ej: `tiendita-prod-images`)
- **`S3_BASE_URL`**: URL base del bucket (ej: `https://tiendita-prod-images.s3.us-east-1.amazonaws.com`)

#### 4. Secrets de Email (SES)
- **`EMAIL_PROVIDER`**: `ses` (si usas AWS SES)
- **`EMAIL_FROM_ADDRESS`**: Dirección de email verificada en SES (ej: `noreply@tudominio.com`)
- **`EMAIL_FROM_NAME`**: Nombre del remitente (ej: `Tiendita`)

#### 5. Secrets de WhatsApp Business API
- **`WHATSAPP_API_TOKEN`**: Token de acceso de la API de WhatsApp
- **`WHATSAPP_PHONE_NUMBER_ID`**: ID del número de teléfono de WhatsApp Business
- **`WHATSAPP_BUSINESS_ACCOUNT_ID`**: ID de la cuenta de WhatsApp Business
- **`WHATSAPP_WEBHOOK_VERIFY_TOKEN`**: Token para verificar webhooks (puede ser cualquier string aleatorio)

#### 6. Secrets de Mercado Pago
- **`MERCADOPAGO_ACCESS_TOKEN`**: Access Token de Mercado Pago (producción)
- **`MERCADOPAGO_PUBLIC_KEY`**: Public Key de Mercado Pago (producción)
- **`PUBLIC_SITE_URL`**: URL de tu sitio (ej: `https://tudominio.com`)
- **`CRON_SECRET_TOKEN`**: Token secreto para proteger endpoints de cron (cualquier string aleatorio)

#### 7. Secrets de SSL
- **`ADMIN_EMAIL`**: Email para certificados SSL de Let's Encrypt
- **`DOMAIN_NAME`**: Dominio de producción (ej: `tudominio.com`)

### Secrets Opcionales

Estos secrets son opcionales pero se recomiendan si usas estas funcionalidades:

#### Google Maps (para autocompletado de direcciones)
- **`PUBLIC_GOOGLE_MAPS_API_KEY`**: API Key de Google Maps con Places API habilitada

#### Google Calendar (para sincronización)
- **`GOOGLE_CLIENT_ID`**: Client ID de Google OAuth
- **`GOOGLE_CLIENT_SECRET`**: Client Secret de Google OAuth
- **`GOOGLE_REDIRECT_URI`**: URL de callback (ej: `https://tudominio.com/api/google-calendar/callback`)

#### Cloudflare R2 (alternativa a S3)
Si prefieres usar Cloudflare R2 en lugar de S3:
- **`CLOUDFLARE_ACCOUNT_ID`**: Account ID de Cloudflare
- **`CLOUDFLARE_R2_ACCESS_KEY_ID`**: Access Key ID de R2
- **`CLOUDFLARE_R2_SECRET_ACCESS_KEY`**: Secret Access Key de R2
- **`CLOUDFLARE_R2_BUCKET_NAME`**: Nombre del bucket de R2
- **`CLOUDFLARE_R2_PUBLIC_URL`**: URL pública del bucket de R2

## Configuración del Workflow

El workflow está configurado en `.github/workflows/deploy.yml` y se ejecuta:

1. **Automáticamente**: Cuando haces push a la rama `main`
2. **Manualmente**: Desde la pestaña "Actions" en GitHub → "Deploy to Production" → "Run workflow"

## Proceso de Deploy

1. **Lint and Test**: Verifica el código y ejecuta tests
2. **Build**: Construye la aplicación (solo para verificar que compila)
3. **Deploy**: 
   - Conecta al VPS vía SSH
   - Detecta el directorio (`/opt/turni` o `/opt/tiendita`)
   - Copia los archivos necesarios
   - Construye y levanta los contenedores Docker
   - Opcionalmente configura SSL (solo en ejecución manual)

## Notas Importantes

- El workflow detecta automáticamente si tu proyecto está en `/opt/turni` o `/opt/tiendita`
- Los secrets opcionales pueden dejarse vacíos si no usas esas funcionalidades
- El certificado SSL solo se configura cuando ejecutas el workflow manualmente (no en deploys automáticos)
- Asegúrate de que el usuario SSH tenga permisos para ejecutar Docker en el VPS

## Troubleshooting

### Error: "Permission denied (publickey)"
- Verifica que `VPS_SSH_KEY` esté correctamente configurado (debe incluir las líneas BEGIN y END)
- Verifica que la clave pública correspondiente esté en `~/.ssh/authorized_keys` del VPS

### Error: "Connection refused"
- Verifica que `VPS_HOST` y `VPS_USER` sean correctos
- Verifica que el puerto SSH (22) esté abierto en el firewall

### Error: "docker: command not found"
- El usuario SSH debe tener permisos para ejecutar Docker
- Agrega el usuario al grupo docker: `sudo usermod -aG docker $USER`

### Error en el build
- Verifica que todos los secrets obligatorios estén configurados
- Revisa los logs del workflow en GitHub Actions para más detalles
