@echo off
echo Starting NPM Install...
cmd /c npm install --no-fund --no-audit
if %errorlevel% neq 0 exit /b %errorlevel%

echo Starting NPM Build...
cmd /c npm run build
if %errorlevel% neq 0 exit /b %errorlevel%

echo Starting Capacitor Sync...
cmd /c npx cap sync android
if %errorlevel% neq 0 exit /b %errorlevel%

echo Starting Gradle Build...
cd android
call gradlew.bat assembleDebug --no-daemon --console=plain
if %errorlevel% neq 0 exit /b %errorlevel%

echo Build SUCCESS
