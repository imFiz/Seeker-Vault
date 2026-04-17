echo "Starting Build..." > build_log.txt
npm run build >> build_log.txt 2>&1
echo "Cap Sync..." >> build_log.txt
npx cap sync android >> build_log.txt 2>&1
echo "Gradle Build..." >> build_log.txt
cd android
call gradlew.bat assembleDebug -PbuildDir=build_new --no-daemon --console=plain >> ..\build_log.txt 2>&1
echo "Done" >> ..\build_log.txt
