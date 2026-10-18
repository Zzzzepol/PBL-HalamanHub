const { spawn } = require('child_process');
const path = require('path');

const python = process.platform === 'win32' ? 'py' : 'python3';
const gateway = path.join(__dirname, 'python_usb_gateway.py');
const child = spawn(python, [gateway, ...process.argv.slice(2)], { stdio: 'inherit' });

child.on('error', (error) => {
  console.error(`Could not start ${python}: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
