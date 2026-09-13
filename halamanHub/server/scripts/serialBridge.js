// HalamanHub — USB Serial bridge
//
// Reads live telemetry JSON printed by the ESP32 over USB (no WiFi/internet
// needed — this is just the same cable already used for power/flashing) and
// forwards each reading into the SAME ingestion endpoint the WiFi path uses
// (POST http://localhost:4000/api/sensor-data), so the admin dashboard
// updates live either way.
//
// Run this ALONGSIDE your normal server, in a second terminal:
//   cd server
//   node scripts/serialBridge.js            (auto-detects the ESP32's port)
//   node scripts/serialBridge.js COM5       (or force a specific port)

require('dotenv').config();
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const http = require('http');

const BAUD_RATE = 115200; // must match Serial.begin(115200) in the .ino
const LOCAL_API = `http://127.0.0.1:${process.env.PORT || 4000}/api/sensor-data`;

function postTelemetry(json) {
  const body = Buffer.from(json);
  const req = http.request(
    LOCAL_API,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
    },
    (res) => {
      if (res.statusCode >= 400) {
        console.warn(`[serial-bridge] Server rejected reading (HTTP ${res.statusCode})`);
      } else {
        console.log(`[serial-bridge] Reading forwarded to dashboard (HTTP ${res.statusCode})`);
      }
    }
  );
  req.on('error', (err) => console.error('[serial-bridge] POST failed:', err.message));
  req.write(body);
  req.end();
}

async function findEsp32Port() {
  const ports = await SerialPort.list();
  // Most ESP32 dev boards enumerate as a CP210x or CH340 USB-to-UART bridge
  const match = ports.find((p) =>
    /cp210|ch340|silicon labs|usb.serial/i.test(`${p.manufacturer || ''} ${p.friendlyName || ''}`)
  );
  return match ? match.path : null;
}

async function start() {
  const forcedPort = process.argv[2];
  const portPath = forcedPort || (await findEsp32Port());

  if (!portPath) {
    console.error('[serial-bridge] No ESP32 found automatically.');
    console.error('Plug it in via USB, then check Device Manager (Windows) for its COM port, and run:');
    console.error('  node scripts/serialBridge.js COM5   (use your actual port)');
    process.exit(1);
  }

  const port = new SerialPort({ path: portPath, baudRate: BAUD_RATE });
  const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

  port.on('open', () => {
    console.log(`[serial-bridge] Connected to ESP32 on ${portPath}`);
    console.log('[serial-bridge] Reading offline telemetry — no WiFi/internet needed for this path.');
  });

  port.on('error', (err) => {
    console.error('[serial-bridge] Port error:', err.message);
  });

  parser.on('data', (line) => {
    line = line.trim();
    if (!line.startsWith('TELEMETRY:')) return; // ignore normal debug prints

    const json = line.slice('TELEMETRY:'.length);
    try {
      JSON.parse(json); // validate before sending
      postTelemetry(json);
    } catch (err) {
      console.warn('[serial-bridge] Skipped malformed line:', err.message);
    }
  });
}

start();
