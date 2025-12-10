# Guía de Despliegue

## Requisitos Previos

- VPS con Docker y Docker Compose instalados
- Dominio apuntando al VPS
- Cuenta de AWS con acceso a SES y S3
- Proyecto Supabase configurado

## Configuración Inicial

### 1. Configurar AWS SES

1. Accede a la consola de AWS SES
2. Verifica tu dominio o dirección de email
3. Configura DNS (SPF, DKIM, DMARC) - Ver guía detallada en `docs/AWS_SES_DONWEB.md`
4. Crea credenciales IAM con permisos para SES
5. Obtén las credenciales de acceso (Access Key ID y Secret Access Key)

**Nota**: Si tu dominio está en DonWeb, consulta la guía específica en `docs/AWS_SES_DONWEB.md` para configurar los registros DNS correctamente.

### 2. Configurar AWS S3

1. Crea un bucket en S3 para almacenar imágenes
2. Configura políticas de acceso (recomendado: bloqueo público, acceso mediante signed URLs)
3. Habilita versionado si es necesario
4. Configura CORS si vas a acceder desde el frontend
5. Anota el nombre del bucket y la región

### 3. Configurar Variables de Entorno

Crea un archivo `.env.production` en el servidor con todas las variables necesarias (ver README.md).

## Despliegue con Docker

### Opción 1: Despliegue Manual

1. Clona el repositorio en el VPS:
```bash
cd /opt
git clone <tu-repositorio> tiendita
cd tiendita
```

2. Crea el archivo `.env.production` con todas las variables de entorno

3. Construye y levanta los contenedores:
```bash
docker compose build
docker compose up -d
```

4. Verifica que los contenedores estén corriendo:
```bash
docker compose ps
```

### Opción 2: Despliegue Automatizado con GitHub Actions

1. Configura los secrets en GitHub:
   - `VPS_HOST`: IP o dominio del VPS
   - `VPS_USER`: Usuario SSH del VPS
   - `VPS_SSH_KEY`: Clave privada SSH
   - `ADMIN_EMAIL`: Email para certificados SSL
   - `DOMAIN_NAME`: Dominio de producción
   - Todas las variables de entorno necesarias

2. Haz push a la rama `main` o ejecuta el workflow manualmente

## Configuración de SSL con Let's Encrypt

1. Asegúrate de que el dominio apunta al VPS
2. Ejecuta certbot:
```bash
docker compose --profile certbot run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email tu@email.com \
  --agree-tos \
  --no-eff-email \
  -d tudominio.com
```

3. Copia los certificados a la carpeta de nginx:
```bash
cp /etc/letsencrypt/live/tudominio.com/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/tudominio.com/privkey.pem nginx/ssl/
```

4. Reinicia nginx:
```bash
docker compose restart nginx
```

5. Configura renovación automática (cron):
```bash
0 0 * * * docker compose --profile certbot run --rm certbot renew && docker compose restart nginx
```

## Verificación Post-Despliegue

1. Verifica que la aplicación responde:
```bash
curl https://tudominio.com/health
```

2. Verifica los logs:
```bash
docker compose logs app
docker compose logs nginx
```

3. Prueba funcionalidades críticas:
   - Login/registro
   - Subida de imágenes (S3)
   - Envío de emails (SES)
   - Creación de productos/turnos

## Mantenimiento

### Actualizar la aplicación

```bash
cd /opt/tiendita
git pull
docker compose build
docker compose up -d
```

### Ver logs

```bash
docker compose logs -f app
```

### Reiniciar servicios

```bash
docker compose restart app
docker compose restart nginx
```

## Troubleshooting

### La aplicación no inicia

1. Verifica las variables de entorno: `docker compose exec app env`
2. Revisa los logs: `docker compose logs app`
3. Verifica la conectividad con Supabase

### SSL no funciona

1. Verifica que los certificados existen: `ls -la nginx/ssl/`
2. Verifica los permisos de los certificados
3. Revisa los logs de nginx: `docker compose logs nginx`

### Imágenes no se suben a S3

1. Verifica las credenciales de AWS
2. Verifica los permisos del bucket
3. Revisa la configuración de CORS del bucket

