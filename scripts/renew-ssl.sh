#!/bin/bash

set -e

echo "Renovando certificados SSL..."

# Renovar certificados
docker compose --profile certbot run --rm certbot renew

# Copiar certificados renovados
DOMAIN=$(ls /etc/letsencrypt/live/ | grep -v README | head -n 1)
if [ -n "$DOMAIN" ]; then
    cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" nginx/ssl/
    cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" nginx/ssl/
    
    # Reiniciar nginx
    docker compose restart nginx
    
    echo "Certificados renovados y nginx reiniciado"
else
    echo "No se encontró ningún dominio con certificados"
    exit 1
fi



