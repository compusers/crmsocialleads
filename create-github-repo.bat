@echo off
echo ============================================
echo    CREAR REPOSITORIO EN GITHUB
echo ============================================
echo.
echo 1. Abriendo GitHub en tu navegador...
echo.
start https://github.com/new?name=crm-backend&description=Backend+API+para+CRM+con+Node.js+y+MySQL&visibility=public
echo.
echo 2. En la pagina que se abrio:
echo    - Nombre: crm-backend (ya deberia estar puesto)
echo    - Visibilidad: Public (IMPORTANTE para Render gratis)
echo    - NO marques "Add a README file"
echo    - Clic en "Create repository"
echo.
echo 3. Despues de crear el repositorio, vuelve aqui y presiona ENTER
echo.
pause
echo.
echo ============================================
echo    SUBIENDO CODIGO A GITHUB
echo ============================================
echo.
echo Ejecutando: git push -u origin main
echo.
git push -u origin main
echo.
if %errorlevel% equ 0 (
    echo ============================================
    echo    EXITO! Codigo subido a GitHub
    echo ============================================
    echo.
    echo Ahora ve a: https://render.com
    echo.
    echo SIGUIENTE PASO:
    echo 1. Registrate en Render con tu cuenta de GitHub
    echo 2. Clic en "New +" -^> "Web Service"
    echo 3. Conecta el repositorio "crm-backend"
    echo.
) else (
    echo ============================================
    echo    ERROR al subir el codigo
    echo ============================================
    echo.
    echo Asegurate de haber creado el repositorio en GitHub
    echo.
)
pause
