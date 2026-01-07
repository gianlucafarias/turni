# Flujo de Trabajo con Git - Guía Práctica

## 🎯 Estrategia Recomendada: GitHub Flow Simplificado

Para proyectos como este (equipo pequeño, deploys frecuentes), recomendamos **GitHub Flow** simplificado:

### Estructura de Ramas

- **`main`**: ✅ **Producción** - Solo código estable y probado
- **`develop`**: 🧪 **Desarrollo** - Integración de features (opcional, pero recomendado)
- **`feature/*`**: 🚀 Nuevas funcionalidades
- **`fix/*`**: 🐛 Correcciones de bugs
- **`hotfix/*`**: 🔥 Correcciones urgentes en producción

---

## 📋 Flujo de Trabajo Diario

### 1️⃣ **Nueva Feature o Fix**

```bash
# Actualizar main
git checkout main
git pull origin main

# Crear rama desde main (o develop si existe)
git checkout -b feature/nombre-descriptivo
# O para fixes:
git checkout -b fix/descripcion-del-bug
```

**Convención de nombres:**
- `feature/agregar-filtros-citas`
- `feature/integracion-whatsapp`
- `fix/login-error-email`
- `fix/mobile-responsive-dashboard`

### 2️⃣ **Trabajar en la Rama**

```bash
# Hacer commits descriptivos
git add .
git commit -m "feat(citas): agregar filtro por fecha"
git commit -m "fix(dashboard): corregir scroll en móvil"

# Push regularmente
git push origin feature/nombre-descriptivo
```

**Conventional Commits:**
- `feat`: Nueva funcionalidad
- `fix`: Corrección de bug
- `refactor`: Refactorización
- `docs`: Documentación
- `test`: Tests
- `chore`: Mantenimiento

### 3️⃣ **Crear Pull Request**

1. **En GitHub:**
   - Ir a "Pull Requests" → "New Pull Request"
   - Base: `main` (o `develop` si usas Git Flow)
   - Compare: `feature/tu-rama`

2. **Título del PR:**
   ```
   feat(citas): agregar filtros de fecha y estado
   ```

3. **Descripción del PR:**
   ```markdown
   ## Cambios
   - Agregar filtros por fecha (hoy, semana, mes)
   - Agregar filtros por estado (pendiente, confirmado)
   - Mejorar UI de filtros con pills redondeadas
   
   ## Testing
   - [x] Tests pasan localmente
   - [x] Probado en Chrome
   - [x] Probado en móvil
   
   ## Screenshots
   [Si aplica]
   ```

4. **El PR automáticamente ejecuta checks:**
   - ✅ **Tests** (`lint-and-test` job)
   - ✅ **Build** (`build-check` job)
   - ✅ **Linter** (dentro de tests)
   - ✅ **Secret scanning** (TruffleHog)

5. **Ver el estado de los checks:**
   - En el PR verás badges de estado:
     - 🟡 **"Checks pending"** → Tests corriendo
     - ✅ **"All checks have passed"** → Listo para mergear
     - ❌ **"Some checks failed"** → NO puedes mergear (tests fallaron)

6. **Si los tests fallan:**
   - Click en "Details" del check fallido
   - Ver logs del error
   - Arreglar el problema
   - Push nuevo commit → Tests corren de nuevo automáticamente

### 4️⃣ **Review y Merge**

- **Si trabajas solo:** Puedes auto-mergear después de revisar
- **Si trabajas en equipo:** Esperar aprobación de otro dev
- **Merge strategy:** Preferir "Squash and merge" para mantener historial limpio

### 5️⃣ **Deploy Automático**

- **Merge a `main`** → Deploy automático a producción
- **Merge a `develop`** → Build y tests (sin deploy)

---

## 🔥 Hotfix (Corrección Urgente en Producción)

Cuando hay un bug crítico en producción:

```bash
# Desde main
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug-fix

# Hacer el fix
git add .
git commit -m "fix(auth): corregir error de login crítico"

# Push y crear PR
git push origin hotfix/critical-bug-fix
```

**Proceso:**
1. Crear PR `hotfix/*` → `main`
2. Merge inmediato (bypass review si es crítico)
3. Deploy automático
4. **IMPORTANTE:** Mergear también a `develop` (o crear PR)

```bash
# Después del merge a main
git checkout develop
git pull origin develop
git merge main  # O crear PR hotfix → develop
git push origin develop
```

---

## 🎨 Flujo Visual

```
main (producción)
  ↑
  │ PR + Tests + Review
  │
feature/nueva-funcionalidad
  │
  └─ Commits diarios

---

main (producción) ←─── hotfix/critical-fix (urgente)
  │
  └─ develop (desarrollo) ←─── feature/nueva-funcionalidad
```

---

## ✅ Checklist Antes de Crear PR

- [ ] Código compila sin errores
- [ ] Tests pasan (`npm run test`)
- [ ] Linter pasa (`npm run astro check`)
- [ ] Sin `console.log` de debug
- [ ] Sin código comentado innecesario
- [ ] Documentación actualizada (si aplica)
- [ ] Variables de entorno documentadas (si hay nuevas)
- [ ] Probado localmente

---

## 🚫 Qué NO Hacer

❌ **NO** hacer commit directo a `main`  
❌ **NO** hacer merge sin PR (excepto hotfix críticos)  
❌ **NO** hacer push de código roto  
❌ **NO** hacer commits gigantes (dividir en commits lógicos)  
❌ **NO** olvidar mergear hotfix a `develop`

---

## 📊 Ventajas de Este Flujo

✅ **Historial limpio**: Cada PR es una unidad lógica  
✅ **Rollback fácil**: Puedes revertir PRs completos  
✅ **Testing automático**: Tests corren antes de merge  
✅ **Code review**: Oportunidad de revisar antes de producción  
✅ **Deploy seguro**: Solo código probado va a producción  
✅ **Trazabilidad**: Cada cambio tiene contexto en el PR

---

## 🔄 Migración desde tu Flujo Actual

Si actualmente merges directo a `main`:

1. **Crear rama `develop`** (opcional pero recomendado):
   ```bash
   git checkout main
   git checkout -b develop
   git push origin develop
   ```

2. **Configurar protección de ramas en GitHub:**
   - Settings → Branches → Add rule
   - Branch: `main`
   - ✅ Require pull request before merging
   - ✅ Require status checks to pass
   - ✅ Require branches to be up to date

3. **Empezar a usar PRs:**
   - Para cada cambio, crear rama y PR
   - Acostumbrarse al flujo gradualmente

---

## 🛠️ Comandos Útiles

```bash
# Ver ramas locales
git branch

# Ver ramas remotas
git branch -r

# Eliminar rama local (después de merge)
git branch -d feature/nombre

# Eliminar rama remota
git push origin --delete feature/nombre

# Actualizar main local
git checkout main
git pull origin main

# Ver diferencias con main
git diff main

# Ver commits que no están en main
git log main..HEAD
```

---

## 📝 Ejemplo Completo

```bash
# 1. Actualizar main
git checkout main
git pull origin main

# 2. Crear feature
git checkout -b feature/mejorar-filtros-citas

# 3. Trabajar...
git add .
git commit -m "feat(citas): agregar filtro por fecha"
git push origin feature/mejorar-filtros-citas

# 4. Más trabajo...
git add .
git commit -m "feat(citas): agregar filtro por estado"
git push origin feature/mejorar-filtros-citas

# 5. Crear PR en GitHub (desde la web)

# 6. Después del merge, limpiar
git checkout main
git pull origin main
git branch -d feature/mejorar-filtros-citas
```

---

## 🎓 Recursos

- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Branching Strategies](https://www.atlassian.com/git/tutorials/comparing-workflows)
