# 🚀 Guía de Despliegue en Hostinger

## Prerrequisitos

1. Cuenta de Hostinger con Node.js habilitado
2. Acceso SSH a tu hosting
3. Dominio configurado (ejemplo: api.tudominio.com)

## Pasos de Despliegue

### 1. Conectar por SSH

```bash
ssh usuario@tudominio.com -p 65002
```

### 2. Navegar al directorio público

```bash
cd public_html
# O si usas un subdominio:
cd domains/api.tudominio.com/public_html
```

### 3. Subir archivos del backend

Opción A - Usando FTP/SFTP:
- Sube todos los archivos de la carpeta `backend/` a tu servidor
- Asegúrate de subir: server.js, .env.production, package.json, ecosystem.config.js

Opción B - Usando Git (recomendado):
```bash
git clone https://github.com/tuusuario/crm-backend.git .
```

### 4. Instalar dependencias

```bash
npm install --production
```

### 5. Configurar variables de entorno

```bash
# Copiar el archivo de producción
cp .env.production .env

# Editar si es necesario
nano .env
```

### 6. Configurar PM2 (Process Manager)

```bash
# Instalar PM2 globalmente (si no está instalado)
npm install -g pm2

# Iniciar la aplicación
pm2 start ecosystem.config.js

# Guardar la configuración para auto-inicio
pm2 save
pm2 startup
```

### 7. Configurar el dominio/subdominio

En el panel de Hostinger:
1. Ve a "Dominios" → "Subdominios"
2. Crea un subdominio: `api.tudominio.com`
3. Apunta la raíz del documento a la carpeta donde está el backend

### 8. Configurar SSL

1. En Hostinger, ve a "Seguridad" → "SSL"
2. Activa SSL gratuito (Let's Encrypt) para `api.tudominio.com`
3. Espera 5-10 minutos para que se active

### 9. Configurar .htaccess (si usas Apache)

El archivo `.htaccess` ya está incluido y configurado.

### 10. Verificar que funciona

```bash
# Verificar estado del servidor
pm2 status

# Ver logs en tiempo real
pm2 logs crm-backend

# Probar la API
curl https://api.tudominio.com/api/health
```

## Comandos Útiles de PM2

```bash
# Ver aplicaciones activas
pm2 list

# Reiniciar aplicación
pm2 restart crm-backend

# Detener aplicación
pm2 stop crm-backend

# Ver logs
pm2 logs crm-backend

# Ver logs de errores
pm2 logs crm-backend --err

# Monitorear recursos
pm2 monit

# Eliminar de PM2
pm2 delete crm-backend
```

## Actualizar el Backend

```bash
# Detener la aplicación
pm2 stop crm-backend

# Actualizar código (si usas Git)
git pull origin main

# Instalar nuevas dependencias
npm install --production

# Reiniciar aplicación
pm2 restart crm-backend
```

## Configuración de la App Flutter

Una vez desplegado, actualiza la URL en la app Flutter:

**lib/config/api_config.dart:**
```dart
static const String baseUrl = 'https://api.tudominio.com/api';
```

Luego recompila la app:
```bash
flutter build apk --release
```

## Solución de Problemas

### El servidor no inicia
```bash
pm2 logs crm-backend --err
```

### Error de conexión a MySQL
- Verifica las credenciales en `.env`
- Confirma que Hostinger permite conexiones remotas a MySQL

### Error de permisos
```bash
chmod -R 755 .
chmod -R 644 *.js
chmod +x server.js
```

### Puerto en uso
```bash
# Cambiar el puerto en .env
PORT=3001

# O matar el proceso que usa el puerto
lsof -ti:3000 | xargs kill -9
```

## URLs de Producción

- **API Base:** https://api.tudominio.com/api
- **Login:** https://api.tudominio.com/api/auth/login
- **Dashboard:** https://api.tudominio.com/api/dashboard
- **Leads:** https://api.tudominio.com/api/leads

## Seguridad

✅ SSL/HTTPS habilitado
✅ Variables de entorno protegidas
✅ CORS configurado
✅ Helmet para seguridad HTTP
✅ Rate limiting activado
✅ JWT para autenticación

## Monitoreo

- Logs de error: `backend/logs/err.log`
- Logs de salida: `backend/logs/out.log`
- Logs combinados: `backend/logs/combined.log`

## Soporte

Si tienes problemas:
1. Revisa los logs: `pm2 logs crm-backend`
2. Verifica el estado: `pm2 status`
3. Reinicia el servidor: `pm2 restart crm-backend`
4. Contacta soporte de Hostinger si es problema del hosting
