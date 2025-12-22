# Configuración CORS para Cloudflare R2

## Configuración para Desarrollo y Producción

Ve a tu bucket en Cloudflare R2 → **Settings** → **CORS Policy** y agrega esta configuración:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:4321",
      "http://localhost:3000",
      "https://tudominio.com"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## Explicación

- **AllowedOrigins**: 
  - `http://localhost:4321` - Para desarrollo local con Astro (puerto por defecto)
  - `http://localhost:3000` - Por si usas otro puerto o herramienta
  - `https://tudominio.com` - Reemplaza con tu dominio de producción

- **AllowedMethods**: Métodos HTTP permitidos para las peticiones
- **AllowedHeaders**: `["*"]` permite todos los headers (necesario para autenticación)
- **ExposeHeaders**: Headers que el navegador puede leer en la respuesta
- **MaxAgeSeconds**: Tiempo que el navegador cachea la respuesta CORS (1 hora)

## Solo Desarrollo Local

Si solo quieres probar en local por ahora:

```json
[
  {
    "AllowedOrigins": ["http://localhost:4321"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## Nota

- Reemplaza `https://tudominio.com` con tu dominio real de producción
- Puedes agregar múltiples orígenes en el array `AllowedOrigins`
- Después de guardar, los cambios se aplican inmediatamente









