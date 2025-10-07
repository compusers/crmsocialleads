#!/bin/bash

# Script para configurar el backend en Hostinger
# Uso: ./deploy-hostinger.sh

echo "🚀 Configurando backend para Hostinger..."

# 1. Instalar dependencias
echo "📦 Instalando dependencias..."
npm install --production

# 2. Copiar archivo de producción
echo "📝 Configurando variables de entorno..."
cp .env.production .env

# 3. Crear directorio de logs
echo "📁 Creando directorio de logs..."
mkdir -p logs

# 4. Iniciar con PM2
echo "🔄 Iniciando servidor con PM2..."
pm2 start ecosystem.config.js

# 5. Guardar configuración PM2
echo "💾 Guardando configuración PM2..."
pm2 save

# 6. Configurar auto-inicio
echo "🔧 Configurando auto-inicio..."
pm2 startup

echo "✅ ¡Despliegue completado!"
echo ""
echo "📊 Ver estado: pm2 status"
echo "📋 Ver logs: pm2 logs crm-backend"
echo "🔄 Reiniciar: pm2 restart crm-backend"
echo ""
echo "🌐 Tu API debería estar disponible en: https://api.tudominio.com/api"
