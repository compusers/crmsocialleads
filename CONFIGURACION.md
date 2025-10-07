# 🌐 Configuración Rápida - Cambiar entre Local y Producción

## Para desarrollo LOCAL (tu PC):

```dart
// lib/config/api_config.dart
static const String baseUrl = 'http://192.168.0.107:3000/api';
```

**Iniciar backend local:**
```bash
cd c:\flutter\crm\backend
node server.js
```

---

## Para PRODUCCIÓN (Hostinger):

### Paso 1: Empaquetar el backend

En Windows, ejecuta:
```batch
cd c:\flutter\crm\backend
deploy-package.bat
```

Esto creará `backend-hostinger.zip`

### Paso 2: Subir a Hostinger

1. Accede a tu panel de Hostinger
2. Ve a "Archivos" → "Administrador de archivos"
3. Navega a `public_html/` (o crea una carpeta `api/`)
4. Sube el archivo `backend-hostinger.zip`
5. Extrae el ZIP en el servidor

### Paso 3: Configurar en Hostinger

Conéctate por SSH:
```bash
ssh usuario@tudominio.com -p 65002
cd public_html/api
bash deploy-hostinger.sh
```

### Paso 4: Configurar el dominio

**Opción A - Usar subdominio (recomendado):**
1. En Hostinger, crea subdominio: `api.tudominio.com`
2. Apunta a la carpeta donde está el backend
3. Activa SSL gratuito

Tu URL será: `https://api.tudominio.com/api`

**Opción B - Usar dominio principal con carpeta:**
Si usas `tudominio.com/api`:
Tu URL será: `https://tudominio.com/api`

### Paso 5: Actualizar la app Flutter

```dart
// lib/config/api_config.dart
static const String baseUrl = 'https://api.tudominio.com/api';
```

Recompilar la app:
```bash
cd c:\flutter\crm
flutter clean
flutter pub get
flutter build apk --release
```

### Paso 6: Instalar APK de producción

```bash
adb -s 50c9153e install -r build\app\outputs\flutter-apk\app-release.apk
```

---

## URLs según configuración:

| Entorno | Base URL | Notas |
|---------|----------|-------|
| Local (PC) | `http://192.168.0.107:3000/api` | Debe estar en la misma WiFi |
| Local (emulador) | `http://10.0.2.2:3000/api` | Para Android emulator |
| Producción (subdominio) | `https://api.tudominio.com/api` | Recomendado ✅ |
| Producción (carpeta) | `https://tudominio.com/api` | Alternativa |

---

## Verificar que el backend funciona:

### En Local:
```bash
curl http://192.168.0.107:3000/api/dashboard/stats
```

### En Producción:
```bash
curl https://api.tudominio.com/api/dashboard/stats
```

Deberías recibir un error 401 (Unauthorized), lo cual es correcto porque no enviaste token.

Para probar login:
```bash
curl -X POST https://api.tudominio.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@crm.com","password":"password123"}'
```

---

## Solución de Problemas

### ❌ Error: "Connection timeout"
- Verifica que el servidor esté corriendo: `pm2 status`
- Revisa los logs: `pm2 logs crm-backend`
- Verifica la URL en `api_config.dart`

### ❌ Error: "SSL handshake failed"
- Asegúrate de que SSL esté activado en Hostinger
- Usa `https://` no `http://`

### ❌ Error: "404 Not Found"
- Verifica que el archivo `.htaccess` esté en el servidor
- Confirma que el directorio raíz está correctamente configurado

### ❌ Backend no inicia en Hostinger
```bash
# Ver logs de error
pm2 logs crm-backend --err

# Reiniciar
pm2 restart crm-backend

# Si sigue fallando, iniciar manualmente
node server.js
```

---

## Comandos útiles:

```bash
# Ver estado del servidor
pm2 status

# Ver logs en tiempo real
pm2 logs crm-backend

# Reiniciar servidor
pm2 restart crm-backend

# Detener servidor
pm2 stop crm-backend

# Eliminar del PM2
pm2 delete crm-backend

# Ver uso de recursos
pm2 monit
```

---

## 🎯 Checklist de Despliegue:

- [ ] Empaquetar backend con `deploy-package.bat`
- [ ] Subir ZIP a Hostinger via FTP
- [ ] Extraer archivos en el servidor
- [ ] Ejecutar `deploy-hostinger.sh` via SSH
- [ ] Crear subdominio `api.tudominio.com`
- [ ] Activar SSL para el subdominio
- [ ] Actualizar `baseUrl` en `api_config.dart`
- [ ] Compilar APK de release
- [ ] Probar login en la app
- [ ] ✅ ¡Listo para producción!
