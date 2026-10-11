# HalamanHub

HalamanHub brings together soil and rainwater monitoring, watering controls, nursery operations, and the Mapili Plant Nursery customer shop. The ESP32 reads the sensors and controls the pump. A Node.js API on the laptop receives readings and stores the app's data in MongoDB.

This guide walks through a local development setup on **macOS** or **Windows**. Follow the instructions for your computer, then use the optional ESP32 and customer shop steps as needed.

## What runs where

| Part | Folder | Local address | What it does |
|---|---|---|---|
| Admin dashboard | `src/` | <http://localhost:3000> | Monitoring, watering, products, orders, and administration |
| API server | `server/` | <http://localhost:4000> | Connects the dashboards, ESP32, and database |
| Customer shop | `mapili/` | <http://localhost:3001> | Customer product browsing and ordering |
| ESP32 firmware | `ESP32/` | — | Reads sensors, controls outputs, and sends readings |
| MongoDB | Installed separately | <http://127.0.0.1:27017> | Stores the server's data |

### Database behavior in this checkout

The current server uses one `MONGODB_URI` connection for **all** app data, including monitoring, watering, products, customer accounts, and orders. Setting it to a local MongoDB address keeps all of that data on the laptop. Setting it to MongoDB Atlas keeps all of it in the cloud. A local sensor database plus a separate cloud shop database is **not implemented in this checkout**.

The local web addresses above are for the laptop. They do not publish the shop to customers on the public internet. For public online orders, the API and database need to be deployed somewhere customers can reach. PayMongo also needs an internet connection.

The ESP32 and laptop can exchange data over the same local Wi-Fi even if that Wi-Fi has no internet. The ESP32 sketch also prints readings over USB serial. The included serial bridge can forward those readings to the local API without Wi-Fi, but that USB bridge only forwards readings; the ESP32 still needs Wi-Fi access to the API to fetch admin watering settings and receive control changes.

## Before you start

You will need:

- Node.js **LTS** and npm: [nodejs.org/download](https://nodejs.org/en/download/)
- MongoDB Community Server on the laptop, or a MongoDB Atlas connection string
- Git, if you are cloning the project
- Arduino IDE and an ESP32 board package if you will upload firmware
- Internet for initial downloads and for online payment/email services

## Setup on macOS

### 1. Install Node.js

1. Download the macOS installer for the current Node.js LTS from [nodejs.org](https://nodejs.org/en/download/).
2. Open the downloaded `.pkg` file and follow the installer.
3. Open Terminal and confirm Node.js and npm are available:

   ```sh
   node --version
   npm --version
   ```

### 2. Install and start MongoDB locally

If MongoDB is already installed, start its service and continue to step 3.

1. Install Homebrew from its [official instructions](https://brew.sh/) if you do not already have it.
2. In Terminal, install MongoDB Community Server:

   ```sh
   brew tap mongodb/brew
   brew update
   brew install mongodb-community@8.0
   brew services start mongodb-community@8.0
   ```

3. Check the service:

   ```sh
   brew services list
   ```

   Look for `mongodb-community@8.0` with status `started`.

4. Check the database connection:

   ```sh
   mongosh "mongodb://127.0.0.1:27017/halamanhub"
   ```

   At the `mongosh` prompt, run `db.runCommand({ ping: 1 })`. A successful reply includes `ok: 1`. Type `exit` to leave.

If Terminal says `mongosh: command not found`, install MongoDB Shell with `brew install mongosh`, then open a new Terminal window. MongoDB's [macOS installation guide](https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-os-x/) has other installation options.

**If Homebrew reports outdated Command Line Tools:** MongoDB was not installed by that failed command. Open **System Settings → General → Software Update** and install any Command Line Tools update offered. You can also try `xcode-select --install`. This can update Apple's developer tools without upgrading macOS. Do not delete the existing Command Line Tools folder. If Apple offers no compatible update, use MongoDB's official [macOS installation options](https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-os-x/) or use MongoDB Atlas instead.

### 3. Create the server environment file

1. In Finder or Terminal, open the project folder.
2. In the `server` folder, create a plain text file named `.env` (the filename starts with a dot, with no `.txt` ending).
3. Add these local development settings:

   ```env
   MONGODB_URI=mongodb://127.0.0.1:27017/halamanhub
   JWT_SECRET=replace-this-with-a-long-random-secret
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=replace-this-with-a-password
   PORT=4000
   CLIENT_ORIGIN=http://localhost:3000
   SHOP_ORIGIN=http://localhost:3001
   ```

4. Make a random JWT secret in Terminal:

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Replace the sample `JWT_SECRET` with the printed value. Choose your own admin password and remember it for the first login. Keep `server/.env` private; it is excluded from Git.

For cloud MongoDB, replace the `MONGODB_URI` line with the connection string from Atlas. Do not put angle brackets around a real URI, and URL-encode special characters in the database password.

### 4. Install project packages

In Terminal, go to the folder containing this README (the project folder), then run:

```sh
npm install
```

Install the API server packages:

```sh
cd server
npm install
cd ..
```

Install the customer shop packages if you plan to run it:

```sh
cd mapili
npm install --legacy-peer-deps
cd ..
```

### 5. Add the initial admin and sample data

For a new development database, open Terminal in `server/` and run:

```sh
npm run seed
```

This creates the admin account from `ADMIN_USERNAME` and `ADMIN_PASSWORD`. It also inserts sample products, orders, sensors, watering zones, schedules, alerts, and default settings into collections that are empty. Use it only for a new/demo database; it does not replace populated collections. If you do not want sample data, skip this step and create/configure records through the app where available.

### 6. Start the API and admin dashboard

From the project folder, run:

```sh
npm run dev
```

Leave this Terminal window open. It starts the API and admin dashboard together. Visit:

- Admin dashboard: <http://localhost:3000>
- API health check: <http://localhost:4000/api/health>

Sign in to the admin dashboard with the username and password set in `server/.env`. The health page should return JSON with `"status":"ok"`.

### 7. Start the customer shop (optional)

Open a second Terminal window, go to the project folder, then run:

```sh
cd mapili
npm start
```

Open <http://localhost:3001>. The shop uses the local API by default. If you change `mapili/.env`, restart the shop development server.

### 8. Connect the ESP32 (optional)

1. Install Arduino IDE and add the ESP32 board support package from Espressif using Arduino IDE's Boards Manager.
2. Install the Arduino libraries **DHT sensor library**, **Adafruit Unified Sensor**, and **ArduinoJson** using Library Manager.
3. Open `ESP32/halamanhub_esp32_updated.ino`.
4. Enter the Wi-Fi name and password in `WIFI_SSID` and `WIFI_PASS`.
5. Replace `<laptop-ip-on-hotspot>` in both `SERVER_URL` and `CONTROL_URL` with the laptop's local Wi-Fi IPv4 address. Keep the rest of each URL, including its path and port.
6. Connect the laptop and ESP32 to the same Wi-Fi network. Internet access is not required for local sensor communication. A phone hotspot can provide the local network, but make sure it allows devices on the hotspot to communicate with each other.
7. Select your ESP32 board and USB port in Arduino IDE, then upload the sketch.

Find the laptop's Wi-Fi address in **System Settings → Wi-Fi → Details**. It usually looks like `192.168.x.x` or `10.x.x.x`. The ESP32 URLs should look like:

```text
http://192.168.1.25:4000/api/sensor-data
http://192.168.1.25:4000/api/irrigation/control
```

Use your laptop's actual address, not this example. If macOS asks whether Node may accept incoming connections, allow it on the local network. The laptop firewall must allow local connections to port `4000`.

#### USB serial readings without Wi-Fi

The sketch prints telemetry over USB at **115200 baud**. With the API running, open another Terminal window and run:

```sh
cd server
node scripts/serialBridge.js
```

The bridge tries to find the ESP32 port automatically. It forwards USB readings into the local API. Close Arduino IDE's Serial Monitor first because only one program can use the USB serial port at a time. USB serial provides readings; the current bridge does not deliver admin watering settings back to the ESP32.

## Setup on Windows

### 1. Install Node.js

1. Download the Windows installer (`.msi`) for the current Node.js LTS from [nodejs.org](https://nodejs.org/en/download/).
2. Run it and keep the option to add Node.js to `PATH` enabled.
3. Open PowerShell and confirm Node.js and npm are available:

   ```powershell
   node --version
   npm --version
   ```

### 2. Install and start MongoDB locally

If MongoDB is already installed, continue to step 3.

1. Download the MongoDB Community Server **Windows MSI** from the [MongoDB Community download page](https://www.mongodb.com/try/download/community).
2. Run the installer, choose **Complete**, and keep **Install MongoD as a Service** selected. MongoDB Compass is optional.
3. Finish setup and open PowerShell. Check the service:

   ```powershell
   Get-Service MongoDB
   ```

   If it is stopped, start it from an Administrator PowerShell window:

   ```powershell
   Start-Service MongoDB
   ```

4. Install MongoDB Shell (`mongosh`) from the [official download page](https://www.mongodb.com/try/download/shell) if it is not already installed. Close and reopen PowerShell after installation.
5. Verify the database:

   ```powershell
   mongosh "mongodb://127.0.0.1:27017/halamanhub"
   ```

   At the `mongosh` prompt, run `db.runCommand({ ping: 1 })`. A successful reply includes `ok: 1`. Type `exit` to leave.

MongoDB's [Windows installation guide](https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-windows/) covers service and installer options.

### 3. Create the server environment file

1. In File Explorer, open the project folder, then open `server`.
2. Create a file named `.env`. In Notepad, use **Save as type: All files** and enter `.env` as the name so Windows does not add `.txt`.
3. Add these local development settings:

   ```env
   MONGODB_URI=mongodb://127.0.0.1:27017/halamanhub
   JWT_SECRET=replace-this-with-a-long-random-secret
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=replace-this-with-a-password
   PORT=4000
   CLIENT_ORIGIN=http://localhost:3000
   SHOP_ORIGIN=http://localhost:3001
   ```

4. Make a random JWT secret in PowerShell:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Replace the sample `JWT_SECRET` with the printed value. Choose and remember your admin password. Keep `server/.env` private; it is excluded from Git.

For cloud MongoDB, replace `MONGODB_URI` with the connection string from Atlas. URL-encode special characters in the database password.

### 4. Install project packages

Open PowerShell in the folder containing this README. Run:

```powershell
npm install
```

Then install the server packages:

```powershell
Set-Location server
npm install
Set-Location ..
```

Install the customer shop packages if you plan to run it:

```powershell
Set-Location mapili
npm install --legacy-peer-deps
Set-Location ..
```

### 5. Add the initial admin and sample data

For a new development database, open PowerShell in `server` and run:

```powershell
npm run seed
```

This creates the admin account from `ADMIN_USERNAME` and `ADMIN_PASSWORD`. It also adds sample products, orders, sensors, watering zones, schedules, alerts, and default settings to empty collections. Use it only for a new/demo database; it does not replace populated collections. Skip this step if you do not want sample records.

### 6. Start the API and admin dashboard

Open PowerShell in the project folder and run:

```powershell
npm run dev
```

Leave this window open. Visit:

- Admin dashboard: <http://localhost:3000>
- API health check: <http://localhost:4000/api/health>

Sign in with the credentials from `server/.env`. The health page should return JSON with `"status":"ok"`.

### 7. Start the customer shop (optional)

Open another PowerShell window in the project folder and run:

```powershell
Set-Location mapili
$env:PORT = "3001"
npx react-scripts start
```

The shop's `npm start` script sets its port with macOS/Linux syntax, so use the PowerShell commands above on Windows. Open <http://localhost:3001>. Restart this process after changing `mapili/.env`.

### 8. Connect the ESP32 (optional)

1. Install Arduino IDE and add Espressif's ESP32 board support package from Boards Manager.
2. Install **DHT sensor library**, **Adafruit Unified Sensor**, and **ArduinoJson** from Library Manager.
3. Open `ESP32/halamanhub_esp32_updated.ino`.
4. Enter the Wi-Fi name and password in `WIFI_SSID` and `WIFI_PASS`.
5. Find the laptop's Wi-Fi IPv4 address by running `ipconfig` in PowerShell. Under the Wi-Fi adapter, look for **IPv4 Address**.
6. Replace `<laptop-ip-on-hotspot>` in both `SERVER_URL` and `CONTROL_URL` with that address. Keep the rest of each URL, including its path and port.
7. Connect the laptop and ESP32 to the same Wi-Fi network. Internet access is not needed for local sensor communication. A phone hotspot can provide the local network, but it must allow connected devices to communicate with each other.
8. Select the ESP32 board and COM port in Arduino IDE, then upload the sketch.

Allow Node.js through Windows Defender Firewall on **Private networks** if Windows asks. The laptop firewall must allow local connections to port `4000`. The URLs should look like this, using your actual laptop address:

```text
http://192.168.1.25:4000/api/sensor-data
http://192.168.1.25:4000/api/irrigation/control
```

#### USB serial readings without Wi-Fi

With the API running and the ESP32 connected over USB, open another PowerShell window. First find its COM port in **Device Manager → Ports (COM & LPT)**, then run this from `server` using your port:

```powershell
node scripts/serialBridge.js COM5
```

Replace `COM5` with the port shown on your computer. Close Arduino IDE's Serial Monitor first because only one program can use the USB serial port at a time. The bridge forwards readings to the local API; it does not deliver admin watering settings back to the ESP32.

## Optional online services

The local admin and shop can run without payment or email credentials. To enable online payments, add a PayMongo test or live secret as `PAYMONGO_SECRET_KEY` in `server/.env`. To send order emails, configure `SMTP_USER` and `SMTP_PASS` there. For customer Google sign-in, configure the Google client ID as described in [the shop README](mapili/README.md). Keep secret keys in `server/.env`, never in React frontend code.

## Troubleshooting

| What you see | What to check |
|---|---|
| `MONGODB_URI is not set` | Make sure `server/.env` exists and contains `MONGODB_URI=...`. |
| MongoDB connection refused | Start the MongoDB service, then verify it with `mongosh` or MongoDB Compass. |
| API health page does not open | Keep `npm run dev` running and check that port 4000 is not already used. |
| Admin login fails on a new database | Confirm `ADMIN_USERNAME` and `ADMIN_PASSWORD` are set, then run `npm run seed` from `server/`. |
| Browser cannot reach the API | Use `http://localhost:4000/api` for local browsers and confirm the API is running. |
| ESP32 cannot reach the laptop | Confirm both use the same Wi-Fi, use the laptop's current Wi-Fi IPv4 address in both firmware URLs, allow port 4000 through the firewall, and check that the hotspot does not isolate devices. |
| ESP32 uploads but no USB readings appear | Close Serial Monitor, confirm the correct port, leave the API running, and start `serialBridge.js` at 115200 baud (the bridge sets this automatically). |
| Shop does not open on port 3001 in Windows | Use the PowerShell shop command above; `mapili`'s `npm start` script uses a macOS/Linux port assignment. |

## More project notes

- [Local MongoDB setup details for macOS and Windows](LOCAL_MONGODB_SETUP_GUIDE_MACOS_WINDOWS.md)
- [Admin and shop UI guide](UI_GUIDE.md)
- [Customer shop notes](mapili/README.md)
