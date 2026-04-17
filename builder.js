const { execSync } = require('child_process');
const fs = require('fs');

function run(cmd) {
    console.log(`\n\n=== RUNNING: ${cmd} ===`);
    try {
        const out = execSync(cmd, { stdio: 'pipe' }).toString();
        fs.appendFileSync('builder_log.txt', out);
        console.log(`SUCCESS`);
    } catch (e) {
        fs.appendFileSync('builder_log.txt', `\nERROR: ${e.message}\n${e.stdout?.toString()}\n${e.stderr?.toString()}`);
        console.log(`ERROR: ${e.message}`);
        process.exit(1);
    }
}

fs.writeFileSync('builder_log.txt', 'Starting Builder...\n');
// run('npm install --no-fund --no-audit');
run('npm run build');
// By-pass the prompt for telemetry on cap sync!
process.env.CAPACITOR_TELEMETRY = 'false';
run('npx cap sync android');
process.chdir('android');
run('.\\gradlew.bat clean assembleDebug -PbuildDir=build_new2 --no-daemon --console=plain');
console.log('ALL DONE');
