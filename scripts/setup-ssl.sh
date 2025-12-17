#!/bin/bash

set -e

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "Uso: ./scripts/setup-ssl.sh <dominio> <email>"
    exit 1
fi

echo "Configurando SSL para $DOMAIN..."

# Crear directorios necesarios
mkdir -p nginx/ssl
mkdir -p nginx/logs

# Obtener certificado con certbot
docker compose --profile certbot run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

# Copiar certificados
cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" nginx/ssl/
cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" nginx/ssl/

# Ajustar permisos
chmod 644 nginx/ssl/fullchain.pem
chmod 600 nginx/ssl/privkey.pem

echo "Certificado SSL configurado correctamente"
echo "Reinicia nginx con: docker compose restart nginx"






