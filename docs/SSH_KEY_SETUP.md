# Configuración de Clave SSH para GitHub Actions

GitHub Actions necesita autenticarse en tu VPS usando una clave SSH (no contraseña). Esta guía te muestra cómo generar y configurar las claves.

## Paso 1: Generar un Par de Claves SSH

### En Windows (PowerShell o Git Bash)

Abre PowerShell o Git Bash y ejecuta:

```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions_vps
```

**Nota**: Presiona Enter cuando te pida contraseña (déjala vacía para GitHub Actions)

Esto creará dos archivos:
- `~/.ssh/github_actions_vps` (clave privada) - **Esta es la que vas a usar en GitHub**
- `~/.ssh/github_actions_vps.pub` (clave pública) - **Esta va al servidor**

### En Mac/Linux

```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions_vps
```

## Paso 2: Leer la Clave Privada (para GitHub)

### En Windows (PowerShell)

```powershell
Get-Content ~/.ssh/github_actions_vps
```

O si estás en Git Bash:

```bash
cat ~/.ssh/github_actions_vps
```

### En Mac/Linux

```bash
cat ~/.ssh/github_actions_vps
```

**Copia TODO el contenido** (desde `-----BEGIN OPENSSH PRIVATE KEY-----` hasta `-----END OPENSSH PRIVATE KEY-----`)

## Paso 3: Leer la Clave Pública (para el servidor)

### En Windows (PowerShell)

```powershell
Get-Content ~/.ssh/github_actions_vps.pub
```

O en Git Bash:

```bash
cat ~/.ssh/github_actions_vps.pub
```

### En Mac/Linux

```bash
cat ~/.ssh/github_actions_vps.pub
```

**Copia TODO el contenido** (debería verse algo como: `ssh-ed25519 AAAAC3N... github-actions`)

## Paso 4: Agregar la Clave Pública al VPS

Conecta a tu VPS con tu método actual:

```bash
ssh root@179.43.126.128 -p 5205
```

Una vez conectado, ejecuta estos comandos:

```bash
# Crear directorio .ssh si no existe
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Agregar la clave pública al archivo authorized_keys
echo "TU_CLAVE_PUBLICA_AQUI" >> ~/.ssh/authorized_keys

# Ajustar permisos (IMPORTANTE)
chmod 600 ~/.ssh/authorized_keys
```

**Reemplaza `TU_CLAVE_PUBLICA_AQUI`** con el contenido completo que copiaste en el Paso 3.

**Ejemplo completo** (reemplaza con tu clave real):

```bash
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIG... github-actions" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

## Paso 5: Verificar la Conexión

Desde tu máquina local, prueba conectarte con la clave:

```bash
ssh -i ~/.ssh/github_actions_vps root@179.43.126.128 -p 5205
```

Si funciona sin pedir contraseña, ¡perfecto! Si no, revisa los permisos.

## Paso 6: Configurar Secrets en GitHub

1. Ve a tu repositorio en GitHub
2. **Settings** → **Secrets and variables** → **Actions**
3. Haz clic en **"New repository secret"**

### Secret: `VPS_HOST`
- **Name**: `VPS_HOST`
- **Value**: `179.43.126.128`

### Secret: `VPS_USER`
- **Name**: `VPS_USER`
- **Value**: `root`

### Secret: `VPS_SSH_KEY`
- **Name**: `VPS_SSH_KEY`
- **Value**: Pega TODO el contenido de la clave privada que copiaste en el Paso 2
  - Debe incluir `-----BEGIN OPENSSH PRIVATE KEY-----`
  - Y terminar con `-----END OPENSSH PRIVATE KEY-----`

### Secret: `VPS_SSH_PORT` (Opcional)
- **Name**: `VPS_SSH_PORT`
- **Value**: `5205` (o el puerto que uses)
- **Nota**: Si no agregas este secret, el workflow usará el puerto 22 por defecto

## Paso 7: Actualizar el Workflow (si es necesario)

Si tu VPS usa un puerto SSH diferente al 22 (tu caso: 5205), necesitamos actualizar el workflow. 

**Nota**: El workflow actual asume puerto 22. Si tu servidor usa el puerto 5205, hay dos opciones:

### Opción A: Configurar SSH en el servidor para usar puerto 22 (recomendado)

En tu VPS, edita `/etc/ssh/sshd_config`:

```bash
# Cambiar la línea:
# Port 5205
# Por:
Port 22
```

Luego reinicia SSH:

```bash
systemctl restart sshd
```

Y abre el puerto 22 en el firewall si es necesario.

### Opción B: Modificar el workflow para usar puerto 5205

Si prefieres mantener el puerto 5205, podemos modificar el workflow para especificarlo.

## Troubleshooting

### Error: "Permission denied (publickey)"

1. Verifica que la clave pública esté correctamente en `~/.ssh/authorized_keys`
2. Verifica permisos:
   ```bash
   chmod 700 ~/.ssh
   chmod 600 ~/.ssh/authorized_keys
   ```
3. Verifica el log de SSH en el servidor:
   ```bash
   tail -f /var/log/auth.log
   ```
   (O en algunos sistemas: `tail -f /var/log/secure`)

### Error: "Connection refused"

- Verifica que el puerto esté abierto
- Verifica que SSH esté corriendo: `systemctl status sshd`

### La clave privada no se pega correctamente en GitHub

- Asegúrate de copiar TODO, incluyendo las líneas BEGIN y END
- No debe tener espacios extra al inicio o final
- Debe ser una sola línea continua o mantener los saltos de línea exactos
