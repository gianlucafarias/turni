# Guía de Contribución

## Flujo de Trabajo con Git

### Estructura de Ramas

- **`main`**: Rama de producción. Solo se actualiza mediante Pull Requests desde `develop`.
- **`develop`**: Rama de desarrollo. Integra todas las features antes de ir a producción.
- **`feature/*`**: Ramas para nuevas funcionalidades (ej: `feature/notificaciones-whatsapp`)
- **`fix/*`**: Ramas para correcciones de bugs (ej: `fix/login-error`)
- **`hotfix/*`**: Ramas para correcciones urgentes en producción (ej: `hotfix/security-patch`)

### Flujo de Trabajo

1. **Crear una nueva feature:**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/nombre-de-la-feature
   ```

2. **Trabajar en la feature:**
   - Hacer commits descriptivos siguiendo Conventional Commits
   - Hacer push regularmente: `git push origin feature/nombre-de-la-feature`

3. **Terminar la feature:**
   ```bash
   git checkout develop
   git pull origin develop
   git merge feature/nombre-de-la-feature
   git push origin develop
   git branch -d feature/nombre-de-la-feature  # Eliminar rama local
   ```

4. **Deploy a producción:**
   - Crear Pull Request de `develop` → `main` en GitHub
   - Revisar y aprobar
   - Merge a `main` (esto dispara el deploy automático)

5. **Hotfix (corrección urgente en producción):**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b hotfix/descripcion-del-fix
   # Hacer cambios y commit
   git checkout main
   git merge hotfix/descripcion-del-fix
   git push origin main
   # También mergear a develop
   git checkout develop
   git merge hotfix/descripcion-del-fix
   git push origin develop
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


