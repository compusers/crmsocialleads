@echo off
REM Script para empaquetar el backend para subir a Hostinger
REM Uso: deploy-package.bat

echo ========================================
echo   Empaquetando Backend para Hostinger
echo ========================================
echo.

REM Crear directorio temporal
if exist deploy rmdir /s /q deploy
mkdir deploy

echo [1/5] Copiando archivos esenciales...
copy server.js deploy\
copy .env.production deploy\.env
copy package.json deploy\
copy ecosystem.config.js deploy\
copy .htaccess deploy\
copy DEPLOYMENT.md deploy\
copy deploy-hostinger.sh deploy\

echo [2/5] Creando estructura de directorios...
mkdir deploy\logs

echo [3/5] Creando archivo README...
echo # Backend CRM - Listo para Hostinger > deploy\README.txt
echo. >> deploy\README.txt
echo 1. Sube todos estos archivos a tu hosting >> deploy\README.txt
echo 2. Conecta por SSH >> deploy\README.txt
echo 3. Ejecuta: bash deploy-hostinger.sh >> deploy\README.txt
echo 4. Verifica: pm2 status >> deploy\README.txt
echo. >> deploy\README.txt
echo Mas informacion en DEPLOYMENT.md >> deploy\README.txt

echo [4/5] Creando archivo ZIP...
powershell Compress-Archive -Path deploy\* -DestinationPath backend-hostinger.zip -Force

echo [5/5] Limpiando archivos temporales...
rmdir /s /q deploy

echo.
echo ========================================
echo   ^¡Empaquetado completado!
echo ========================================
echo.
echo El archivo 'backend-hostinger.zip' esta listo
echo Subelo a tu hosting de Hostinger via FTP/SFTP
echo.
echo Siguiente paso:
echo 1. Extrae el ZIP en tu servidor
echo 2. Conecta por SSH
echo 3. Ejecuta: bash deploy-hostinger.sh
echo.
pause
