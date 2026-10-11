# HalamanHub

HalamanHub combines nursery soil monitoring, watering control, rainwater monitoring, and the Mapili Plant Nursery online shop. The admin dashboard helps nursery staff check readings and manage daily work. Customers can browse products and place orders through the shop.

## Project parts

| Part | Folder | Purpose | Local address |
|---|---|---|---|
| Admin dashboard | `src/` | Plant readings, watering, products, orders, reports, and settings | `http://localhost:3000` |
| API server | `server/` | Connects the dashboards, ESP32, and database | `http://localhost:4000` |
| Customer shop | `mapili/` | Product browsing, checkout, payment, and order status | `http://localhost:3001` |
| ESP32 firmware | `ESP32/` | Reads sensors, controls the pump and backup water line, and sends readings | Connects to the laptop over local Wi-Fi or USB |

## Tech stack

- **Admin and customer shop:** React 18, React Router 6, Tailwind CSS 3
- **Charts and icons:** Chart.js 4, Tabler Icons
- **Fonts:** Inter and Playfair Display
- **API:** Node.js, Express 4, Socket.IO
- **Database:** MongoDB with Mongoose 8
- **Authentication:** JSON Web Tokens (JWT)
- **ESP32:** Arduino C++, Wi-Fi, HTTP, RS485, DHT sensor, and ArduinoJson
- **Shop services:** PayMongo payments and Nodemailer for email

## How the system is connected

The ESP32 sends sensor readings to the HalamanHub API on the laptop. For Wi-Fi communication, the laptop and ESP32 must be connected to the same local network. The local sensor connection does not need internet access. PayMongo payments and public online orders do need internet access.

The current server uses **one `MONGODB_URI` for all app data**: monitoring, watering, products, customer accounts, and orders. A local MongoDB URI stores all of that data on the laptop. A MongoDB Atlas URI stores all of it in the cloud. This version does not have separate local sensor and cloud shop databases.

The ESP32 can also send readings over USB. The included serial bridge forwards USB readings to the local API without Wi-Fi. That bridge sends readings only; the ESP32 still needs Wi-Fi access to the API to fetch watering settings and receive control changes.

The soil probe measures the soil where it is physically placed. If there is one probe, its readings represent that bed or location; it does not independently measure every plant.

## Soil values and prototype targets

The soil probe reports wetness, pH, EC, and NPK over RS485. The ESP32 reads and decodes the values reported by the probe. Measurement accuracy depends on the probe model, installation, and calibration. Water pH and TDS are separate rainwater readings.

Current default plant-profile targets and comparison bands:

| Value | Default target | Profile checker treats this band as within target |
|---|---:|---:|
| Soil acidity (pH) | 6.5 | 6.2–6.8 |
| Soil salt (EC) | 900 µS/cm | 750–1,050 µS/cm |
| Nitrogen (N) | 50 mg/kg | 40–60 mg/kg |
| Phosphorus (P) | 30 mg/kg | 20–40 mg/kg |
| Potassium (K) | 140 mg/kg | 120–160 mg/kg |

Auto watering uses soil wetness, not NPK, pH, or EC. Its initial settings start watering below 30% and use 60% as the upper wetness target. Staff can change these settings in the admin dashboard.

These values are software defaults for the prototype. They have not been proven suitable for every crop or bed through local soil testing or field calibration. Treat recommendations as guidance until they are checked against representative soil tests and crop needs. The [DA-BSWM FertMap](https://nshp.bswm.da.gov.ph/fertmap/) is one Philippine reference for soil-test and crop-specific fertilizer guidance.

## Setup

### Requirements

- Node.js LTS and npm
- MongoDB Community Server on the laptop, or a MongoDB Atlas connection string
- Arduino IDE and the ESP32 libraries, if you will upload firmware
- Internet for downloading software and using online services

## macOS setup

### 1. Install Node.js

1. Download the current Node.js LTS installer from [nodejs.org](https://nodejs.org/en/download/).
2. Open the `.pkg` file and follow the installer.
3. Open Terminal and check the installation:

   ```sh
   node --version
   npm --version
   ```

### 2. Install and start MongoDB

If MongoDB is already installed, start its service and continue to step 3.

1. Install Homebrew from its [official instructions](https://brew.sh/) if needed.
2. Open Terminal and run:

   ```sh
   brew tap mongodb/brew
   brew update
   brew install mongodb-community@8.0
   brew services start mongodb-community@8.0
   ```

3. Check that MongoDB is running:

   ```sh
   brew services list
   ```

   Look for `mongodb-community@8.0` with status `started`.

4. Check the database connection:

   ```sh
   mongosh "mongodb://127.0.0.1:27017/halamanhub"
   ```

   At the `mongosh` prompt, run:

   ```javascript
   db.runCommand({ ping: 1 })
   ```

   A successful response includes `ok: 1`. Type `exit` to leave.

If Terminal says `mongosh: command not found`, install it with `brew install mongosh`, then open a new Terminal window.

**If Homebrew reports outdated Command Line Tools:** MongoDB was not installed by that failed command. Check **System Settings → General → Software Update**, or try `xcode-select --install`. This may update Apple's developer tools without upgrading macOS. Do not delete the existing Command Line Tools folder. If no compatible tools update is available, see MongoDB's [macOS installation guide](https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-os-x/) or use MongoDB Atlas.

### 3. Configure the server

1. From the project folder, open the server environment file:

   ```sh
   nano server/.env
   ```

   If you already have `server/.env`, edit it rather than replacing the whole file.

2. Add or update these local development settings:

   ```env
   MONGODB_URI=mongodb://127.0.0.1:27017/halamanhub
   JWT_SECRET=replace-this-with-a-long-random-secret
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=replace-this-with-your-password
   PORT=4000
   CLIENT_ORIGIN=http://localhost:3000
   SHOP_ORIGIN=http://localhost:3001
   ```

3. Generate a random JWT secret in Terminal:

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Replace the example `JWT_SECRET` with the value printed in Terminal. Choose your own admin password. In Nano, save with **Control+O**, press **Enter**, then exit with **Control+X**.

Keep `server/.env` private. Do not put server secrets in the frontend files.

### 4. Install project packages

Run these commands from the project folder:

```sh
npm install
cd server
npm install
cd ..
cd mapili
npm install --legacy-peer-deps
cd ..
```

The last three commands install the customer shop packages. You can skip them if you do not plan to run the shop.

### 5. Add the initial admin and sample data

For a new development database, run:

```sh
cd server
npm run seed
cd ..
```

The seed command creates an admin using `ADMIN_USERNAME` and `ADMIN_PASSWORD`. It also adds sample products, orders, sensors, watering zones, schedules, alerts, and default settings to collections that are empty.

Run this only when you want demo data. It skips collections that already contain records.

### 6. Start the API and admin dashboard

From the project folder, run:

```sh
npm run dev
```

Leave Terminal open. Visit:

- Admin dashboard: <http://localhost:3000>
- API health check: <http://localhost:4000/api/health>

The health check should return JSON with `"status":"ok"`. Sign in to the dashboard with the admin username and password from `server/.env`.

### 7. Start the customer shop

Open another Terminal window. From the project folder, run:

```sh
cd mapili
npm start
```

Open <http://localhost:3001>.

### 8. Connect the ESP32

1. Install Arduino IDE and add Espressif's ESP32 board support through Boards Manager.
2. Install these libraries through Library Manager:
   - DHT sensor library
   - Adafruit Unified Sensor
   - ArduinoJson
3. Open `ESP32/halamanhub_esp32_updated.ino`.
4. Enter your Wi-Fi name and password in `WIFI_SSID` and `WIFI_PASS`.
5. Find the laptop's Wi-Fi IP address in **System Settings → Wi-Fi → Details**.
6. Replace `<laptop-ip-on-hotspot>` in both `SERVER_URL` and `CONTROL_URL` with that IP address. Keep the rest of each URL.
7. Connect the laptop and ESP32 to the same Wi-Fi network, then select the correct ESP32 board and USB port in Arduino IDE and upload the sketch.

The URLs should look like this, using your laptop's actual IP address:

```text
http://192.168.1.25:4000/api/sensor-data
http://192.168.1.25:4000/api/irrigation/control
```

Allow Node.js through the macOS firewall if prompted. The laptop firewall must allow local connections to port `4000`.

#### Use USB for readings without Wi-Fi

With the API running and the ESP32 connected to the laptop by USB, open another Terminal window:

```sh
cd server
node scripts/serialBridge.js
```

The bridge tries to find the ESP32's USB port automatically. Close Arduino IDE's Serial Monitor first; only one app can use the USB serial port at a time. USB forwards readings to the API but does not send admin watering settings back to the ESP32.

## Windows setup

### 1. Install Node.js

1. Download the current Node.js LTS **Windows installer** from [nodejs.org](https://nodejs.org/en/download/).
2. Run the `.msi` installer. Keep the option to add Node.js to `PATH` enabled.
3. Open Command Prompt or PowerShell and check the installation:

   ```text
   node --version
   npm --version
   ```

### 2. Install and start MongoDB

If MongoDB is already installed, start its service and continue to step 3.

1. Download the MongoDB Community Server **Windows MSI** from the [MongoDB download page](https://www.mongodb.com/try/download/community).
2. Run the installer, choose **Complete**, and keep **Install MongoD as a Service** selected. MongoDB Compass is optional.
3. Open Command Prompt or PowerShell and check the service:

   **Command Prompt:**

   ```bat
   sc query MongoDB
   ```

   **PowerShell:**

   ```powershell
   Get-Service MongoDB
   ```

4. If the service is stopped, open Command Prompt or PowerShell as Administrator and start it:

   **Command Prompt:**

   ```bat
   net start MongoDB
   ```

   **PowerShell:**

   ```powershell
   Start-Service MongoDB
   ```

5. Install MongoDB Shell (`mongosh`) from the [official download page](https://www.mongodb.com/try/download/shell) if it is not installed. Close and reopen Command Prompt after installation.
6. Verify the database connection:

   ```text
   mongosh "mongodb://127.0.0.1:27017/halamanhub"
   ```

   At the `mongosh` prompt, run `db.runCommand({ ping: 1 })`. A successful response includes `ok: 1`. Type `exit` to leave.

### 3. Configure the server

1. Open Command Prompt or PowerShell in the project folder.
2. Open or create the environment file in Notepad:

   ```text
   notepad server\.env
   ```

   If Notepad asks to create the file, choose **Yes**. When saving a new file, choose **Save as type: All files** and name it `.env` so it does not become `.env.txt`.

3. Add or update these local development settings:

   ```env
   MONGODB_URI=mongodb://127.0.0.1:27017/halamanhub
   JWT_SECRET=replace-this-with-a-long-random-secret
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=replace-this-with-your-password
   PORT=4000
   CLIENT_ORIGIN=http://localhost:3000
   SHOP_ORIGIN=http://localhost:3001
   ```

4. Generate a random JWT secret in Command Prompt or PowerShell:

   ```text
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Replace the example `JWT_SECRET` with the printed value. Choose your own admin password. Keep `server\.env` private.

### 4. Install project packages

Open Command Prompt or PowerShell in the project folder. In File Explorer, you can open the project folder, click the address bar, type `cmd`, and press **Enter** to open Command Prompt there.

Run:

```text
npm install
cd server
npm install
cd ..
cd mapili
npm install --legacy-peer-deps
cd ..
```

The `mapili` commands install the customer shop packages. You can skip them if you do not plan to run the shop.

### 5. Add the initial admin and sample data

For a new development database, run these commands from the project folder:

```text
cd server
npm run seed
cd ..
```

The seed command creates an admin using `ADMIN_USERNAME` and `ADMIN_PASSWORD`. It also adds sample products, orders, sensors, watering zones, schedules, alerts, and default settings to collections that are empty. Run it only when you want demo data; it skips collections that already contain records.

### 6. Start the API and admin dashboard

From the project folder, run:

```text
npm run dev
```

Leave this window open. Visit:

- Admin dashboard: <http://localhost:3000>
- API health check: <http://localhost:4000/api/health>

The health check should return JSON with `"status":"ok"`. Sign in using the admin username and password from `server\.env`.

### 7. Start the customer shop

Open another Command Prompt or PowerShell window in the project folder.

**Command Prompt:**

```bat
cd mapili
set PORT=3001
npx react-scripts start
```

**PowerShell:**

```powershell
Set-Location mapili
$env:PORT = "3001"
npx react-scripts start
```

The shop's `npm start` script sets its port using macOS/Linux syntax, so use one of the commands above on Windows. Open <http://localhost:3001>.

### 8. Connect the ESP32

1. Install Arduino IDE and add Espressif's ESP32 board support through Boards Manager.
2. Install **DHT sensor library**, **Adafruit Unified Sensor**, and **ArduinoJson** through Library Manager.
3. Open `ESP32\halamanhub_esp32_updated.ino`.
4. Enter your Wi-Fi name and password in `WIFI_SSID` and `WIFI_PASS`.
5. In Command Prompt or PowerShell, run:

   ```text
   ipconfig
   ```

   Under the Wi-Fi adapter, find **IPv4 Address**.

6. Replace `<laptop-ip-on-hotspot>` in both `SERVER_URL` and `CONTROL_URL` with that address. Keep the rest of each URL.
7. Connect the laptop and ESP32 to the same Wi-Fi network. Select the ESP32 board and COM port in Arduino IDE, then upload the sketch.

Allow Node.js through Windows Defender Firewall on **Private networks** if asked. The laptop firewall must allow local connections to port `4000`.

#### Use USB for readings without Wi-Fi

With the API running and the ESP32 connected by USB, find its port in **Device Manager → Ports (COM & LPT)**. Open another Command Prompt or PowerShell window in the project folder and run:

```text
cd server
node scripts/serialBridge.js COM5
```

Replace `COM5` with the port shown on your computer. Close Arduino IDE's Serial Monitor first. USB forwards readings to the API but does not send admin watering settings back to the ESP32.

## Optional online services

- **Payments:** Add your PayMongo test or live secret as `PAYMONGO_SECRET_KEY` in `server/.env`.
- **Order emails:** Configure `SMTP_USER` and `SMTP_PASS` in `server/.env`.
- **Google sign-in:** See the Google client ID setup in [the customer shop README](mapili/README.md).

Keep secret keys in `server/.env`. Do not place them in React frontend code.

## Troubleshooting

| Problem | What to check |
|---|---|
| `MONGODB_URI is not set` | Confirm `server/.env` exists and contains `MONGODB_URI=...`. |
| MongoDB connection refused | Start the MongoDB service, then test with `mongosh` or MongoDB Compass. |
| Admin login fails on a new database | Confirm `ADMIN_USERNAME` and `ADMIN_PASSWORD` are set, then run `npm run seed` from `server/`. |
| The API does not open | Leave `npm run dev` running and check whether another app is using port `4000`. |
| The ESP32 cannot reach the laptop | Check that both are on the same Wi-Fi, the firmware has the laptop's current Wi-Fi IP, the firewall allows port `4000`, and the hotspot allows devices to communicate. |
| The shop does not open on Windows | Start it with the Windows-specific command above and check port `3001`. |

## More documentation

- [Local MongoDB setup for macOS and Windows](LOCAL_MONGODB_SETUP_GUIDE_MACOS_WINDOWS.md)
- [Admin and shop UI guide](UI_GUIDE.md)
- [Customer shop notes](mapili/README.md)
