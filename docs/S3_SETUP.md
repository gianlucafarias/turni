# Configuración de AWS S3

## Crear Bucket

1. Accede a la consola de AWS S3
2. Crea un nuevo bucket con nombre único (ej: `tiendita-prod-images`)
3. Selecciona la región (ej: `us-east-1`)
4. Desactiva "Block all public access" si necesitas acceso público, o mantenlo activado para usar signed URLs
5. Habilita versionado si es necesario

## Configurar Políticas

### Política del Bucket (si necesitas acceso público)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::tiendita-prod-images/*"
    }
  ]
}
```

### Política IAM para la aplicación

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::tiendita-prod-images",
        "arn:aws:s3:::tiendita-prod-images/*"
      ]
    }
  ]
}
```

## Configurar CORS

Si vas a subir imágenes desde el frontend, configura CORS:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["https://tudominio.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

## Variables de Entorno

Agrega estas variables a tu `.env.production`:

```env
AWS_REGION=us-east-1
S3_BUCKET=tiendita-prod-images
S3_BASE_URL=https://tiendita-prod-images.s3.us-east-1.amazonaws.com
AWS_ACCESS_KEY_ID=tu-access-key-id
AWS_SECRET_ACCESS_KEY=tu-secret-access-key
```

## Migración desde Supabase Storage

Si actualmente usas Supabase Storage y quieres migrar a S3:

1. Crea un script de migración para mover las imágenes existentes
2. Actualiza el código para usar S3 en lugar de Supabase Storage
3. Configura las variables de entorno
4. Prueba la subida de nuevas imágenes

## Implementación en el Código

Necesitarás crear un servicio de almacenamiento que use el SDK de AWS S3. Ejemplo básico:

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: import.meta.env.AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.AWS_SECRET_ACCESS_KEY,
  },
});

export async function uploadToS3(file: File, path: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: import.meta.env.S3_BUCKET,
    Key: path,
    Body: await file.arrayBuffer(),
    ContentType: file.type,
  });
  
  await s3Client.send(command);
  return `${import.meta.env.S3_BASE_URL}/${path}`;
}
```













