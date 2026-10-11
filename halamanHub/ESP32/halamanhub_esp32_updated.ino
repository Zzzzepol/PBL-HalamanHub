#include <HardwareSerial.h>
#include <DHT.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <string.h>
#include <math.h>
#include <stdint.h>
#include <esp_system.h>
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"

// Copy halamanhub_config.example.h to halamanhub_config.h and enter your
// local Wi-Fi and laptop address there. No internet access is needed here.
#if __has_include("halamanhub_config.h")
#include "halamanhub_config.h"
#else
#define HALAMANHUB_WIFI_SSID "YOUR_LOCAL_WIFI_NAME"
#define HALAMANHUB_WIFI_PASS "YOUR_LOCAL_WIFI_PASSWORD"
#define HALAMANHUB_LAPTOP_IP "192.168.1.10"
#define HALAMANHUB_DEVICE_ID "ESP32-01"
#define HALAMANHUB_DEVICE_TOKEN ""
#endif

const char* WIFI_SSID = HALAMANHUB_WIFI_SSID;
const char* WIFI_PASS = HALAMANHUB_WIFI_PASS;
const char* DEVICE_ID = HALAMANHUB_DEVICE_ID;
String SERVER_URL;
String CONTROL_URL;
Preferences controlPreferences;

const unsigned long SENSOR_STALE_AFTER_MS = 12000UL;
const unsigned long CONTROL_POLL_INTERVAL_MS = 5000UL;
const unsigned long MANUAL_CONTROL_LOSS_MS = 15000UL;
const size_t TELEMETRY_PAYLOAD_SIZE = 850;
const UBaseType_t TELEMETRY_BUFFER_CAPACITY = 60; // About two minutes at a 2-second sample rate.

struct ControlSettingsSnapshot {
  bool autoMode;
  float dryThreshold;
  float wetThreshold;
  bool manualPump;
  bool manualSolenoid;
  float tankEmptyDistanceCm;
  float tankFullDistanceCm;
  float tankLowThresholdPercent;
  unsigned long pumpOnTimeMs;
  unsigned long soakTimeMs;
  unsigned long settingsVersion;
  unsigned long lockoutResetVersion;
  int64_t serverTimeMs;
  unsigned long snapshotUptimeMs;
};

struct TelemetryPacket {
  char payload[TELEMETRY_PAYLOAD_SIZE];
};

QueueHandle_t g_controlSettingsQueue = nullptr;
QueueHandle_t g_telemetryQueue = nullptr;
ControlSettingsSnapshot g_networkSettings = {};
char g_bootSessionId[80] = { 0 };
uint32_t g_sampleSequence = 0;
uint32_t g_bufferDroppedSamples = 0;
uint32_t g_bufferRestartLossCount = 0;
bool g_outageQueueDirty = false;
int64_t g_serverTimeOffsetMs = 0;
bool g_serverTimeSynced = false;

// --- Relay Active Logic ---
#define RELAY_ON  LOW
#define RELAY_OFF HIGH

// --- DHT22 Sensor ---
#define DHT_PIN  14
#define DHT_TYPE DHT22

// --- RS485 Sensor ---
#define RX2_PIN  16
#define TX2_PIN  17
#define DE_PIN    2
#define RE_PIN    4

#define RELAY_PUMP      27
#define RELAY_SOLENOID  26

// --- Ultrasonic Water Level Sensor (JSN-SR04T / AJ-SR04M) ---
#define ULTRASONIC_TRIG_PIN 33
#define ULTRASONIC_ECHO_PIN 32   // through a voltage divider — see wiring notes

// --- TDS Sensor (water electrical conductivity / quality) ---
#define TDS_PIN 35   // ADC1 — safe to read with WiFi active

// --- pH-4502C Sensor Board + E201-BNC Electrode ---
#define PH_PIN 34    // ADC1 — safe to read with WiFi active
// Two-point calibration — dip the probe in pH 4.0 and pH 7.0 buffer
// solution, read the raw voltage each time, and replace these:
#define PH7_VOLTAGE 2.50   // Po voltage measured in pH 7.0 buffer
#define PH4_VOLTAGE 2.68   // Po voltage measured in pH 4.0 buffer


// --- Moisture Thresholds (%) — now just the initial defaults ---
// (used only until the first successful fetchControlSettings() call)
#define MOISTURE_DRY  30.0
#define MOISTURE_WET  60.0

// --- Pulse Irrigation / Cycle-and-Soak State Machine ---
// Tune these three for your soil texture — see the notes at the bottom
// of the accompanying explanation for clay vs. sandy soil guidance.
// Defaults only — overwritten by fetchControlSettings() from the
// admin panel's "Pulse irrigation timing" controls (Irrigation tab). Kept
// as variables, not #define, specifically so they CAN change at runtime
// without reflashing — handy while you're still testing thresholds.
unsigned long g_pumpOnTimeMs = 60000UL;   // 60s pulse — how long the pump runs per cycle
unsigned long g_soakTimeMs   = 300000UL;  // 5 min soak — time given for water to percolate
#define MAX_CYCLES        5         // fail-safe cap before SAFETY_LOCKOUT

const byte QUERY_FRAME[] = { 0x01, 0x03, 0x00, 0x00, 0x00, 0x07, 0x04, 0x08 };
const int  RESPONSE_LEN  = 19;

DHT dht(DHT_PIN, DHT_TYPE);

bool pumpOn      = false;
bool solenoidOn  = false;

// Global sensor values for telemetry
float g_moisture = 0, g_soilTemp = 0, g_ec = 0, g_ph = 0;
float g_nitrogen = 0, g_phosphorus = 0, g_potassium = 0;
float g_dhtTemp = 0, g_dhtHumid = 0;
bool g_airReadingValid = false;
bool g_hasAirReading = false;
unsigned long g_lastAirReadingAt = 0;

float g_distanceCm    = 0;
float g_levelPercent  = 0;
bool  g_waterAvailable = false;
bool  g_hasSoilReading = false;
bool  g_hasTankReading = false;
unsigned long g_lastSoilReadingAt = 0;
unsigned long g_lastTankReadingAt = 0;

// TDS / pH / 3-state tank level — Rainwater Harvesting sensors
float  g_tds            = 0;
float  g_waterPh        = 0;
String g_tankStatus3    = "Low"; // "Low" | "Medium" | "Full"
bool   g_tdsSensorOnline = true; // false = probe unplugged/not detected
bool   g_tdsStable       = true; // false = last batch was too noisy to trust

// Raw ADC counts (12-bit, 0-4095) below this = "nothing plugged in", not
// "perfectly pure water". Real rainwater always carries some dissolved
// minerals, so a reading pinned at the floor only happens when the probe
// (or its power/ground wiring) is disconnected. Adjust up slightly if you
// see false "offline" flags with a genuinely connected probe.
#define TDS_DISCONNECT_RAW_THRESHOLD 15

// Coefficient of variation (stddev/mean) above which a batch of samples is
// considered too noisy to trust. Start at 0.15 (15%) and tune it: log the
// cv value for a few minutes of normal, quiet operation to see your real
// noise floor, then set this comfortably above that.
#define TDS_MAX_COEFF_VARIATION 0.15

// Calibration factor for the TDS probe. Starts at 1.0 — no effect until you
// tune it. To calibrate: dip the probe in a known TDS reference solution
// (commonly sold as ~342ppm, 500ppm, or 1000ppm calibration fluid), watch
// what the serial monitor reports, then set this to:
//   TDS_CALIBRATION_FACTOR = (known reference ppm) / (reading your serial monitor shows)
// Example: reference solution is 342ppm, serial monitor shows 300ppm before
// calibrating -> set this to 342.0 / 300.0 = 1.14
#define TDS_CALIBRATION_FACTOR 1.0

// Control state fetched from the server each cycle — replaces the old
// hardcoded MOISTURE_DRY / MOISTURE_WET #defines
String g_mode           = "auto";
float  g_thresholdDry   = MOISTURE_DRY;
float  g_thresholdWet   = MOISTURE_WET;
bool   g_manualPump     = false;
bool   g_manualSolenoid = false;

// Ultrasonic tank calibration — fetched from the server, adjustable from admin
float g_tankEmptyDistanceCm     = 100; // reading when tank is empty
float g_tankFullDistanceCm      = 10;  // reading when tank is full
float g_tankLowThresholdPercent = 20;  // below this % counts as LOW

// ---- Cycle-and-Soak state machine state ----
enum IrrigationState { IDLE, WATERING, SOAKING, SAFETY_LOCKOUT };
IrrigationState g_irrigationState = IDLE;
unsigned long   g_stateEnteredAt  = 0;
int             g_currentCycle    = 0;
bool            g_lockoutError    = false;
unsigned long   g_appliedSettingsVersion = 0;
unsigned long   g_appliedLockoutResetVersion = 0;
unsigned long   g_pendingLockoutResetVersion = 0;
unsigned long   g_lastControlResponseAt = 0;
bool            g_hasControlResponse = false;
bool            g_manualFailsafeLatched = false;


unsigned long g_lastWifiAttempt = 0;
const unsigned long WIFI_RETRY_COOLDOWN_MS = 10000; // don't retry more than once per 10s
bool g_wifiWasConnected = false; // tracks previous state so we print on CHANGE, not spam every loop

// Non-blocking, but still prints the same "Connecting..." / "Connected! IP:
// ..." lines you're used to on the Serial monitor — they just print as
// WiFi.status() actually changes (checked every loop() iteration), instead
// of freezing the whole loop() for up to 10 seconds to wait for them.
void connectWiFi() {
  bool isConnected = (WiFi.status() == WL_CONNECTED);

  if (isConnected && !g_wifiWasConnected) {
    Serial.println("Wi-Fi Connected! IP: " + WiFi.localIP().toString());
  } else if (!isConnected && g_wifiWasConnected) {
    Serial.println("Wi-Fi disconnected.");
  }
  g_wifiWasConnected = isConnected;

  if (isConnected) return;
  if (millis() - g_lastWifiAttempt < WIFI_RETRY_COOLDOWN_MS) return;
  g_lastWifiAttempt = millis();

  Serial.println("Connecting to Wi-Fi...");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASS);
}

void setRS485Mode(bool transmit) {
  digitalWrite(DE_PIN, transmit);
  digitalWrite(RE_PIN, transmit);
}

void restoreTelemetryBufferState() {
  Preferences telemetryPreferences;
  telemetryPreferences.begin("hh-telemetry", false);
  g_bufferRestartLossCount = telemetryPreferences.getULong("restartLosses", 0);
  const bool unsentReadingsAtRestart = telemetryPreferences.getBool("pending", false);
  if (unsentReadingsAtRestart) {
    g_bufferRestartLossCount++;
    telemetryPreferences.putULong("restartLosses", g_bufferRestartLossCount);
    telemetryPreferences.putBool("pending", false);
    Serial.println(">> The ESP32 restarted with unsent readings; the history may have a gap.");
  }
  telemetryPreferences.end();
}

void markTelemetryQueuePending() {
  if (g_outageQueueDirty) return;
  Preferences telemetryPreferences;
  telemetryPreferences.begin("hh-telemetry", false);
  telemetryPreferences.putBool("pending", true);
  telemetryPreferences.end();
  g_outageQueueDirty = true;
}

void markTelemetryQueueDrained() {
  if (!g_outageQueueDirty) return;
  Preferences telemetryPreferences;
  telemetryPreferences.begin("hh-telemetry", false);
  telemetryPreferences.putBool("pending", false);
  telemetryPreferences.end();
  g_outageQueueDirty = false;
}

uint16_t crc16(const byte *buf, int len) {
  uint16_t crc = 0xFFFF;
  for (int i = 0; i < len; i++) {
    crc ^= buf[i];
    for (int j = 0; j < 8; j++)
      crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : crc >> 1;
  }
  return crc;
}

void sendQuery() {
  setRS485Mode(HIGH);
  delayMicroseconds(200);
  Serial2.write(QUERY_FRAME, sizeof(QUERY_FRAME));
  Serial2.flush();
  delayMicroseconds(200);
  setRS485Mode(LOW);
}

bool readResponse(byte *buf) {
  unsigned long start = millis();
  int idx = 0;
  while (millis() - start < 200) {
    if (Serial2.available()) {
      buf[idx++] = Serial2.read();
      if (idx >= RESPONSE_LEN) break;
    }
  }

  if (idx < RESPONSE_LEN) {
    Serial.println("Error: RS485 response timeout");
    return false;
  }

  uint16_t calcCRC = crc16(buf, RESPONSE_LEN - 2);
  uint16_t recvCRC = (buf[RESPONSE_LEN - 1] << 8) | buf[RESPONSE_LEN - 2];
  if (calcCRC != recvCRC) {
    Serial.println("Error: RS485 CRC mismatch");
    return false;
  }

  return true;
}

// -------------------------------------------------------

bool fetchControlSettings(ControlSettingsSnapshot &current) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  http.setConnectTimeout(700);
  http.setTimeout(900);
  http.begin(CONTROL_URL);
  http.addHeader("x-device-boot-id", g_bootSessionId);
  if (strlen(HALAMANHUB_DEVICE_TOKEN) > 0) {
    http.addHeader("x-device-token", HALAMANHUB_DEVICE_TOKEN);
  }
  int httpCode = http.GET();

  if (httpCode != 200) {
    Serial.printf(">> Settings request failed (HTTP %d); keeping last saved settings\n", httpCode);
    http.end();
    return false;
  }

  String body = http.getString();
  http.end();

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    Serial.println(">> Control JSON parse error; keeping last saved settings");
    return false;
  }

  String nextMode = doc["mode"] | (current.autoMode ? "auto" : "manual");
  ControlSettingsSnapshot next = current;
  next.autoMode = nextMode == "auto";
  next.dryThreshold = doc["moistureDryThreshold"] | current.dryThreshold;
  next.wetThreshold = doc["moistureWetThreshold"] | current.wetThreshold;
  next.manualPump = doc["manualPump"] | false;
  next.manualSolenoid = doc["manualSolenoid"] | false;
  next.tankEmptyDistanceCm = doc["tankEmptyDistanceCm"] | current.tankEmptyDistanceCm;
  next.tankFullDistanceCm = doc["tankFullDistanceCm"] | current.tankFullDistanceCm;
  next.tankLowThresholdPercent = doc["tankLowThresholdPercent"] | current.tankLowThresholdPercent;
  next.pumpOnTimeMs = (doc["pumpOnTimeSec"] | (current.pumpOnTimeMs / 1000UL)) * 1000UL;
  next.soakTimeMs = (doc["soakTimeSec"] | (current.soakTimeMs / 1000UL)) * 1000UL;
  next.settingsVersion = doc["settingsVersion"] | current.settingsVersion;
  next.lockoutResetVersion = doc["lockoutResetVersion"] | current.lockoutResetVersion;
  const int64_t serverTimeMs = doc["serverTimeMs"].as<int64_t>();
  if (serverTimeMs > 0) {
    next.serverTimeMs = serverTimeMs;
    next.snapshotUptimeMs = millis();
  }

  if ((nextMode != "auto" && nextMode != "manual")
      || next.dryThreshold < 0 || next.dryThreshold > 100
      || next.wetThreshold < 0 || next.wetThreshold > 100
      || next.dryThreshold >= next.wetThreshold
      || next.tankEmptyDistanceCm <= next.tankFullDistanceCm
      || next.tankFullDistanceCm < 0
      || next.tankLowThresholdPercent < 0 || next.tankLowThresholdPercent > 100
      || next.pumpOnTimeMs < 5000UL || next.pumpOnTimeMs > 600000UL
      || next.soakTimeMs < 30000UL || next.soakTimeMs > 3600000UL) {
    Serial.println(">> Control settings are outside safe ranges; keeping last saved settings");
    return false;
  }

  bool changed = next.autoMode != current.autoMode
      || next.dryThreshold != current.dryThreshold || next.wetThreshold != current.wetThreshold
      || next.manualPump != current.manualPump || next.manualSolenoid != current.manualSolenoid
      || next.tankEmptyDistanceCm != current.tankEmptyDistanceCm
      || next.tankFullDistanceCm != current.tankFullDistanceCm
      || next.tankLowThresholdPercent != current.tankLowThresholdPercent
      || next.pumpOnTimeMs != current.pumpOnTimeMs || next.soakTimeMs != current.soakTimeMs;

  if (changed) {
    controlPreferences.begin("hh-control", false);
    controlPreferences.putString("mode", next.autoMode ? "auto" : "manual");
    controlPreferences.putFloat("dry", next.dryThreshold);
    controlPreferences.putFloat("wet", next.wetThreshold);
    controlPreferences.putFloat("tankEmpty", next.tankEmptyDistanceCm);
    controlPreferences.putFloat("tankFull", next.tankFullDistanceCm);
    controlPreferences.putFloat("tankLow", next.tankLowThresholdPercent);
    controlPreferences.putULong("pumpMs", next.pumpOnTimeMs);
    controlPreferences.putULong("soakMs", next.soakTimeMs);
    controlPreferences.end();
    Serial.println(">> Watering settings updated and saved on this ESP32");
  }

  current = next;
  return true;
}

void loadStoredControlSettings() {
  controlPreferences.begin("hh-control", true);
  String savedMode = controlPreferences.getString("mode", "auto");
  float savedDry = controlPreferences.getFloat("dry", MOISTURE_DRY);
  float savedWet = controlPreferences.getFloat("wet", MOISTURE_WET);
  float savedTankEmpty = controlPreferences.getFloat("tankEmpty", 100);
  float savedTankFull = controlPreferences.getFloat("tankFull", 10);
  unsigned long savedPumpMs = controlPreferences.getULong("pumpMs", 60000UL);
  unsigned long savedSoakMs = controlPreferences.getULong("soakMs", 300000UL);
  g_appliedLockoutResetVersion = controlPreferences.getULong("resetVersion", 0);
  const bool savedSafetyLockout = controlPreferences.getBool("safetyLockout", false);
  if (savedSafetyLockout) {
    g_lockoutError = true;
    g_irrigationState = SAFETY_LOCKOUT;
  }

  if ((savedMode == "auto" || savedMode == "manual")
      && savedDry >= 0 && savedDry < savedWet && savedWet <= 100
      && savedTankEmpty > savedTankFull && savedTankFull >= 0
      && savedPumpMs >= 5000UL && savedPumpMs <= 600000UL
      && savedSoakMs >= 30000UL && savedSoakMs <= 3600000UL) {
    g_mode = savedMode;
    g_thresholdDry = savedDry;
    g_thresholdWet = savedWet;
    // Manual ON commands are deliberately never restored after a reboot.
    g_manualPump = false;
    g_manualSolenoid = false;
    g_tankEmptyDistanceCm = savedTankEmpty;
    g_tankFullDistanceCm = savedTankFull;
    g_tankLowThresholdPercent = controlPreferences.getFloat("tankLow", 20);
    g_pumpOnTimeMs = savedPumpMs;
    g_soakTimeMs = savedSoakMs;
    Serial.println(">> Restored the last saved watering settings");
  }
  controlPreferences.end();
  controlPreferences.begin("hh-control", false);
  controlPreferences.putBool("manualPump", false);
  controlPreferences.putBool("manualValve", false);
  controlPreferences.end();
}

bool soilReadingFresh() {
  return g_hasSoilReading && millis() - g_lastSoilReadingAt <= SENSOR_STALE_AFTER_MS;
}

bool tankReadingFresh() {
  return g_hasTankReading && millis() - g_lastTankReadingAt <= SENSOR_STALE_AFTER_MS;
}

bool airReadingFresh() {
  return g_airReadingValid && g_hasAirReading && millis() - g_lastAirReadingAt <= SENSOR_STALE_AFTER_MS;
}

ControlSettingsSnapshot captureControlSettings() {
  ControlSettingsSnapshot snapshot;
  snapshot.autoMode = g_mode == "auto";
  snapshot.dryThreshold = g_thresholdDry;
  snapshot.wetThreshold = g_thresholdWet;
  snapshot.manualPump = g_manualPump;
  snapshot.manualSolenoid = g_manualSolenoid;
  snapshot.tankEmptyDistanceCm = g_tankEmptyDistanceCm;
  snapshot.tankFullDistanceCm = g_tankFullDistanceCm;
  snapshot.tankLowThresholdPercent = g_tankLowThresholdPercent;
  snapshot.pumpOnTimeMs = g_pumpOnTimeMs;
  snapshot.soakTimeMs = g_soakTimeMs;
  snapshot.settingsVersion = 0;
  snapshot.lockoutResetVersion = 0;
  snapshot.serverTimeMs = 0;
  snapshot.snapshotUptimeMs = 0;
  return snapshot;
}

void applyControlSettings(const ControlSettingsSnapshot &settings) {
  g_mode = settings.autoMode ? "auto" : "manual";
  g_thresholdDry = settings.dryThreshold;
  g_thresholdWet = settings.wetThreshold;
  g_tankEmptyDistanceCm = settings.tankEmptyDistanceCm;
  g_tankFullDistanceCm = settings.tankFullDistanceCm;
  g_tankLowThresholdPercent = settings.tankLowThresholdPercent;
  g_pumpOnTimeMs = settings.pumpOnTimeMs;
  g_soakTimeMs = settings.soakTimeMs;
  g_appliedSettingsVersion = settings.settingsVersion;
  g_pendingLockoutResetVersion = settings.lockoutResetVersion;
  if (settings.serverTimeMs > 0) {
    g_serverTimeOffsetMs = settings.serverTimeMs - (int64_t)settings.snapshotUptimeMs;
    g_serverTimeSynced = true;
  }
  g_lastControlResponseAt = millis();
  g_hasControlResponse = true;

  if (g_manualFailsafeLatched) {
    // Require the operator to clear the old command before accepting another
    // ON command after a local gateway outage.
    if (!settings.manualPump && !settings.manualSolenoid) g_manualFailsafeLatched = false;
    g_manualPump = false;
    g_manualSolenoid = false;
  } else {
    g_manualPump = settings.manualPump;
    g_manualSolenoid = settings.manualSolenoid;
  }
}

void applyPendingControlSettings() {
  if (!g_controlSettingsQueue) return;
  ControlSettingsSnapshot settings;
  if (xQueueReceive(g_controlSettingsQueue, &settings, 0) == pdTRUE) {
    applyControlSettings(settings);
  }
}

void applyPendingLockoutReset() {
  if (g_pendingLockoutResetVersion < g_appliedLockoutResetVersion) {
    // The local database may have been recreated. Rebase the acknowledgement
    // counter without replaying an old reset against a new safety lockout.
    g_appliedLockoutResetVersion = g_pendingLockoutResetVersion;
    Preferences resetPreferences;
    resetPreferences.begin("hh-control", false);
    resetPreferences.putULong("resetVersion", g_appliedLockoutResetVersion);
    resetPreferences.end();
    return;
  }
  if (g_pendingLockoutResetVersion <= g_appliedLockoutResetVersion) return;
  if (!soilReadingFresh() || !tankReadingFresh()) return;

  g_currentCycle = 0;
  g_lockoutError = false;
  if (g_irrigationState == SAFETY_LOCKOUT) enterState(IDLE);
  g_appliedLockoutResetVersion = g_pendingLockoutResetVersion;
  Preferences resetPreferences;
  resetPreferences.begin("hh-control", false);
  resetPreferences.putULong("resetVersion", g_appliedLockoutResetVersion);
  resetPreferences.end();
  Serial.println(">> Safety pause reset after fresh soil and tank readings");
}

void enforceManualCommandLease() {
  const bool manualCommandActive = g_manualPump || g_manualSolenoid;
  if (g_mode != "manual" || !manualCommandActive || !g_hasControlResponse) return;
  if (millis() - g_lastControlResponseAt <= MANUAL_CONTROL_LOSS_MS) return;

  g_manualPump = false;
  g_manualSolenoid = false;
  g_manualFailsafeLatched = true;
  if (pumpOn) { digitalWrite(RELAY_PUMP, RELAY_OFF); pumpOn = false; }
  if (solenoidOn) { digitalWrite(RELAY_SOLENOID, RELAY_OFF); solenoidOn = false; }
  Serial.println(">> Manual watering stopped: the ESP32 lost contact with the local gateway");
}

float readWaterLevelPercent() {
  digitalWrite(ULTRASONIC_TRIG_PIN, LOW);
  delayMicroseconds(4);
  digitalWrite(ULTRASONIC_TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(ULTRASONIC_TRIG_PIN, LOW);

  long duration = pulseIn(ULTRASONIC_ECHO_PIN, HIGH, 30000); // 30ms timeout (~5m max range)

  if (duration == 0) {
    Serial.println("Error: Ultrasonic sensor timeout — no echo received, keeping last known level");
    return g_levelPercent; // keep last known good value rather than assuming empty/full
  }

  float nextDistanceCm = duration / 58.0; // convert echo time to distance in cm
  if (!isfinite(nextDistanceCm) || nextDistanceCm < 2.0 || nextDistanceCm > 500.0) {
    Serial.println("Error: Ultrasonic reading is outside the valid range");
    return g_levelPercent;
  }
  g_distanceCm = nextDistanceCm;

  float percent = (g_tankEmptyDistanceCm - g_distanceCm) / (g_tankEmptyDistanceCm - g_tankFullDistanceCm) * 100.0;
  g_hasTankReading = true;
  g_lastTankReadingAt = millis();
  return constrain(percent, 0.0, 100.0);
}

// Reads the tank level + availability. Called once per 2s sensor cycle
// (not every loop()) since the ultrasonic ping briefly blocks and doesn't
// need to run faster than the rest of the sensor sampling.
void updateTankLevel() {
  g_levelPercent   = readWaterLevelPercent();
  g_waterAvailable = tankReadingFresh() && g_levelPercent > g_tankLowThresholdPercent;
}

// Averages several ADC samples to smooth out sensor noise —
// standard practice for both TDS and pH analog boards.
//
// Optionally also reports the batch's coefficient of variation (stddev /
// mean) via cvOut. A probe sitting in stable water gives a low CV; noise
// coupled in from a shared power supply or nearby switching wiring makes
// consecutive samples disagree with each other, spiking the CV even when
// the average still looks like a plausible number.
float readAnalogAveraged(int pin, int samples, float *cvOut) {
  int raw[64]; // supports up to 64 samples
  if (samples > 64) samples = 64;

  long sum = 0;
  for (int i = 0; i < samples; i++) {
    raw[i] = analogRead(pin);
    sum += raw[i];
    delay(5);
  }
  float mean = sum / (float)samples;

  if (cvOut != nullptr) {
    float variance = 0;
    for (int i = 0; i < samples; i++) {
      float d = raw[i] - mean;
      variance += d * d;
    }
    variance /= samples;
    float stdDev = sqrt(variance);
    *cvOut = (mean > 0) ? (stdDev / mean) : 0;
  }

  return mean;
}

// Plain-average overload for callers (like readPh()) that don't need
// stability info.
float readAnalogAveraged(int pin, int samples = 20) {
  return readAnalogAveraged(pin, samples, nullptr);
}

// DFRobot-standard TDS formula with temperature compensation.
// Water temperature isn't separately measured, so this uses the DHT22
// air temperature as the best available approximation — close enough
// for a rainwater tank, which tracks ambient temperature closely.
float readTdsPpm(float temperatureC) {
  float cv;
  float avgAdc = readAnalogAveraged(TDS_PIN, 20, &cv);

  // Disconnected probe: pulled-down pin settles low and stays low.
  if (avgAdc < TDS_DISCONNECT_RAW_THRESHOLD) {
    g_tdsSensorOnline = false;
    g_tdsStable = true; // nothing to distrust — there's just no probe
    return 0;
  }
  g_tdsSensorOnline = true;

  // Connected, but this batch's samples disagree with each other more
  // than a genuinely settled reading would — likely noise from the
  // shared power supply or nearby wiring, not a real change in the
  // water. Don't let it overwrite a good value; hold the last one.
  if (cv > TDS_MAX_COEFF_VARIATION) {
    g_tdsStable = false;
    return g_tds;
  }
  g_tdsStable = true;

  float voltage = avgAdc / 4095.0 * 3.3; // ESP32 ADC: 12-bit, 3.3V reference

  float compensationCoefficient = 1.0 + 0.02 * (temperatureC - 25.0);
  float compensationVoltage = voltage / compensationCoefficient;

  float tds = (133.42 * compensationVoltage * compensationVoltage * compensationVoltage
             - 255.86 * compensationVoltage * compensationVoltage
             + 857.39 * compensationVoltage) * 0.5;

  tds *= TDS_CALIBRATION_FACTOR;

  return tds < 0 ? 0 : tds;
}

// pH-4502C: two-point linear calibration using PH4_VOLTAGE / PH7_VOLTAGE.
float readPh() {
  float avgAdc = readAnalogAveraged(PH_PIN);
  float voltage = avgAdc / 4095.0 * 3.3;

  float phSlope = (PH7_VOLTAGE - PH4_VOLTAGE) / (7.0 - 4.0); // volts per pH unit
  float ph = 7.0 + (PH7_VOLTAGE - voltage) / phSlope;

  return constrain(ph, 0.0, 14.0);
}

// 3 discrete tank states, derived from the SAME ultrasonic reading used
// everywhere else (g_levelPercent) — no separate hardware needed.
#define TANK_FULL_CUTOFF_PERCENT 60.0 // at/above this = "Full"; adjust to taste

String readTankStatus3() {
  if (g_levelPercent >= TANK_FULL_CUTOFF_PERCENT) return "Full";
  if (g_levelPercent > g_tankLowThresholdPercent) return "Medium";
  return "Low";
}

// -------------------------------------------------------
// PULSE IRRIGATION / CYCLE-AND-SOAK STATE MACHINE
// -------------------------------------------------------

const char* stateName(IrrigationState s) {
  switch (s) {
    case IDLE:            return "IDLE";
    case WATERING:        return "WATERING";
    case SOAKING:         return "SOAKING";
    case SAFETY_LOCKOUT:  return "SAFETY_LOCKOUT";
  }
  return "UNKNOWN";
}

void enterState(IrrigationState newState) {
  const bool wasSafetyLocked = g_irrigationState == SAFETY_LOCKOUT;
  g_irrigationState = newState;
  g_stateEnteredAt  = millis();
  if (newState == SAFETY_LOCKOUT || wasSafetyLocked) {
    Preferences safetyPreferences;
    safetyPreferences.begin("hh-control", false);
    safetyPreferences.putBool("safetyLockout", newState == SAFETY_LOCKOUT);
    safetyPreferences.end();
  }
  Serial.printf(">> Irrigation state -> %s (cycle %d/%d)\n", stateName(newState), g_currentCycle, MAX_CYCLES);
}

// Global safety switch — applies in BOTH auto and manual mode. Tank empty
// mid-pump always forces the pump off and falls back to the solenoid line,
// regardless of what the state machine or manual overrides want.
void enforceTankSafety() {
  if (!tankReadingFresh() && (pumpOn || solenoidOn)) {
    digitalWrite(RELAY_PUMP, RELAY_OFF);
    digitalWrite(RELAY_SOLENOID, RELAY_OFF);
    pumpOn = false;
    solenoidOn = false;
    g_lockoutError = true;
    enterState(SAFETY_LOCKOUT);
    Serial.println(">> SAFETY LOCKOUT: tank reading is stale; both water outputs are OFF.");
    return;
  }

  if (pumpOn && !g_waterAvailable) {
    digitalWrite(RELAY_PUMP, RELAY_OFF);
    pumpOn = false;
    digitalWrite(RELAY_SOLENOID, RELAY_ON);
    solenoidOn = true;
    Serial.println(">> SAFETY SWITCH: Tank empty! PUMP OFF -> SOLENOID ON.");
  }
}

// Manual mode: admin's on/off switches drive the relays directly,
// completely bypassing the cycle-and-soak logic.
void updateManualIrrigation() {
  if ((g_manualPump || g_manualSolenoid) && !tankReadingFresh()) {
    if (pumpOn) { digitalWrite(RELAY_PUMP, RELAY_OFF); pumpOn = false; }
    if (solenoidOn) { digitalWrite(RELAY_SOLENOID, RELAY_OFF); solenoidOn = false; }
    g_manualPump = false;
    g_manualSolenoid = false;
    g_manualFailsafeLatched = true;
    g_lockoutError = true;
    enterState(SAFETY_LOCKOUT);
    Serial.println(">> SAFETY LOCKOUT: manual watering stopped because the tank reading is stale.");
    return;
  }

  const bool controlsAllowed = tankReadingFresh() && g_irrigationState != SAFETY_LOCKOUT;
  bool wantPump     = controlsAllowed && g_manualPump && g_waterAvailable;
  bool wantSolenoid = controlsAllowed && (g_manualSolenoid || (g_manualPump && !g_waterAvailable));

  if (wantPump != pumpOn) {
    digitalWrite(RELAY_PUMP, wantPump ? RELAY_ON : RELAY_OFF);
    pumpOn = wantPump;
    Serial.printf(">> MANUAL: PUMP %s\n", wantPump ? "ON" : "OFF");
  }
  if (wantSolenoid != solenoidOn) {
    digitalWrite(RELAY_SOLENOID, wantSolenoid ? RELAY_ON : RELAY_OFF);
    solenoidOn = wantSolenoid;
    Serial.printf(">> MANUAL: SOLENOID %s\n", wantSolenoid ? "ON" : "OFF");
  }
}

// Non-blocking cycle-and-soak state machine — call every loop() iteration
// (NOT gated behind the 2s sensor block) so pulse/soak durations are timed
// precisely off millis(), independent of how often the moisture sensor
// itself gets re-read.
void updateIrrigationStateMachine() {
  unsigned long elapsed = millis() - g_stateEnteredAt;

  if ((g_irrigationState == WATERING || g_irrigationState == SOAKING)
      && (!soilReadingFresh() || !tankReadingFresh())) {
    if (pumpOn) { digitalWrite(RELAY_PUMP, RELAY_OFF); pumpOn = false; }
    if (solenoidOn) { digitalWrite(RELAY_SOLENOID, RELAY_OFF); solenoidOn = false; }
    g_lockoutError = true;
    enterState(SAFETY_LOCKOUT);
    Serial.println(">> SAFETY LOCKOUT: soil or tank reading is stale; both water outputs are OFF.");
    return;
  }

  switch (g_irrigationState) {

    case IDLE:
      if (pumpOn) { digitalWrite(RELAY_PUMP, RELAY_OFF); pumpOn = false; }
      if (solenoidOn) { digitalWrite(RELAY_SOLENOID, RELAY_OFF); solenoidOn = false; }

      if (soilReadingFresh() && tankReadingFresh() && g_moisture < g_thresholdDry) {
        g_currentCycle = 0;
        enterState(WATERING);
      }
      break;

    case WATERING:
      // Early exit — soil already reached target saturation before the
      // pulse timer elapsed. No point continuing to pump; skip the soak
      // phase entirely and go straight back to monitoring.
      if (g_moisture >= g_thresholdWet) {
        if (pumpOn) { digitalWrite(RELAY_PUMP, RELAY_OFF); pumpOn = false; }
        if (solenoidOn) { digitalWrite(RELAY_SOLENOID, RELAY_OFF); solenoidOn = false; }
        g_currentCycle = 0;
        Serial.printf(">> Target moisture reached early (%.1f%% >= %.1f%%) — cutting pump, skipping soak.\n", g_moisture, g_thresholdWet);
        enterState(IDLE);
        break;
      }

      if (!g_waterAvailable) {
        // No water to pump — fall back to the solenoid backup line and
        // hold in WATERING until the tank recovers or the pulse elapses.
        if (pumpOn) { digitalWrite(RELAY_PUMP, RELAY_OFF); pumpOn = false; }
        if (!solenoidOn) { digitalWrite(RELAY_SOLENOID, RELAY_ON); solenoidOn = true; }
      } else {
        if (solenoidOn) { digitalWrite(RELAY_SOLENOID, RELAY_OFF); solenoidOn = false; }
        if (!pumpOn) { digitalWrite(RELAY_PUMP, RELAY_ON); pumpOn = true; }
      }

      if (elapsed >= g_pumpOnTimeMs) {
        enterState(SOAKING);
      }
      break;

    case SOAKING:
      if (pumpOn) { digitalWrite(RELAY_PUMP, RELAY_OFF); pumpOn = false; }
      if (solenoidOn) { digitalWrite(RELAY_SOLENOID, RELAY_OFF); solenoidOn = false; }

      if (elapsed >= g_soakTimeMs) {
        // ---- Evaluation point: soak finished, check the latest reading ----
        if (g_moisture >= g_thresholdDry) {
          g_currentCycle = 0;
          enterState(IDLE);
        } else {
          g_currentCycle++;
          if (g_currentCycle >= MAX_CYCLES) {
            enterState(SAFETY_LOCKOUT);
          } else {
            enterState(WATERING);
          }
        }
      }
      break;

    case SAFETY_LOCKOUT:
      // Relay OFF permanently — protects against a broken pipe or a
      // disconnected/faulty probe that never reports "wet" no matter
      // how much water goes in.
      if (pumpOn) { digitalWrite(RELAY_PUMP, RELAY_OFF); pumpOn = false; }
      if (solenoidOn) { digitalWrite(RELAY_SOLENOID, RELAY_OFF); solenoidOn = false; }
      g_lockoutError = true;
      break;
  }
}

long computeTimeRemainingSec() {
  unsigned long elapsed = millis() - g_stateEnteredAt;
  long remainingMs = 0;

  if (g_irrigationState == WATERING) remainingMs = (long)g_pumpOnTimeMs - (long)elapsed;
  else if (g_irrigationState == SOAKING) remainingMs = (long)g_soakTimeMs - (long)elapsed;

  if (remainingMs < 0) remainingMs = 0;
  return remainingMs / 1000;
}

void printIrrigationTelemetry() {
  Serial.printf(
    "{\"moisture\": %.0f, \"state\": \"%s\", \"cycle\": %d, \"timeRemaining\": %ld, \"relay\": %s}\n",
    g_moisture, stateName(g_irrigationState), g_currentCycle, computeTimeRemainingSec(), pumpOn ? "true" : "false"
  );
}

// -------------------------------------------------------

void parseSensorData(byte *buf) {
  float nextMoisture = ((buf[3]  << 8) | buf[4])  / 10.0;
  float nextSoilTemp = ((buf[5]  << 8) | buf[6])  / 10.0;
  float nextEc = ((buf[7]  << 8) | buf[8])  / 1.0;
  float nextPh = ((buf[9]  << 8) | buf[10]) / 10.0;
  float nextNitrogen = ((buf[11] << 8) | buf[12]) / 1.0;
  float nextPhosphorus = ((buf[13] << 8) | buf[14]) / 1.0;
  float nextPotassium = ((buf[15] << 8) | buf[16]) / 1.0;

  if (!isfinite(nextMoisture) || nextMoisture < 0 || nextMoisture > 100
      || !isfinite(nextPh) || nextPh < 0 || nextPh > 14) {
    Serial.println("Error: Soil sensor returned values outside valid ranges");
    return;
  }

  g_moisture = nextMoisture;
  g_soilTemp = nextSoilTemp;
  g_ec = nextEc;
  g_ph = nextPh;
  g_nitrogen = nextNitrogen;
  g_phosphorus = nextPhosphorus;
  g_potassium = nextPotassium;
  g_hasSoilReading = true;
  g_lastSoilReadingAt = millis();

  Serial.println("-----------------------------");
  Serial.printf("Moisture     : %.1f %%RH\n",  g_moisture);
  Serial.printf("Soil Temp    : %.1f C\n",     g_soilTemp);
  Serial.printf("EC           : %.0f uS/cm\n", g_ec);
  Serial.printf("pH           : %.1f\n",       g_ph);
  Serial.printf("N / P / K    : %.0f / %.0f / %.0f mg/kg\n", g_nitrogen, g_phosphorus, g_potassium);
  Serial.println("-----------------------------");
}

void parseDHTData() {
  float nextHumidity = dht.readHumidity();
  float nextTemperature = dht.readTemperature();

  if (!isfinite(nextHumidity) || !isfinite(nextTemperature)
      || nextHumidity < 0 || nextHumidity > 100
      || nextTemperature < -40 || nextTemperature > 80) {
    Serial.println("Error: Failed to read from DHT22!");
    g_airReadingValid = false;
  } else {
    g_dhtHumid = nextHumidity;
    g_dhtTemp = nextTemperature;
    g_airReadingValid = true;
    g_hasAirReading = true;
    g_lastAirReadingAt = millis();
    Serial.printf("DHT Temp/Hum : %.1f C / %.1f %%\n", g_dhtTemp, g_dhtHumid);
  }
}

// Build one telemetry payload for the local Wi-Fi gateway. Serial is kept for
// diagnostics only; plant readings are sent to the laptop over HTTP.
void buildTelemetryPayload(char *payload, size_t payloadSize, uint32_t sequence) {
  // JSON has no way to interpolate "null" through a %.1f slot, so build the
  // tds field as its own string first, then splice it in with %s.
  char tdsJson[16];
  if (g_tdsSensorOnline) {
    snprintf(tdsJson, sizeof(tdsJson), "%.1f", g_tds);
  } else {
    snprintf(tdsJson, sizeof(tdsJson), "null");
  }

  const unsigned long deviceUptimeMs = millis();
  const unsigned long long sampledAtMs = g_serverTimeSynced && g_serverTimeOffsetMs + deviceUptimeMs > 0
      ? (unsigned long long)(g_serverTimeOffsetMs + deviceUptimeMs) : 0ULL;

  snprintf(payload, payloadSize,
    "{"
      "\"device\":\"%s\","
      "\"deviceBootId\":\"%s\","
      "\"deviceSequence\":%lu,\"deviceUptimeMs\":%lu,\"sampledAtMs\":%llu,\"bufferDroppedSamples\":%lu,\"bufferRestartLossCount\":%lu,"
      "\"soil\":{\"moisture\":%.1f,\"temperature\":%.1f,\"ec\":%.0f,\"ph\":%.1f,\"nitrogen\":%.0f,\"phosphorus\":%.0f,\"potassium\":%.0f},"
      "\"air\":{\"temperature\":%.1f,\"humidity\":%.1f,\"readingValid\":%s},"
      "\"watering\":{\"tankWaterLevel\":\"%s\",\"distanceCm\":%.1f,\"levelPercent\":%.0f,\"pumpActive\":%s,\"solenoidActive\":%s,\"activeSource\":\"%s\","
        "\"irrigationState\":\"%s\",\"cycle\":%d,\"timeRemainingSec\":%ld,\"lockout\":%s,"
        "\"soilReadingValid\":%s,\"tankReadingValid\":%s,\"manualCommandBlocked\":%s,\"appliedSettingsVersion\":%lu,\"appliedLockoutResetVersion\":%lu},"
      "\"water\":{\"tds\":%s,\"tdsStable\":%s,\"ph\":%.2f,\"tankStatus\":\"%s\"}"
    "}",
    DEVICE_ID,
    g_bootSessionId,
    (unsigned long)sequence, deviceUptimeMs, sampledAtMs, (unsigned long)g_bufferDroppedSamples, (unsigned long)g_bufferRestartLossCount,
    g_moisture, g_soilTemp, g_ec, g_ph, g_nitrogen, g_phosphorus, g_potassium,
    g_dhtTemp, g_dhtHumid, airReadingFresh() ? "true" : "false",
    g_waterAvailable ? "OK" : "LOW", g_distanceCm, g_levelPercent,
    pumpOn ? "true" : "false", solenoidOn ? "true" : "false",
    pumpOn ? "PUMP" : (solenoidOn ? "SOLENOID" : "NONE"),
    stateName(g_irrigationState), g_currentCycle, computeTimeRemainingSec(), g_lockoutError ? "true" : "false",
    soilReadingFresh() ? "true" : "false", tankReadingFresh() ? "true" : "false",
    g_manualFailsafeLatched ? "true" : "false",
    g_appliedSettingsVersion, g_appliedLockoutResetVersion,
    tdsJson, g_tdsStable ? "true" : "false", g_waterPh, g_tankStatus3.c_str()
  );
}

// The local Wi-Fi network carries readings to the laptop gateway. It does not
// need internet access; the laptop's MongoDB connection stays on loopback.
bool sendTelemetryToBackend(const char *payload) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  http.setConnectTimeout(700);
  http.setTimeout(900);
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-boot-id", g_bootSessionId);
  if (strlen(HALAMANHUB_DEVICE_TOKEN) > 0) {
    http.addHeader("x-device-token", HALAMANHUB_DEVICE_TOKEN);
  }

  int httpCode = http.POST(payload);

  if (httpCode >= 200 && httpCode < 300) {
    Serial.printf(">> Reading accepted by laptop gateway (HTTP %d)\n", httpCode);
  } else {
    if (httpCode > 0) {
      Serial.printf(">> Laptop gateway rejected reading (HTTP %d)\n", httpCode);
    } else {
      Serial.printf(">> Laptop gateway request failed: %s\n", http.errorToString(httpCode).c_str());
    }
  }

  http.end();
  return httpCode >= 200 && httpCode < 300;
}

// All blocking Wi-Fi and HTTP work runs on its own FreeRTOS task. The Arduino
// loop stays available to read sensors and service the relay safety rules.
void networkTask(void *parameter) {
  (void)parameter;
  ControlSettingsSnapshot currentSettings = g_networkSettings;
  unsigned long lastControlPoll = millis() - CONTROL_POLL_INTERVAL_MS;
  unsigned long lastTelemetryAttempt = 0;
  TelemetryPacket packet;

  for (;;) {
    connectWiFi();
    if (WiFi.status() == WL_CONNECTED) {
      const unsigned long now = millis();
      if (now - lastControlPoll >= CONTROL_POLL_INTERVAL_MS) {
        lastControlPoll = now;
        if (fetchControlSettings(currentSettings) && g_controlSettingsQueue) {
          xQueueOverwrite(g_controlSettingsQueue, &currentSettings);
        }
      }

      if (g_telemetryQueue && millis() - lastTelemetryAttempt >= 250
          && xQueuePeek(g_telemetryQueue, &packet, 0) == pdTRUE) {
        lastTelemetryAttempt = millis();
        // Persist the pending marker before the network request. If power is
        // lost while the request is in flight, startup can report the gap.
        markTelemetryQueuePending();
        if (sendTelemetryToBackend(packet.payload)) {
          TelemetryPacket sentPacket;
          xQueueReceive(g_telemetryQueue, &sentPacket, 0);
          if (uxQueueMessagesWaiting(g_telemetryQueue) == 0) markTelemetryQueueDrained();
        } else {
          markTelemetryQueuePending();
        }
      }
    } else if (g_telemetryQueue && uxQueueMessagesWaiting(g_telemetryQueue) > 0) {
      markTelemetryQueuePending();
    }
    vTaskDelay(pdMS_TO_TICKS(25));
  }
}

// -------------------------------------------------------

void setup() {
  Serial.begin(115200);
  Serial2.begin(4800, SERIAL_8N1, RX2_PIN, TX2_PIN);
  if (strlen(HALAMANHUB_DEVICE_TOKEN) == 0
      || strcmp(HALAMANHUB_DEVICE_TOKEN, "PASTE_A_RANDOM_64_CHARACTER_HEX_TOKEN_HERE") == 0) {
    Serial.println("ERROR: Set a private device token in halamanhub_config.h; the local server will reject ESP32 requests.");
  }

  pinMode(DE_PIN, OUTPUT);
  pinMode(RE_PIN, OUTPUT);
  setRS485Mode(LOW);

  dht.begin();

  pinMode(RELAY_PUMP,     OUTPUT);
  pinMode(RELAY_SOLENOID, OUTPUT);
  digitalWrite(RELAY_PUMP,     RELAY_OFF);
  digitalWrite(RELAY_SOLENOID, RELAY_OFF);

  pinMode(ULTRASONIC_TRIG_PIN, OUTPUT);
  pinMode(ULTRASONIC_ECHO_PIN, INPUT);
  digitalWrite(ULTRASONIC_TRIG_PIN, LOW);

  // PH_PIN needs no pinMode() — analogRead() configures it.
  // TDS_PIN gets an internal pull-down so a disconnected probe reads a
  // known-low, stable voltage instead of floating randomly — that's what
  // readTdsPpm() checks to detect "sensor not connected".
  pinMode(TDS_PIN, INPUT_PULLDOWN);

  SERVER_URL = String("http://") + HALAMANHUB_LAPTOP_IP + ":4000/api/sensor-data";
  CONTROL_URL = String("http://") + HALAMANHUB_LAPTOP_IP + ":4000/api/irrigation/control";
  snprintf(g_bootSessionId, sizeof(g_bootSessionId), "%s-%08lX%08lX", DEVICE_ID,
      (unsigned long)esp_random(), (unsigned long)millis());
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.setSleep(false);
  loadStoredControlSettings();
  restoreTelemetryBufferState();
  g_networkSettings = captureControlSettings();
  g_lastWifiAttempt = millis() - WIFI_RETRY_COOLDOWN_MS;
  g_stateEnteredAt = millis();
  g_controlSettingsQueue = xQueueCreate(1, sizeof(ControlSettingsSnapshot));
  g_telemetryQueue = xQueueCreate(TELEMETRY_BUFFER_CAPACITY, sizeof(TelemetryPacket));
  if (!g_controlSettingsQueue || !g_telemetryQueue) {
    Serial.println("ERROR: Could not create the local network queues. Relays remain safe until reboot.");
  } else if (xTaskCreatePinnedToCore(networkTask, "hh-network", 8192, nullptr, 1, nullptr, 0) != pdPASS) {
    Serial.println("ERROR: Could not start the local network task. Relays remain safe until reboot.");
  }
  Serial.println("System initialized — sensor and watering loop is separate from local Wi-Fi");
}

void loop() {
  // The network task publishes a complete settings snapshot. Apply it here so
  // the network task never writes relay-control variables concurrently.
  applyPendingControlSettings();
  applyPendingLockoutReset();
  enforceManualCommandLease();
  enforceTankSafety();

  if (g_mode == "manual") {
    updateManualIrrigation();
  } else {
    updateIrrigationStateMachine();
  }

  // ---- Runs every 2s: sensor sampling + telemetry (unchanged cadence) ----
  static unsigned long last = 0;
  if (millis() - last >= 2000) {
    last = millis();

    while (Serial2.available()) Serial2.read();

    sendQuery();
    byte buf[RESPONSE_LEN];
    if (readResponse(buf)) {
      parseSensorData(buf);
    }

    parseDHTData();
    updateTankLevel();

    // TEMPORARY — remove once you've found your blind zone
    Serial.printf(">> DEBUG raw distance: %.1f cm\n", g_distanceCm);

    g_tds         = readTdsPpm(g_dhtTemp);
    g_waterPh     = readPh();
    g_tankStatus3 = readTankStatus3();

    char payload[TELEMETRY_PAYLOAD_SIZE];
    const uint32_t sequence = ++g_sampleSequence;
    buildTelemetryPayload(payload, sizeof(payload), sequence);

    // The dashboard receives readings over Wi-Fi. This optional serial line
    // remains available for the legacy USB bridge and bench debugging.
    Serial.print("TELEMETRY:");
    Serial.println(payload);
    printIrrigationTelemetry();

    if (g_telemetryQueue) {
      TelemetryPacket packet;
      strlcpy(packet.payload, payload, sizeof(packet.payload));
      // Keep up to two minutes of ordered readings in RAM while the laptop
      // gateway is unavailable. Never discard the queue head: the server can
      // then save the backlog in sample order when the link returns.
      if (xQueueSend(g_telemetryQueue, &packet, 0) != pdTRUE) {
        g_bufferDroppedSamples++;
        Serial.printf(">> Reading buffer full; skipped sample %lu (total skipped: %lu)\n",
            (unsigned long)sequence, (unsigned long)g_bufferDroppedSamples);
      }
    }
  }
}
