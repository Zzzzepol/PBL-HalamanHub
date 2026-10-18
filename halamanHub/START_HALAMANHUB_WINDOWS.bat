@echo off
setlocal EnableExtensions

rem The gateway window calls this same file with --gateway so it can reconnect
rem after an ESP32 unplug or COM-port change.
if /I "%~1"=="--gateway" goto gateway

cd /d "%~dp0"
echo Starting HalamanHub from %CD%

if not exist "server\package.json" (
  echo ERROR: Put this file in the HalamanHub project folder.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js and npm are required. Install Node.js, then reopen this file.
  pause
  exit /b 1
)

where py >nul 2>&1
if errorlevel 1 (
  echo ERROR: Python's Windows launcher ^(py^) is required for the USB gateway.
  pause
  exit /b 1
)

py -c "import serial" >nul 2>&1
if errorlevel 1 (
  echo ERROR: pyserial is missing. Run: py -m pip install pyserial
  pause
  exit /b 1
)

if not exist "server\.env" (
  echo ERROR: server\.env is missing. Set up the local MongoDB URI and device token first.
  pause
  exit /b 1
)

if not exist "node_modules\concurrently\package.json" (
  echo ERROR: Admin dependencies are missing. Run npm install in the project folder.
  pause
  exit /b 1
)
if not exist "server\node_modules\express\package.json" (
  echo ERROR: Server dependencies are missing. Run npm install in the server folder.
  pause
  exit /b 1
)
if not exist "mapili\node_modules\react-scripts\package.json" (
  echo ERROR: Customer shop dependencies are missing. Run npm install in the mapili folder.
  pause
  exit /b 1
)

rem MongoDB Community Server normally runs as a Windows service.
sc query MongoDB >nul 2>&1
if errorlevel 1 (
  echo WARNING: The MongoDB service was not found. Check that local MongoDB is running.
) else (
  sc query MongoDB | findstr /C:"RUNNING" >nul
  if errorlevel 1 (
    echo Starting the MongoDB service...
    sc start MongoDB >nul 2>&1
    timeout /t 2 /nobreak >nul
    sc query MongoDB | findstr /C:"RUNNING" >nul
    if errorlevel 1 echo WARNING: MongoDB did not start. Start its service as Administrator.
  )
)

set "ESP32_PORT=%~1"
echo Opening admin, customer shop, and USB gateway windows...
start "HalamanHub Admin and Server" /D "%~dp0" "%ComSpec%" /k call npm run dev
start "HalamanHub Customer Shop" /D "%~dp0mapili" "%ComSpec%" /k call npm start
start "HalamanHub USB Gateway" /D "%~dp0" "%ComSpec%" /k call "%~f0" --gateway "%ESP32_PORT%"

echo.
echo Admin: http://localhost:3000
echo Shop:  http://localhost:3001
echo API:   http://localhost:4000/api/health
if defined ESP32_PORT (
  echo ESP32 port: %ESP32_PORT%
) else (
  echo ESP32 port: automatic detection
)
echo Keep the three new windows open while using HalamanHub.
echo Close each window or press Ctrl+C in it to stop that part.
exit /b 0

:gateway
cd /d "%~dp0server"
:gateway_retry
echo.
echo Waiting for the ESP32 USB connection. Press Ctrl+C to stop.
if "%~2"=="" (
  call npm run usb-gateway
) else (
  call npm run usb-gateway -- --port "%~2"
)
echo Gateway stopped. Checking the USB connection again in 5 seconds...
timeout /t 5 /nobreak >nul
goto gateway_retry
