# Configuración de Cloudflare R2 para Almacenamiento de Imágenes

## ¿Por qué Cloudflare R2?

- **Free Tier generoso**: 10 GB de almacenamiento, 1M operaciones de escritura, 10M de lectura
- **Sin costo de transferencia**: No pagas por el ancho de banda de salida
- **Precio competitivo**: $0.015/GB después del free tier
- **CDN global**: Distribución automática de contenido
- **Compatible con S3 API**: Fácil integración

## Pasos de Configuración

### 1. Crear cuenta en Cloudflare

1. Ve a [cloudflare.com](https://www.cloudflare.com/)
2. Crea una cuenta o inicia sesión
3. Verifica tu email si es necesario

### 2. Habilitar R2 en tu cuenta

1. En el dashboard de Cloudflare, ve a **R2** en el menú lateral
2. Si es la primera vez, haz clic en **"Get started"** o **"Enable R2"**
3. Acepta los términos y condiciones

### 3. Crear un Bucket

1. En la sección R2, haz clic en **"Create bucket"**
2. Elige un nombre único para tu bucket (ej: `tiendita-images`)
3. Selecciona la ubicación (elige la más cercana a tus usuarios, ej: `South America` o `Auto`)
4. Haz clic en **"Create bucket"**

### 4. Configurar permisos públicos (opcional)

Si quieres que las imágenes sean accesibles públicamente:

1. Ve a tu bucket
2. Haz clic en **"Settings"**
3. En **"Public Access"**, habilita **"Allow Access"**
4. Esto generará una URL pública para tus archivos

### 5. Obtener Account ID

1. En el dashboard de Cloudflare, selecciona tu cuenta
2. En el panel derecho, verás tu **Account ID**
3. Cópialo

### 6. Crear API Token para R2

**Método Recomendado: Desde la sección R2**

Las credenciales S3-compatibles de R2 se crean desde la sección de R2:

1. Ve a la sección **R2** en el dashboard de Cloudflare
2. Haz clic en **"Manage R2 API Tokens"** (puede estar en el menú lateral o en la parte superior)
3. Haz clic en **"Create API Token"**
4. Configura el token:
   - **Token name**: Un nombre descriptivo (ej: "Tiendita Images")
   - **Permissions**: Selecciona **"Admin Read & Write"** para permisos completos
   - **TTL**: Opcional, puedes dejarlo sin límite (Forever) o poner una fecha de expiración
   - **Buckets**: Selecciona tu bucket específico (`tiendita-images`) o "All buckets" si tienes varios
5. Haz clic en **"Create API Token"**
6. **IMPORTANTE**: Copia y guarda inmediatamente:
   - **Access Key ID**
   - **Secret Access Key**
   
   ⚠️ **Estas credenciales solo se muestran una vez**. Si las pierdes, tendrás que crear un nuevo token.

**Método Alternativo: Desde API Tokens General**

Si no encuentras "Manage R2 API Tokens" en la sección R2:

1. Ve a **My Profile** → **API Tokens** → **Create Token** → **Create Custom Token**
2. **Token name**: Un nombre descriptivo (ej: "tiendita")
3. **Resources**: Selecciona **Account**
4. **Permissions**: Busca y selecciona **"Workers R2 Storage"** → **Edit**
5. Haz clic en **"Continue to summary"** y luego **"Create Token"**

⚠️ **Nota**: Este método crea un token general de Cloudflare, pero para obtener las credenciales S3-compatibles (Access Key ID y Secret Access Key) necesarias para nuestro código, es mejor usar el Método Recomendado desde la sección R2.

### 7. Configurar variables de entorno

Agrega estas variables a tu archivo `.env` (o `.env.local` para desarrollo):

```env
# Cloudflare R2 Configuration
CLOUDFLARE_ACCOUNT_ID=tu_account_id_aqui
CLOUDFLARE_R2_ACCESS_KEY_ID=tu_access_key_id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=tu_secret_access_key
CLOUDFLARE_R2_BUCKET_NAME=tiendita-images
CLOUDFLARE_R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

**Nota**: El `PUBLIC_URL` lo obtienes después de habilitar el acceso público en el bucket (paso 3). Si no habilitas acceso público, necesitarás usar signed URLs.

### 8. Configurar CORS (si subes desde el frontend)

Si vas a subir imágenes directamente desde el navegador, necesitas configurar CORS:

1. Ve a tu bucket en R2
2. Haz clic en **"Settings"**
3. En **"CORS Policy"**, agrega esta configuración:

```json
[
  {
    "AllowedOrigins": ["https://tudominio.com", "http://localhost:4321"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

**Nota**: Reemplaza `https://tudominio.com` con tu dominio de producción y agrega `http://localhost:4321` (o el puerto que uses) para desarrollo.

### 9. Obtener Public URL (si habilitaste acceso público)

1. Ve a tu bucket → **Settings**
2. En **"Public Access"**, verás la URL pública
3. Copia esa URL y úsala como `CLOUDFLARE_R2_PUBLIC_URL`

## Verificación

Para verificar que todo está configurado correctamente:

1. Las variables de entorno están configuradas
2. El bucket existe y tiene acceso público habilitado (si lo necesitas)
3. Las credenciales API están creadas
4. CORS está configurado (si subes desde el frontend)

## Costos Estimados

Con el free tier de Cloudflare R2:
- **10 GB de almacenamiento**: Gratis
- **1 millón de operaciones de escritura**: Gratis
- **10 millones de operaciones de lectura**: Gratis
- **Transferencia de datos**: Gratis (sin límite)

Después del free tier:
- Almacenamiento: $0.015/GB/mes
- Operaciones Clase A (escrituras): $4.50 por millón
- Operaciones Clase B (lecturas): $0.36 por millón
- Transferencia: Gratis (sin límite)

## Migración desde Supabase Storage

Si ya tienes imágenes en Supabase Storage:

1. Las imágenes existentes seguirán funcionando (URLs antiguas)
2. Las nuevas imágenes se subirán a R2
3. Opcional: Puedes crear un script para migrar imágenes antiguas a R2

## Troubleshooting

### Error: "Access Denied"
- Verifica que las credenciales API sean correctas
- Verifica que el bucket existe y tiene los permisos correctos

### Error: "CORS policy"
- Verifica que CORS esté configurado en el bucket
- Verifica que tu dominio esté en la lista de orígenes permitidos

### Las imágenes no se muestran
- Verifica que el acceso público esté habilitado
- Verifica que la URL pública sea correcta
- Verifica que la ruta del archivo sea correcta

