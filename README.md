# CRM Backend API

Sistema de backend para CRM con Node.js, Express y MySQL.

## 🚀 Deploy en Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com)

### Variables de Entorno Requeridas:

```
NODE_ENV=production
PORT=3000
DB_HOST=srv452.hstgr.io
DB_USER=u361269377_appcrm
DB_PASSWORD=8x4kOIa/U;I
DB_NAME=u361269377_appcrm
DB_PORT=3306
JWT_SECRET=crm_secret_key_2025_production_secure_32chars_minimum
JWT_EXPIRES_IN=24h
ALLOWED_ORIGINS=*
FCM_SERVER_KEY=vDCkEs8kRt89C7UWyGjB5jQaEq60hNQ36ppwJz3v9pg
```

## 📦 Instalación Local

```bash
npm install
node server.js
```

## 🔗 Endpoints

- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/register` - Registrar usuario
- `GET /api/dashboard/stats` - Estadísticas del dashboard
- `GET /api/leads` - Obtener leads
- `POST /api/leads` - Crear lead
- Y más...

## 📄 Licencia

MIT
