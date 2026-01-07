# Cómo Funcionan los Checks en Pull Requests

## 🔍 ¿Cuándo se Ejecutan los Tests?

Los tests **NO esperan al deploy**. Se ejecutan **inmediatamente** cuando:

1. ✅ Creas un Pull Request
2. ✅ Haces push de nuevos commits al PR
3. ✅ Reabres un PR cerrado

## 📊 Cómo Ver los Resultados

### En el PR de GitHub:

Cuando abres un PR, verás algo como esto:

```
┌─────────────────────────────────────────┐
│ feat(citas): agregar filtros            │
│                                          │
│ 🟡 Some checks haven't completed yet    │
│                                          │
│ ✅ lint-and-test                         │
│ 🟡 build-check (in progress...)         │
└─────────────────────────────────────────┘
```

**Estados posibles:**

- 🟡 **"Checks pending"** → Tests corriendo (espera 1-2 minutos)
- ✅ **"All checks have passed"** → ✅ Puedes mergear
- ❌ **"Some checks have failed"** → ❌ NO puedes mergear

### Ver Detalles de los Checks:

1. Click en el badge de estado (ej: "Some checks have failed")
2. Verás lista de jobs:
   ```
   ❌ lint-and-test
   ✅ build-check
   ```
3. Click en el job fallido → Ver logs completos del error

## 🚫 Protección: No Puedes Mergear si Fallan

Si configuraste protección de ramas (ver `BRANCH_PROTECTION_SETUP.md`):

- ❌ **Botón "Merge" estará deshabilitado** si tests fallan
- ✅ **Solo se habilita** cuando todos los checks pasan
- 🔒 **No puedes hacer bypass** (a menos que seas admin y lo configures)

## 🔄 Flujo Completo

```
1. Crear PR
   ↓
2. GitHub Actions ejecuta automáticamente:
   - npm ci (instalar deps)
   - npm test (ejecutar tests)
   - npm run build (verificar que compile)
   ↓
3. Ver resultados en el PR:
   ✅ Todos pasan → Botón "Merge" habilitado
   ❌ Algo falla → Botón "Merge" deshabilitado
   ↓
4. Si falla:
   - Ver logs del error
   - Arreglar el problema
   - Push nuevo commit
   - Tests corren de nuevo automáticamente
   ↓
5. Cuando todos pasen:
   - Merge PR
   - Deploy automático a producción
```

## 📝 Ejemplo Real

### Escenario: Tests Fallan

1. **Creas PR:**
   ```
   feature/agregar-filtros → main
   ```

2. **GitHub ejecuta tests automáticamente**

3. **Resultado:**
   ```
   ❌ lint-and-test failed
   Error: Tests failed
   - webhook.test.ts: 2 tests failed
   ```

4. **En el PR verás:**
   ```
   ❌ Some checks have failed
   [Details] ← Click aquí para ver logs
   ```

5. **Botón "Merge" está deshabilitado** 🔒

6. **Arreglas el problema:**
   ```bash
   git checkout feature/agregar-filtros
   # Arreglar tests
   git commit -m "fix(tests): corregir mocks de webhook"
   git push
   ```

7. **Tests corren de nuevo automáticamente**

8. **Ahora pasan:**
   ```
   ✅ All checks have passed
   ```

9. **Botón "Merge" se habilita** ✅

10. **Mergeas → Deploy automático**

## 🎯 Ventajas

✅ **Sabes ANTES de mergear** si hay problemas  
✅ **No puedes mergear código roto** (si protección está activa)  
✅ **Feedback inmediato** en el PR  
✅ **Historial claro** de qué tests fallaron y por qué  
✅ **Confianza** de que lo que mergeas funciona

## 🔧 Workflows Configurados

### 1. `pr-checks.yml` (Para PRs)
- Se ejecuta: Cuando abres/actualizas un PR
- Ejecuta: Tests + Build
- Propósito: Validar antes de mergear

### 2. `deploy.yml` (Para main)
- Se ejecuta: Cuando mergeas a `main`
- Ejecuta: Tests + Build + Deploy
- Propósito: Deployar a producción

## 💡 Tips

1. **Siempre revisa los checks** antes de mergear
2. **Si un check está pendiente**, espera a que termine
3. **Si falla**, revisa los logs antes de pedir ayuda
4. **Los checks corren en paralelo**, así que son rápidos
5. **Puedes cancelar checks** si haces push de un fix antes de que terminen

## 🐛 Troubleshooting

### "Checks no aparecen"
- Verifica que el workflow `.github/workflows/pr-checks.yml` existe
- Verifica que el PR apunta a `main` o `develop`
- Espera unos segundos (puede tardar en aparecer)

### "Tests pasan localmente pero fallan en PR"
- Verifica variables de entorno (pueden faltar en GitHub Secrets)
- Verifica que `npm ci` funciona (no `npm install`)
- Revisa diferencias entre tu entorno y CI

### "Build falla pero tests pasan"
- Puede ser problema de memoria (ya configurado con limpieza)
- Verifica que todas las dependencias están en `package.json`
- Revisa logs del build para ver el error específico
