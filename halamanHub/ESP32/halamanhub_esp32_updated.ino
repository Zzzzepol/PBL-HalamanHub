#include <HardwareSerial.h>
#include <DHT.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// --- Wi-Fi & Backend API Configuration ---
// Since you're testing via a phone hotspot, WIFI_SSID/WIFI_PASS are your
// phone's hotspot name/password (not your home/university router).
const char* WIFI_SSID = "YOUR_HOTSPOT_NAME";
const char* WIFI_PASS = "YOUR_HOTSPOT_PASSWORD";

// <<< FILL THIS IN ONCE YOU'RE ON THE HOTSPOT — see note below >>>
const char* SERVER_URL  = "http://<laptop-ip-on-hotspot>:4000/api/sensor-data";
const char* CONTROL_URL = "http://<laptop-ip-on-hotspot>:4000/api/irrigation/control";
const char* DEVICE_ID   = "ESP32-01"; // identifies this unit in the database

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

// --- Dual Float Switches (3-state rainwater tank level) ---
#define FLOAT_LOW_PIN  18   // bottom switch
#define FLOAT_HIGH_PIN 19   // top switch
#define FLOAT_TRIGGERED LOW // wired NO-to-GND with INPUT_PULLUP: closed = LOW

// --- Moisture Thresholds (%) — now just the initial defaults ---
// (used only until the first successful fetchControlSettings() call)
#define MOISTURE_DRY  30.0
#define MOISTURE_WET  60.0

// --- Pulse Irrigation / Cycle-and-Soak State Machine ---
// Tune these three for your soil texture — see the notes at the bottom
// of the accompanying explanation for clay vs. sandy soil guidance.
#define PUMP_ON_TIME_MS   60000UL   // 60s pulse — how long the pump runs per cycle
#define SOAK_TIME_MS      300000UL  // 5 min soak — time given for water to percolate
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

float g_distanceCm    = 0;
float g_levelPercent  = 0;
bool  g_waterAvailable = false;

// TDS / pH / 3-state tank level — Rainwater Harvesting sensors
float  g_tds         = 0;
float  g_waterPh     = 0;
String g_tankStatus3 = "Low"; // "Low" | "Medium" | "Full"

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

// -------------------------------------------------------

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("Connecting to Wi-Fi");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWi-Fi Connected! IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nWi-Fi connection failed. Will retry next loop.");
  }
}

void setRS485Mode(bool transmit) {
  digitalWrite(DE_PIN, transmit);
  digitalWrite(RE_PIN, transmit);
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

bool fetchControlSettings() {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  http.begin(CONTROL_URL);
  int httpCode = http.GET();

  if (httpCode != 200) {
    Serial.printf(">> Failed to fetch control settings (code %d) — keeping last known values\n", httpCode);
    http.end();
    return false;
  }

  String body = http.getString();
  http.end();

  // NOTE: if your installed ArduinoJson is v6.x instead of v7.x, replace the
  // line below with: StaticJsonDocument<256> doc;
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    Serial.println(">> Control JSON parse error — keeping last known values");
    return false;
  }

  g_mode           = doc["mode"].as<String>();
  g_thresholdDry   = doc["moistureDryThreshold"].as<float>();
  g_thresholdWet   = doc["moistureWetThreshold"].as<float>();
  g_manualPump     = doc["manualPump"].as<bool>();
  g_manualSolenoid = doc["manualSolenoid"].as<bool>();

  g_tankEmptyDistanceCm     = doc["tankEmptyDistanceCm"].as<float>();
  g_tankFullDistanceCm      = doc["tankFullDistanceCm"].as<float>();
  g_tankLowThresholdPercent = doc["tankLowThresholdPercent"].as<float>();

  return true;
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

  g_distanceCm = duration / 58.0; // convert echo time to distance in cm

  float percent = (g_tankEmptyDistanceCm - g_distanceCm) / (g_tankEmptyDistanceCm - g_tankFullDistanceCm) * 100.0;
  return constrain(percent, 0.0, 100.0);
}

// Reads the tank level + availability. Called once per 2s sensor cycle
// (not every loop()) since the ultrasonic ping briefly blocks and doesn't
// need to run faster than the rest of the sensor sampling.
void updateTankLevel() {
  g_levelPercent   = readWaterLevelPercent();
  g_waterAvailable = g_levelPercent > g_tankLowThresholdPercent;
}

// Averages several ADC samples to smooth out sensor noise —
// standard practice for both TDS and pH analog boards.
float readAnalogAveraged(int pin, int samples = 20) {
  long sum = 0;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(pin);
    delay(5);
  }
  return sum / (float)samples;
}

// DFRobot-standard TDS formula with temperature compensation.
// Water temperature isn't separately measured, so this uses the DHT22
// air temperature as the best available approximation — close enough
// for a rainwater tank, which tracks ambient temperature closely.
float readTdsPpm(float temperatureC) {
  float avgAdc = readAnalogAveraged(TDS_PIN);
  float voltage = avgAdc / 4095.0 * 3.3; // ESP32 ADC: 12-bit, 3.3V reference

  float compensationCoefficient = 1.0 + 0.02 * (temperatureC - 25.0);
  float compensationVoltage = voltage / compensationCoefficient;

  float tds = (133.42 * compensationVoltage * compensationVoltage * compensationVoltage
             - 255.86 * compensationVoltage * compensationVoltage
             + 857.39 * compensationVoltage) * 0.5;

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

// 2 float switches -> 3 discrete tank states.
String readTankStatus3() {
  bool lowTriggered  = digitalRead(FLOAT_LOW_PIN)  == FLOAT_TRIGGERED;
  bool highTriggered = digitalRead(FLOAT_HIGH_PIN) == FLOAT_TRIGGERED;

  if (highTriggered) return "Full";
  if (lowTriggered)  return "Medium";
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
  g_irrigationState = newState;
  g_stateEnteredAt  = millis();
  Serial.printf(">> Irrigation state -> %s (cycle %d/%d)\n", stateName(newState), g_currentCycle, MAX_CYCLES);
}

// Global safety switch — applies in BOTH auto and manual mode. Tank empty
// mid-pump always forces the pump off and falls back to the solenoid line,
// regardless of what the state machine or manual overrides want.
void enforceTankSafety() {
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
  bool wantPump     = g_manualPump && g_waterAvailable;
  bool wantSolenoid = g_manualSolenoid || (g_manualPump && !g_waterAvailable);

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

  switch (g_irrigationState) {

    case IDLE:
      if (pumpOn) { digitalWrite(RELAY_PUMP, RELAY_OFF); pumpOn = false; }
      if (solenoidOn) { digitalWrite(RELAY_SOLENOID, RELAY_OFF); solenoidOn = false; }

      if (g_moisture < g_thresholdDry) {
        g_currentCycle = 0;
        enterState(WATERING);
      }
      break;

    case WATERING:
      if (!g_waterAvailable) {
        // No water to pump — fall back to the solenoid backup line and
        // hold in WATERING until the tank recovers or the pulse elapses.
        if (pumpOn) { digitalWrite(RELAY_PUMP, RELAY_OFF); pumpOn = false; }
        if (!solenoidOn) { digitalWrite(RELAY_SOLENOID, RELAY_ON); solenoidOn = true; }
      } else {
        if (solenoidOn) { digitalWrite(RELAY_SOLENOID, RELAY_OFF); solenoidOn = false; }
        if (!pumpOn) { digitalWrite(RELAY_PUMP, RELAY_ON); pumpOn = true; }
      }

      if (elapsed >= PUMP_ON_TIME_MS) {
        enterState(SOAKING);
      }
      break;

    case SOAKING:
      if (pumpOn) { digitalWrite(RELAY_PUMP, RELAY_OFF); pumpOn = false; }
      if (solenoidOn) { digitalWrite(RELAY_SOLENOID, RELAY_OFF); solenoidOn = false; }

      if (elapsed >= SOAK_TIME_MS) {
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

  if (g_irrigationState == WATERING) remainingMs = (long)PUMP_ON_TIME_MS - (long)elapsed;
  else if (g_irrigationState == SOAKING) remainingMs = (long)SOAK_TIME_MS - (long)elapsed;

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
  g_moisture   = ((buf[3]  << 8) | buf[4])  / 10.0;
  g_soilTemp   = ((buf[5]  << 8) | buf[6])  / 10.0;
  g_ec         = ((buf[7]  << 8) | buf[8])  / 1.0;
  g_ph         = ((buf[9]  << 8) | buf[10]) / 10.0;
  g_nitrogen   = ((buf[11] << 8) | buf[12]) / 1.0;
  g_phosphorus = ((buf[13] << 8) | buf[14]) / 1.0;
  g_potassium  = ((buf[15] << 8) | buf[16]) / 1.0;

  Serial.println("-----------------------------");
  Serial.printf("Moisture     : %.1f %%RH\n",  g_moisture);
  Serial.printf("Soil Temp    : %.1f C\n",     g_soilTemp);
  Serial.printf("EC           : %.0f uS/cm\n", g_ec);
  Serial.printf("pH           : %.1f\n",       g_ph);
  Serial.printf("N / P / K    : %.0f / %.0f / %.0f mg/kg\n", g_nitrogen, g_phosphorus, g_potassium);
  Serial.println("-----------------------------");
}

void parseDHTData() {
  g_dhtHumid = dht.readHumidity();
  g_dhtTemp  = dht.readTemperature();

  if (isnan(g_dhtHumid) || isnan(g_dhtTemp)) {
    Serial.println("Error: Failed to read from DHT22!");
    g_dhtHumid = 0.0;
    g_dhtTemp  = 0.0;
  } else {
    Serial.printf("DHT Temp/Hum : %.1f C / %.1f %%\n", g_dhtTemp, g_dhtHumid);
  }
}

// Builds the telemetry JSON once, so both the USB-serial path (always works,
// zero network needed) and the WiFi path (best-effort bonus) send identical data.
void buildTelemetryPayload(char *payload, size_t payloadSize) {
  snprintf(payload, payloadSize,
    "{"
      "\"device\":\"%s\","
      "\"soil\":{\"moisture\":%.1f,\"temperature\":%.1f,\"ec\":%.0f,\"ph\":%.1f,\"nitrogen\":%.0f,\"phosphorus\":%.0f,\"potassium\":%.0f},"
      "\"air\":{\"temperature\":%.1f,\"humidity\":%.1f},"
      "\"watering\":{\"tankWaterLevel\":\"%s\",\"distanceCm\":%.1f,\"levelPercent\":%.0f,\"pumpActive\":%s,\"solenoidActive\":%s,\"activeSource\":\"%s\","
        "\"irrigationState\":\"%s\",\"cycle\":%d,\"timeRemainingSec\":%ld,\"lockout\":%s},"
      "\"water\":{\"tds\":%.1f,\"ph\":%.2f,\"tankStatus\":\"%s\"}"
    "}",
    DEVICE_ID,
    g_moisture, g_soilTemp, g_ec, g_ph, g_nitrogen, g_phosphorus, g_potassium,
    g_dhtTemp, g_dhtHumid,
    g_waterAvailable ? "OK" : "LOW", g_distanceCm, g_levelPercent,
    pumpOn ? "true" : "false", solenoidOn ? "true" : "false",
    pumpOn ? "PUMP" : (solenoidOn ? "SOLENOID" : "NONE"),
    stateName(g_irrigationState), g_currentCycle, computeTimeRemainingSec(), g_lockoutError ? "true" : "false",
    g_tds, g_waterPh, g_tankStatus3.c_str()
  );
}

// WiFi is now just a bonus path — if there's no network, this quietly does
// nothing and the USB-serial line (sent separately, in loop()) is what
// actually feeds the dashboard.
void sendTelemetryToBackend(const char *payload) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) return;
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.POST(payload);

  if (httpCode > 0) {
    Serial.printf(">> HTTP POST Success! Code: %d\n", httpCode);
  } else {
    Serial.printf(">> HTTP POST Failed! Error: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}

// -------------------------------------------------------

void setup() {
  Serial.begin(115200);
  Serial2.begin(4800, SERIAL_8N1, RX2_PIN, TX2_PIN);

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

  pinMode(FLOAT_LOW_PIN,  INPUT_PULLUP);
  pinMode(FLOAT_HIGH_PIN, INPUT_PULLUP);
  // TDS_PIN / PH_PIN need no pinMode() — analogRead() configures them.

  connectWiFi();
  g_stateEnteredAt = millis();
  Serial.println("System initialized — Ready to stream telemetry");
}

void loop() {
  // ---- Runs every iteration, NEVER blocked by delay() ----
  enforceTankSafety();

  if (g_mode == "manual") {
    // Switching to manual is treated as explicit operator acknowledgment,
    // so it clears a SAFETY_LOCKOUT the same way physically resetting the
    // system would.
    if (g_irrigationState == SAFETY_LOCKOUT) {
      g_currentCycle = 0;
      g_lockoutError = false;
      enterState(IDLE);
      Serial.println(">> Manual mode engaged — SAFETY_LOCKOUT cleared.");
    }
    updateManualIrrigation();
  } else {
    updateIrrigationStateMachine();
  }

  // ---- Runs every 2s: sensor sampling + telemetry (unchanged cadence) ----
  static unsigned long last = 0;
  if (millis() - last >= 2000) {
    last = millis();

    while (Serial2.available()) Serial2.read();

    fetchControlSettings(); // check for updated thresholds/mode before deciding pump state

    sendQuery();
    byte buf[RESPONSE_LEN];
    if (readResponse(buf)) {
      parseSensorData(buf);
    }

    parseDHTData();
    updateTankLevel();

    g_tds         = readTdsPpm(g_dhtTemp);
    g_waterPh     = readPh();
    g_tankStatus3 = readTankStatus3();

    char payload[700];
    buildTelemetryPayload(payload, sizeof(payload));

    // ALWAYS sent over the USB cable — this is the guaranteed path the
    // dashboard reads from, works with zero WiFi/internet in the room.
    Serial.print("TELEMETRY:");
    Serial.println(payload);

    // Required schema from the spec — printed as its own line for easy
    // debugging/monitoring independent of the full TELEMETRY: payload above.
    printIrrigationTelemetry();

    // Best-effort — only helps if a WiFi network happens to be available.
    sendTelemetryToBackend(payload);
  }
}
