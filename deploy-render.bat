@echo off
echo ============================================
echo    DESPLIEGUE DEL BACKEND EN RENDER
echo ============================================
echo.
echo Este script te ayudara a desplegar el backend en Render.
echo.
echo PASOS A SEGUIR:
echo.
echo 1. Crea una cuenta en GitHub si no tienes: https://github.com
echo 2. Crea un repositorio llamado 'crm-backend' (publico)
echo 3. Ejecuta los comandos que se muestran abajo
echo.
echo ============================================
echo.

set /p username="Ingresa tu usuario de GitHub: "

echo.
echo ============================================
echo    COMANDOS A EJECUTAR
echo ============================================
echo.
echo Copia y ejecuta estos comandos UNO POR UNO:
echo.
echo cd c:\flutter\crm\backend
echo git remote add origin https://github.com/%username%/crm-backend.git
echo git branch -M main
echo git push -u origin main
echo.
echo ============================================
echo.
echo Despues de subir el codigo a GitHub:
echo.
echo 4. Ve a: https://render.com
echo 5. Registrate con tu cuenta de GitHub
echo 6. Clic en "New +" ^> "Web Service"
echo 7. Conecta tu repositorio 'crm-backend'
echo 8. Configuracion:
echo    - Name: crm-backend
echo    - Runtime: Node
echo    - Build Command: npm install
echo    - Start Command: node server.js
echo    - Plan: Free
echo.
echo 9. Agrega las variables de entorno (ver DEPLOY-BACKEND.md)
echo 10. Clic en "Create Web Service"
echo.
echo ============================================
pause
