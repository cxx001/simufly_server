const spawn = require('child_process').spawn;
const path = require('path');
const fs = require('fs');

const daemon = false;

var absScript = path.join(__dirname, 'app.js');
if (!fs.existsSync(absScript)) {
    abort('Fail to find an appropriate script to run!');
}

var ls;
var params = [absScript, 'env=production', 'type=all'];
if (daemon) {
    ls = spawn(process.execPath, params, { detached: true, stdio: 'ignore' });
    ls.unref();
    console.log('The application is running in the background now.\n');
    process.exit(0);
} else {
    ls = spawn(process.execPath, params);
    ls.stdout.on('data', function (data) {
        console.log(data.toString());
    });
    ls.stderr.on('data', function (data) {
        console.log(data.toString());
    });
}