const fs = require('fs');
const path = require('path');

const apkPath = path.join(__dirname, 'android/app/build/outputs/apk/debug/app-debug.apk');
if (fs.existsSync(apkPath)) {
    console.log('Found APK, deleting...');
    fs.unlinkSync(apkPath);
    console.log('APK deleted.');
} else {
    console.log('APK already deleted or not found.');
}
