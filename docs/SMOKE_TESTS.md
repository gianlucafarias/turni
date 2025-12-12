# Pruebas de Humo Post-Despliegue

Lista de verificación para validar que el despliegue fue exitoso.

## Verificación de Infraestructura

- [ ] Contenedores Docker están corriendo (`docker compose ps`)
- [ ] Nginx responde en puerto 443 (HTTPS)
- [ ] Certificado SSL válido y sin advertencias
- [ ] Health check responde (`curl https://tudominio.com/health`)

## Verificación de Autenticación

- [ ] Página de login carga correctamente
- [ ] Registro de nuevo usuario funciona
- [ ] Login con credenciales válidas funciona
- [ ] Redirección después de login funciona
- [ ] Logout funciona correctamente

## Verificación de Supabase

- [ ] Conexión a Supabase establecida
- [ ] Consultas a la base de datos funcionan
- [ ] Autenticación de usuarios funciona
- [ ] RLS (Row Level Security) funciona correctamente

## Verificación de Almacenamiento (S3)

- [ ] Subida de imagen de producto funciona
- [ ] Imagen se guarda correctamente en S3
- [ ] URL de imagen es accesible públicamente
- [ ] Eliminación de imagen funciona
- [ ] Imágenes se muestran correctamente en la tienda

## Verificación de Email (SES)

- [ ] Email de confirmación de registro se envía
- [ ] Email de recuperación de contraseña se envía (si aplica)
- [ ] Notificaciones por email funcionan
- [ ] Emails llegan a la bandeja de entrada (no spam)

## Verificación de Funcionalidades Core

### Gestión de Tienda
- [ ] Crear tienda funciona
- [ ] Editar configuración de tienda funciona
- [ ] Ver dashboard de la tienda funciona

### Gestión de Productos (si aplica)
- [ ] Crear producto funciona
- [ ] Editar producto funciona
- [ ] Eliminar producto funciona
- [ ] Productos se muestran en la tienda pública
- [ ] Búsqueda de productos funciona

### Gestión de Turnos (si aplica)
- [ ] Crear turno funciona
- [ ] Ver calendario de turnos funciona
- [ ] Editar turno funciona
- [ ] Cancelar turno funciona
- [ ] Widget de reserva funciona en la tienda pública

### Gestión de Clientes
- [ ] Ver lista de clientes funciona
- [ ] Ver perfil de cliente funciona
- [ ] Editar información de cliente funciona
- [ ] Agregar notas a cliente funciona

## Verificación de Integraciones

### Mercado Pago (si aplica)
- [ ] Crear preferencia de pago funciona
- [ ] Webhook de Mercado Pago funciona
- [ ] Actualización de suscripción funciona

### WhatsApp (si aplica)
- [ ] Envío de mensaje de prueba funciona
- [ ] Webhook de WhatsApp recibe mensajes
- [ ] Notificaciones por WhatsApp se envían

## Verificación de Performance

- [ ] Página inicial carga en menos de 3 segundos
- [ ] Navegación entre páginas es fluida
- [ ] Imágenes se cargan correctamente
- [ ] No hay errores en la consola del navegador

## Verificación de Seguridad

- [ ] HTTPS funciona correctamente
- [ ] Headers de seguridad están presentes (HSTS, X-Frame-Options, etc.)
- [ ] Rate limiting funciona en endpoints de API
- [ ] Autenticación requerida en rutas protegidas
- [ ] No hay credenciales expuestas en el código

## Comandos Útiles para Pruebas

```bash
# Verificar salud
curl https://tudominio.com/health

# Ver logs de la aplicación
docker compose logs -f app

# Ver logs de nginx
docker compose logs -f nginx

# Verificar certificado SSL
openssl s_client -connect tudominio.com:443 -servername tudominio.com

# Verificar conectividad con Supabase
docker compose exec app node -e "console.log(process.env.PUBLIC_SUPABASE_URL)"

# Verificar variables de entorno de AWS
docker compose exec app node -e "console.log(process.env.AWS_REGION)"
```

## Notas

- Ejecutar estas pruebas después de cada despliegue
- Documentar cualquier fallo encontrado
- Verificar que los logs no muestren errores críticos
- Monitorear el uso de recursos (CPU, memoria, disco)





