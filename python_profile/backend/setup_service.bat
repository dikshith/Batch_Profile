@echo off
setlocal enabledelayedexpansion

:: === Check for admin privileges ===
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrative privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"

set SERVICE_NAME=FlaskAppService
set SERVICE_DISPLAY=Flask App Service
set SERVICE_DESC=Runs Flask backend as Windows service
set PYTHON_EXE=C:\Python313\python.exe
set APP_PATH=%cd%\app.py
set NSSM_PATH=%cd%\nssm.exe
set LOG_PATH=%cd%\service_log.txt
set ERR_PATH=%cd%\service_error.txt
set VENV_PATH=%cd%\venv

:: === Download NSSM if missing ===
if not exist "%NSSM_PATH%" (
    echo NSSM not found, downloading...
    powershell -Command ^
        "Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile 'nssm.zip';" ^
        "Expand-Archive -Path 'nssm.zip' -DestinationPath '.' -Force;" ^
        "Copy-Item '.\nssm-2.24\win64\nssm.exe' . -Force;" ^
        "Remove-Item 'nssm.zip','nssm-2.24' -Recurse -Force"
)

echo ======================================================
echo Removing old service (if exists)...
"%NSSM_PATH%" stop %SERVICE_NAME% >nul 2>&1
"%NSSM_PATH%" remove %SERVICE_NAME% confirm >nul 2>&1

echo Creating new Windows service...
"%NSSM_PATH%" install %SERVICE_NAME% "%cd%\run_server.bat"
"%NSSM_PATH%" set %SERVICE_NAME% AppDirectory "%cd%"
"%NSSM_PATH%" set %SERVICE_NAME% DisplayName "%SERVICE_DISPLAY%"
"%NSSM_PATH%" set %SERVICE_NAME% Description "%SERVICE_DESC%"
"%NSSM_PATH%" set %SERVICE_NAME% Start SERVICE_AUTO_START
"%NSSM_PATH%" set %SERVICE_NAME% ObjectName "NT AUTHORITY\LocalService"
"%NSSM_PATH%" set %SERVICE_NAME% AppStdout "%LOG_PATH%"
"%NSSM_PATH%" set %SERVICE_NAME% AppStderr "%ERR_PATH%"
"%NSSM_PATH%" set %SERVICE_NAME% AppRestartDelay 5000
"%NSSM_PATH%" set %SERVICE_NAME% AppThrottle 1500
"%NSSM_PATH%" set %SERVICE_NAME% AppStopMethodSkip 0

:: === CRITICAL FIX: disable Flask auto-reloader ===
"%NSSM_PATH%" set %SERVICE_NAME% AppParameters "%APP_PATH% --no-debug"

:: === Start the service ===
echo Starting service...
"%NSSM_PATH%" start %SERVICE_NAME%

echo ======================================================
echo ✅ Flask service installed and started successfully!
echo Service Name: %SERVICE_NAME%
echo Logs:
echo   %LOG_PATH%
echo   %ERR_PATH%
echo ------------------------------------------------------
echo Commands:
echo   "%NSSM_PATH%" stop %SERVICE_NAME%
echo   "%NSSM_PATH%" remove %SERVICE_NAME% confirm
echo ======================================================
pause
