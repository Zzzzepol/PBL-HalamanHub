// HalamanHub Server — Live sensor state (in-memory, no MongoDB involved)
//
// Holds only the MOST RECENT reading, purely in RAM. This exists so the
// dashboard can keep showing live sensor data even when MongoDB itself is
// unreachable (e.g. no internet, cloud Atlas down) — the ESP32 → serial
// bridge → here → Socket.io path never touches the database.
//
// This intentionally does NOT persist anything or keep history — that's
// what MongoDB + SensorReading is for when it's available. This is only
// the "last known values" fallback.

let latestReading = null;

function setLiveReading(reading) {
  latestReading = reading;
}

function getLiveReading() {
  return latestReading;
}

module.exports = { setLiveReading, getLiveReading };