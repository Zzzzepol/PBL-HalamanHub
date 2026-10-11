require('dotenv').config();
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const uri = process.env.IOT_MONGODB_URI;
if (!uri) {
  console.error('Set IOT_MONGODB_URI in server/.env before creating a local backup.');
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupRoot = path.resolve(__dirname, '..', 'backups');
const backupDirectory = path.join(backupRoot, `local-iot-${timestamp}`);
fs.mkdirSync(backupDirectory, { recursive: true });

const command = process.env.MONGODUMP_BIN || 'mongodump';
const dump = spawn(command, ['--uri', uri, '--gzip', '--out', backupDirectory], {
  stdio: ['ignore', 'inherit', 'pipe'],
  windowsHide: true,
});

let errorOutput = '';
dump.stderr.on('data', (chunk) => { errorOutput += chunk.toString(); });
dump.on('error', (error) => {
  console.error(`Could not start mongodump: ${error.message}`);
  console.error('Install MongoDB Database Tools or set MONGODUMP_BIN to its executable path.');
  process.exitCode = 1;
});
dump.on('close', (code) => {
  if (code === 0) {
    console.log(`Local plant database backup saved to: ${backupDirectory}`);
    return;
  }

  const safeError = errorOutput.trim().replaceAll(uri, '[database URI hidden]');
  console.error(`mongodump stopped with exit code ${code ?? 'unknown'}.`);
  if (safeError) console.error(safeError);
  process.exitCode = 1;
});
