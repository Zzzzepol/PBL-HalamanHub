# HalamanHub

HalamanHub combines nursery soil monitoring, watering control, rainwater monitoring, and the Mapili Plant Nursery online shop. The admin dashboard is designed for nursery staff; the customer shop supports online product orders.

## Project parts

| Part | Folder | Purpose | Local address |
|---|---|---|---|
| Admin dashboard | `src/` | Plant readings, watering, plant profiles, orders, reports, and settings | `http://localhost:3000` |
| Customer shop | `mapili/` | Product browsing, checkout, payment, and order status | `http://localhost:3001` |
| API server | `server/` | Express API, local sensor gateway, and shop APIs | `http://localhost:4000` |
| ESP32 firmware | `ESP32/` | Reads sensors and controls the pump and backup water line | Connects to the laptop over local Wi-Fi |

## How the system is connected

The ESP32 sends readings to the HalamanHub server on the laptop over a shared Wi-Fi network. The ESP32 does not connect to MongoDB. The server stores monitoring and watering data in MongoDB running on the laptop at `127.0.0.1`; shop products, customers, orders, and payments use the cloud MongoDB connection. The laptop can use a separate internet connection for the customer shop.

The single RS485 soil probe represents the bed or growing area selected in **Settings → Soil monitoring setup**. Plant profiles assigned to that area share the same readings; the system does not measure each plant separately. If Wi-Fi briefly drops, the ESP32 queues up to about two minutes of readings in RAM and sends them to the laptop when the connection returns. See [the local Wi-Fi workflow](LOCAL_WIFI_IOT_WORKFLOW.md) for setup, recovery, and daily operation details.

## Soil values and prototype targets

The soil probe reports wetness, pH, EC, and NPK over RS485. The ESP32 checks the response and decodes the sensor's reported values. The exact measurement method and accuracy depend on the probe model and its calibration. The water pH and TDS sensors are separate rainwater readings.

Current default plant-profile targets and comparison bands:

| Value | Default target | Profile checker treats this band as within target |
|---|---:|---:|
| Soil acidity (pH) | 6.5 | 6.2–6.8 |
| Soil salt (EC) | 900 µS/cm | 750–1,050 µS/cm |
| Nitrogen (N) | 50 mg/kg | 40–60 mg/kg |
| Phosphorus (P) | 30 mg/kg | 20–40 mg/kg |
| Potassium (K) | 140 mg/kg | 120–160 mg/kg |

Auto watering uses soil wetness, not NPK, pH, or EC. Its initial settings start watering below 30% and use 60% as the upper wetness target. Staff can change these values in the admin. The plant-profile values and watering settings are software defaults for this prototype. The repository does not document local soil-lab results or field calibration that proves these are the right values for every crop or bed. Treat recommendations as guidance until they are checked against representative soil tests and local crop needs. Soil-testing recommendations should account for the crop and the sampled soil; the [DA-BSWM FertMap](https://nshp.bswm.da.gov.ph/fertmap/) is one Philippine reference for soil-test and crop-specific fertilizer guidance.

The dashboard also has general soil advice, and the offline fallback has a separate copy of those rules. Some of those general ranges differ from the plant-profile bands above, so they are guidance rather than a single validated threshold standard. The rule sets should be unified and checked against local references before the recommendations are used as operational agronomy advice.

## Setup

### Requirements

- Node.js and npm
- MongoDB Community running on the laptop
- A cloud MongoDB URI for online shop data
- Arduino IDE and the libraries used by the ESP32 sketch

### 1. Install MongoDB

Use the [macOS and Windows MongoDB setup guide](LOCAL_MONGODB_SETUP_GUIDE_MACOS_WINDOWS.md). Keep the laptop MongoDB bound to `127.0.0.1`.

### 2. Configure the server

Create `server/.env` and configure the values described in [the local Wi-Fi workflow](LOCAL_WIFI_IOT_WORKFLOW.md). At minimum, the split database setup uses:

```env
IOT_MONGODB_URI=mongodb://127.0.0.1:27017/halamanhub_iot
SHOP_MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<database>
IOT_DEVICE_TOKEN=<same-private-token-as-the-ESP32-config>
PORT=4000
CLIENT_ORIGIN=http://localhost:3000
SHOP_ORIGIN=http://localhost:3001
```

Keep the existing cloud URI in `MONGODB_URI` if the project already uses it; `SHOP_MONGODB_URI` takes priority when both are set. Add the application's required authentication, admin, payment, and email settings to the server environment as needed. Never put server secrets in frontend environment files.

Install dependencies from the project folders:

```sh
npm install
cd server && npm install
cd ../mapili && npm install --legacy-peer-deps
```

### 3. Start the server and admin dashboard

From the project root, run:

```sh
npm run dev
```

This starts the API server and admin dashboard together. The database health endpoint is `http://localhost:4000/api/health`; `plant` should be `connected`. The shop database may show `connected` or `unavailable`; monitoring and watering use the local database.

### 4. Start the customer shop

In another terminal:

```sh
cd mapili
npm start
```

On Windows PowerShell, set the shop port before starting it:

```powershell
cd mapili
$env:PORT = "3001"
npm start
```

### 5. Connect the ESP32

Copy `ESP32/halamanhub_config.example.h` to `ESP32/halamanhub_config.h`. Add the local Wi-Fi name and password, the laptop's IPv4 address on that same network, and the shared device token. Upload `ESP32/halamanhub_esp32_updated.ino` over USB. For the full router, firewall, and device setup, follow [the local Wi-Fi workflow](LOCAL_WIFI_IOT_WORKFLOW.md).

## Useful server commands

Run these from `server/`:

```sh
npm start              # Start the API server
npm run dev             # Start with Node's watch mode
npm run migrate:iot     # Copy existing monitoring/admin records to local MongoDB
npm run seed:local-admin # Create a local admin if migration did not copy one
npm run backup:iot      # Back up the local monitoring database
```

The migration keeps source records and does not copy shop inventory or customer orders. See [the local Wi-Fi workflow](LOCAL_WIFI_IOT_WORKFLOW.md) before migrating an existing database.

## Main documentation

- [Local Wi-Fi and ESP32 workflow](LOCAL_WIFI_IOT_WORKFLOW.md)
- [Local MongoDB setup for macOS and Windows](LOCAL_MONGODB_SETUP_GUIDE_MACOS_WINDOWS.md)
- [Admin and shop UI guide](UI_GUIDE.md)
- [Customer shop README](mapili/README.md)
