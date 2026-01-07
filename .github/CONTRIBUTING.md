# Guía de Contribución

## Flujo de Trabajo con Git

> 📖 **Guía completa:** Ver [docs/GIT_WORKFLOW.md](../../docs/GIT_WORKFLOW.md) para detalles completos

### Estructura de Ramas

- **`main`**: ✅ **Producción** - Solo código estable. Protegida, requiere PR.
- **`develop`**: 🧪 **Desarrollo** - Integración de features (opcional pero recomendado)
- **`feature/*`**: 🚀 Nuevas funcionalidades
- **`fix/*`**: 🐛 Correcciones de bugs
- **`hotfix/*`**: 🔥 Correcciones urgentes en producción

### Flujo Recomendado (GitHub Flow Simplificado)

#### 1. Nueva Feature o Fix

```bash
# Actualizar main
git checkout main
git pull origin main

# Crear rama
git checkout -b feature/nombre-descriptivo
# O: git checkout -b fix/descripcion-del-bug
```

#### 2. Trabajar y Hacer Commits

```bash
git add .
git commit -m "feat(citas): agregar filtros por fecha"
git push origin feature/nombre-descriptivo
```

#### 3. Crear Pull Request

- Ir a GitHub → Pull Requests → New Pull Request
- Base: `main` (o `develop` si usas Git Flow)
- Compare: `feature/tu-rama`
- El PR automáticamente ejecuta tests y linter

#### 4. Review y Merge

- Revisar cambios
- Si tests pasan → Merge (Squash and merge recomendado)
- Merge a `main` → Deploy automático a producción

#### 5. Hotfix (Urgente)

```bash
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug
# Hacer fix
git push origin hotfix/critical-bug
# Crear PR → main → Merge inmediato
# IMPORTANTE: También mergear a develop después
```

## Conventional Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/) para mantener un historial claro.

### Formato

```
<tipo>[ámbito opcional]: <descripción>

[cuerpo opcional]

[pie opcional]
```

### Tipos de Commit

- **`feat`**: Nueva funcionalidad
- **`fix`**: Corrección de bug
- **`docs`**: Cambios en documentación
- **`style`**: Cambios de formato (espacios, comas, etc.)
- **`refactor`**: Refactorización de código
- **`perf`**: Mejoras de rendimiento
- **`test`**: Agregar o modificar tests
- **`chore`**: Tareas de mantenimiento (dependencias, config, etc.)
- **`ci`**: Cambios en CI/CD
- **`build`**: Cambios en sistema de build

### Ejemplos

```bash
# Feature
git commit -m "feat(notifications): agregar notificaciones push"

# Fix
git commit -m "fix(auth): corregir error de login con email"

# Con ámbito y cuerpo
git commit -m "feat(dashboard): agregar gráficos de ventas

- Agregar componente Chart
- Integrar con API de analytics
- Agregar filtros por fecha"

# Breaking change
git commit -m "feat(api)!: cambiar formato de respuesta

BREAKING CHANGE: La respuesta de /api/users ahora retorna un objeto en lugar de array"
```

### Ámbitos Comunes

- `auth`: Autenticación
- `dashboard`: Panel de control
- `notifications`: Notificaciones
- `subscriptions`: Suscripciones
- `products`: Productos
- `appointments`: Turnos/Citas
- `api`: APIs
- `ui`: Componentes de UI
- `config`: Configuración
- `deploy`: Deployment

## Pull Requests

1. **Título**: Debe seguir Conventional Commits
2. **Descripción**: Explicar qué cambia y por qué
3. **Checklist**:
   - [ ] Código compila sin errores
   - [ ] Tests pasan
   - [ ] Documentación actualizada (si aplica)
   - [ ] Sin console.logs de debug
   - [ ] Variables de entorno documentadas (si hay nuevas)

## Code Review

- Todos los PRs deben ser revisados antes de mergear
- El revisor debe verificar:
  - Código limpio y legible
  - Sin bugs obvios
  - Tests adecuados
  - Performance (si aplica)

## Deploy

- **Desarrollo**: Se deploya automáticamente desde `develop` (si está configurado)
- **Producción**: Se deploya automáticamente desde `main` vía GitHub Actions









