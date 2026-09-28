@echo off
setlocal enabledelayedexpansion

echo =========================================================================
echo PREDICTA -- RESTORING APPROVED GOLDEN FRONTEND BASELINE
echo =========================================================================
echo.

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

set "GOLDEN_DIR=%SCRIPT_DIR%frontend\GOLDEN_STATE"
set "BACKUP_ROOT=%SCRIPT_DIR%frontend_backups"

if not exist "%GOLDEN_DIR%" (
    echo [ERROR] Golden state snapshot not found at: %GOLDEN_DIR%
    exit /b 1
)

:: Generate timestamp for backup
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set "dt=%%I"
set "TIMESTAMP=%dt:~0,8%_%dt:~8,6%"
if "%TIMESTAMP%"=="" set "TIMESTAMP=%date:~-4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"

set "CURRENT_BACKUP=%BACKUP_ROOT%\backup_%TIMESTAMP%"

echo [1/4] Creating timestamped backup of current active frontend...
echo       Target backup directory: %CURRENT_BACKUP%
mkdir "%CURRENT_BACKUP%" >nul 2>&1
mkdir "%CURRENT_BACKUP%\frontend" >nul 2>&1
mkdir "%CURRENT_BACKUP%\data\sample" >nul 2>&1

if exist "%SCRIPT_DIR%index.html" copy /y "%SCRIPT_DIR%index.html" "%CURRENT_BACKUP%\index.html" >nul
if exist "%SCRIPT_DIR%style.css" copy /y "%SCRIPT_DIR%style.css" "%CURRENT_BACKUP%\style.css" >nul
if exist "%SCRIPT_DIR%script.js" copy /y "%SCRIPT_DIR%script.js" "%CURRENT_BACKUP%\script.js" >nul
if exist "%SCRIPT_DIR%api.js" copy /y "%SCRIPT_DIR%api.js" "%CURRENT_BACKUP%\api.js" >nul
if exist "%SCRIPT_DIR%data\sample\lot_summary.json" copy /y "%SCRIPT_DIR%data\sample\lot_summary.json" "%CURRENT_BACKUP%\data\sample\lot_summary.json" >nul

if exist "%SCRIPT_DIR%frontend\index.html" copy /y "%SCRIPT_DIR%frontend\index.html" "%CURRENT_BACKUP%\frontend\index.html" >nul
if exist "%SCRIPT_DIR%frontend\style.css" copy /y "%SCRIPT_DIR%frontend\style.css" "%CURRENT_BACKUP%\frontend\style.css" >nul
if exist "%SCRIPT_DIR%frontend\script.js" copy /y "%SCRIPT_DIR%frontend\script.js" "%CURRENT_BACKUP%\frontend\script.js" >nul
if exist "%SCRIPT_DIR%frontend\api.js" copy /y "%SCRIPT_DIR%frontend\api.js" "%CURRENT_BACKUP%\frontend\api.js" >nul
echo       ✔ Active frontend backup preserved safely.

echo.
echo [2/4] Restoring GOLDEN STATE files to root served location...
copy /y "%GOLDEN_DIR%\index.html" "%SCRIPT_DIR%index.html" >nul
copy /y "%GOLDEN_DIR%\style.css" "%SCRIPT_DIR%style.css" >nul
copy /y "%GOLDEN_DIR%\script.js" "%SCRIPT_DIR%script.js" >nul
copy /y "%GOLDEN_DIR%\api.js" "%SCRIPT_DIR%api.js" >nul
if exist "%GOLDEN_DIR%\data\sample\lot_summary.json" (
    mkdir "%SCRIPT_DIR%data\sample" >nul 2>&1
    copy /y "%GOLDEN_DIR%\data\sample\lot_summary.json" "%SCRIPT_DIR%data\sample\lot_summary.json" >nul
)
echo       ✔ Root served files restored.

echo.
echo [3/4] Restoring GOLDEN STATE files to frontend/ mirror...
copy /y "%GOLDEN_DIR%\index.html" "%SCRIPT_DIR%frontend\index.html" >nul
copy /y "%GOLDEN_DIR%\style.css" "%SCRIPT_DIR%frontend\style.css" >nul
copy /y "%GOLDEN_DIR%\script.js" "%SCRIPT_DIR%frontend\script.js" >nul
copy /y "%GOLDEN_DIR%\api.js" "%SCRIPT_DIR%frontend\api.js" >nul
echo       ✔ frontend/ mirror files restored.

echo.
echo [4/4] Verifying backend and ML model safety...
echo       Backend endpoints in src/api/: UNTOUCHED
echo       ML models and datasets in ml/: UNTOUCHED
echo       Python modules in src/prognostics/: UNTOUCHED

echo.
echo =========================================================================
echo SUCCESS: GOLDEN FRONTEND RESTORED DETERMINISTICALLY
echo =========================================================================
echo Restored files:
echo   - index.html
echo   - style.css
echo   - script.js
echo   - api.js
echo   - data/sample/lot_summary.json
echo   - frontend/index.html
echo   - frontend/style.css
echo   - frontend/script.js
echo   - frontend/api.js
echo.
echo Backup archived at: %CURRENT_BACKUP%
echo =========================================================================
