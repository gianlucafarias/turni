# Guía Rápida: Agregar Secrets en GitHub

## Proceso Simplificado

1. Ve a tu repositorio en GitHub
2. **Settings** → **Secrets and variables** → **Actions**
3. Haz clic en **"New repository secret"** para cada variable

## Lista de Secrets Obligatorios

Agrega estos secrets uno por uno:

### Conectividad VPS
- `VPS_HOST` = `179.43.126.128`
- `VPS_USER` = `root`
- `VPS_SSH_PORT` = `5205`
- `VPS_SSH_KEY` = (ya lo agregaste - la clave privada completa)

### Supabase
- `PUBLIC_SUPABASE_URL` = (de tu .env)
- `PUBLIC_SUPABASE_ANON_KEY` = (de tu .env)
- `SUPABASE_SERVICE_ROLE_KEY` = (de tu .env)

### AWS (S3 y SES)
- `AWS_ACCESS_KEY_ID` = (de tu .env)
- `AWS_SECRET_ACCESS_KEY` = (de tu .env)
- `AWS_REGION` = (de tu .env, ej: `us-east-1`)
- `S3_BUCKET` = (de tu .env)
- `S3_BASE_URL` = (de tu .env)

### Email (SES)
- `EMAIL_PROVIDER` = `ses` (o el que uses)
- `EMAIL_FROM_ADDRESS` = (de tu .env)
- `EMAIL_FROM_NAME` = (de tu .env)

### WhatsApp
- `WHATSAPP_API_TOKEN` = (de tu .env)
- `WHATSAPP_PHONE_NUMBER_ID` = (de tu .env)
- `WHATSAPP_BUSINESS_ACCOUNT_ID` = (de tu .env)
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` = (de tu .env)

### Mercado Pago
- `MERCADOPAGO_ACCESS_TOKEN` = (de tu .env)
- `MERCADOPAGO_PUBLIC_KEY` = (de tu .env)
- `PUBLIC_SITE_URL` = (de tu .env, ej: `https://tudominio.com`)
- `CRON_SECRET_TOKEN` = (de tu .env)

### SSL
- `ADMIN_EMAIL` = (tu email para certificados SSL)
- `DOMAIN_NAME` = (tu dominio, ej: `tudominio.com`)

## Secrets Opcionales

Solo agrega estos si los usas:

### Google Maps
- `PUBLIC_GOOGLE_MAPS_API_KEY` = (si usas autocompletado de direcciones)

### Google Calendar
- `GOOGLE_CLIENT_ID` = (si usas sincronización con Google Calendar)
- `GOOGLE_CLIENT_SECRET` = (si usas sincronización con Google Calendar)
- `GOOGLE_REDIRECT_URI` = (ej: `https://tudominio.com/api/google-calendar/callback`)

### Cloudflare R2 (alternativa a S3)
- `CLOUDFLARE_ACCOUNT_ID` = (solo si usas R2 en lugar de S3)
- `CLOUDFLARE_R2_ACCESS_KEY_ID` = (solo si usas R2)
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY` = (solo si usas R2)
- `CLOUDFLARE_R2_BUCKET_NAME` = (solo si usas R2)
- `CLOUDFLARE_R2_PUBLIC_URL` = (solo si usas R2)

## Consejos

1. **No agregues variables que empiecen con `NODE_ENV`** - se generan automáticamente
2. **Compara tu .env con esta lista** - algunas variables pueden tener nombres ligeramente diferentes
3. **Si falta una variable en tu .env**, puedes crearla o dejarla vacía (el workflow funcionará, pero esa funcionalidad no estará disponible)
4. **Los secrets son case-sensitive** - usa exactamente los nombres mostrados arriba

## Verificación

Después de agregar todos los secrets obligatorios, puedes:
- Hacer push a `main` para probar el deploy automático
- O ir a **Actions** → **Deploy to Production** → **Run workflow** (ejecución manual)
