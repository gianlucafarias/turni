#!/bin/bash

# Script de monitoreo básico para la aplicación
# Ejecutar: bash scripts/monitor.sh

echo "🔍 Monitoreo de Tiendita"
echo "========================"
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Estado de contenedores
echo "📦 Estado de Contenedores:"
echo "---------------------------"
docker compose ps
echo ""

# 2. Health check
echo "🏥 Health Check:"
echo "----------------"
HEALTH_URL="http://localhost:4321/api/health"
if command -v curl &> /dev/null; then
    HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$HEALTH_URL" 2>/dev/null)
    HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
    BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ Aplicación saludable${NC}"
        echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    else
        echo -e "${RED}❌ Aplicación no responde correctamente (HTTP $HTTP_CODE)${NC}"
        echo "$BODY"
    fi
else
    echo -e "${YELLOW}⚠️  curl no está instalado, omitiendo health check${NC}"
fi
echo ""

# 3. Uso de recursos
echo "💻 Uso de Recursos:"
echo "-------------------"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" 2>/dev/null || echo "No se pudo obtener estadísticas"
echo ""

# 4. Espacio en disco
echo "💾 Espacio en Disco:"
echo "--------------------"
df -h | grep -E '^/dev|Filesystem' | head -5
echo ""

# 5. Últimos errores
echo "🚨 Últimos Errores (últimas 10 líneas):"
echo "----------------------------------------"
docker compose logs --tail=50 app 2>/dev/null | grep -i error | tail -10 || echo "No se encontraron errores recientes"
echo ""

# 6. Logs de nginx
echo "🌐 Últimos Logs de Nginx (últimas 5 líneas):"
echo "---------------------------------------------"
docker compose logs --tail=5 nginx 2>/dev/null || echo "No hay logs de nginx"
echo ""

# 7. Verificar puertos
echo "🔌 Puertos Abiertos:"
echo "--------------------"
if command -v netstat &> /dev/null; then
    netstat -tuln | grep -E ':(80|443|4321)' || echo "No se encontraron puertos relevantes"
elif command -v ss &> /dev/null; then
    ss -tuln | grep -E ':(80|443|4321)' || echo "No se encontraron puertos relevantes"
else
    echo "No se pudo verificar puertos (netstat/ss no disponibles)"
fi
echo ""

echo "✅ Monitoreo completado"
echo ""
echo "💡 Tips:"
echo "  - Ver logs en tiempo real: docker compose logs -f app"
echo "  - Ver solo errores: docker compose logs app | grep -i error"
echo "  - Reiniciar app: docker compose restart app"
