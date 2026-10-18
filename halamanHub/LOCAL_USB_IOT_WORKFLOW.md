# HalamanHub USB-connected plant system

## Start everything on Windows

After the one-time setup below, double-click `START_HALAMANHUB_WINDOWS.bat` in
the project folder. It starts the MongoDB Windows service when available and
opens separate windows for the admin site and server, customer shop, and Python
USB gateway. The gateway chooses the ESP32 COM port automatically when it can
identify one device. It retries after an unplug or COM-port change, so the
ESP32 can be plugged in after the launcher starts. Keep those windows open.

If several serial devices are connected, run this from Command Prompt in the
project folder to select the ESP32 explicitly:

```bat
START_HALAMANHUB_WINDOWS.bat COM5
```

Replace `COM5` with the port shown in Device Manager. The launcher checks for
Node.js, Python, pyserial, installed project packages, and `server/.env`, and
prints a setup step if one is missing. The admin site opens at
`http://localhost:3000`, the shop at `http://localhost:3001`, and the server
health page at `http://localhost:4000/api/health`.

## Architecture

```text
Soil, air, water sensors + relays
              │
              ▼ USB serial (no Wi-Fi needed)
            ESP32
              │  TELEMETRY:<json> / HH_CONTROL:<json>
              ▼
     Python USB gateway on laptop
              │  HTTP to localhost
              ▼
      HalamanHub server on laptop :4000
          │                         │
          │ loopback only           └── Internet, when available
          ▼                                  ▼
   Local MongoDB                     Cloud application MongoDB
   readings, local plants,             admin/customer accounts,
   watering settings/history           alerts, products, orders,
                                        payments, cloud plant profiles,
                                        watering settings/history mirror
```

The ESP32 connects to the laptop only through its USB cable. It does not join
Wi-Fi and does not connect directly to MongoDB. The Python gateway forwards
readings to the laptop API and relays dashboard settings back to the ESP32.
MongoDB stays on the laptop at `127.0.0.1` for ESP32 sensor readings/status,
local plant profiles, and watering controls/history. Admin/customer accounts,
general application settings, alerts, activity logs, products, orders, and
payments stay in the cloud database. Watering settings/history are also copied
to the cloud after the connection returns. The laptop copy is authoritative
for watering, including changes made while offline.

The admin dashboard's **Your plants** list uses local plant profiles. Staff can
create profiles on the laptop or copy selected shop products into the local
list. A copied product stores the plant name, category, and photo; soil targets
are managed in the local plant profile. It does not copy price, stock, customer,
or order data. The **Sync plant profiles** action copies profiles that are
missing by plant name and category between local profiles and the separate
`cloudplantprofiles` collection in the cloud database. Matching profiles are
left unchanged, including their soil targets. This collection is separate from
shop Products, so a synced plant profile does not become a customer listing.
Local profiles remain available without internet. In **Growing areas**, staff
name each bed and choose the plant profiles represented by the one shared soil
probe. Dashboard comparisons use the profiles in the active area. The readings
are a representative sample for that area, not separate measurements for
every plant.

**Growing areas** stores multiple named beds locally. Staff assign plant
profiles to each area, then mark which area physically holds the one soil
probe. Only that area is live; other areas show their last measured values and
saved history. Before moving the probe, staff turn watering off and wait for
the ESP32 to confirm both water outputs are off. The shared pump remains linked
to the original area, so watering cannot be enabled while the probe is in a
different area. Delayed USB readings are assigned using the time they were
sampled, when the ESP32 has a valid laptop-synced clock; readings without a
trustworthy sample time remain unassigned rather than being attributed to the
wrong bed.

To sell a locally saved plant, open **Products**. The page lists local plants
that do not already match a shop product. Choose **Set up shop listing**, then
add the customer-facing image, price, unit, and stock before saving. This
creates a Product in the cloud shop inventory and links it to the local profile;
it does not overwrite the profile's soil targets.

The ESP32-to-laptop connection does not use Wi-Fi. Sensor readings and watering
history continue to be saved locally while the cloud is unavailable. A cached
admin/staff account can change Auto thresholds, mode, manual outputs, and tank
calibration through the local server and USB gateway. The separate offline
viewer account remains read-only. The ESP32 keeps its last saved settings if
the gateway stops. Customer orders and cloud-only management pages require
the cloud.

## Set up the databases

1. Start MongoDB on the laptop. Keep its bind address at `127.0.0.1` so only
   the laptop can access the database directly.
2. In `server/.env`, keep your current `MONGODB_URI` as the cloud shop URI and
   add:

   ```env
   IOT_MONGODB_URI=mongodb://127.0.0.1:27017/halamanhub_iot
   ```

   You can use `SHOP_MONGODB_URI` for the cloud URI instead. If both
   `SHOP_MONGODB_URI` and `MONGODB_URI` are set, `SHOP_MONGODB_URI` takes
   priority. Existing installs with only `MONGODB_URI` continue to use one
   database for both groups until `IOT_MONGODB_URI` is added.
3. From the `server` folder, copy legacy ESP32 sensor data and local plant
   profiles from the cloud database to the laptop. Accounts and general
   application settings stay in the cloud:

   ```sh
   npm run migrate:iot
   ```

   This copies sensors, sensor readings, local plant profiles, and monitoring
   station setup. Watering settings and history import automatically when the
   cloud connects. The command does not copy accounts, general application
   settings, orders, or shop data, and does not delete source records.
   Existing local documents with the same IDs are kept. Run it again later to
   copy newly added source records; already copied documents are skipped.
4. Admin accounts remain in the cloud database. If there is no cloud admin,
   create one from `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env`:

   ```sh
   npm run seed:admin
   ```

   The command does not replace an existing cloud account.

## Start the local server and dashboard

From `server`:

```sh
npm run dev
```

The server waits for the laptop MongoDB, then starts even if the cloud
application database is unavailable. Check both database statuses at:

```text
http://localhost:4000/api/health
```

The response should show `plant: connected`. `shop` can be `connected` or
`unavailable`; ESP32 telemetry and watering controls use the local database.
Sign in once while online so your admin/staff account is cached locally for
offline use. Start the
admin dashboard on the laptop as usual. It uses the page's host name to reach
port 4000, so it also works when opened from another device on the LAN. To open
the development page from another device, bind its dev server to all interfaces
(`HOST=0.0.0.0 npm start` on macOS/Linux; set `$env:HOST="0.0.0.0"` before
`npm start` in PowerShell) and allow its port through the laptop firewall.
If a frontend `.env` already sets `REACT_APP_API_URL` to `localhost`, remove
that setting for LAN use or change it to the laptop's LAN address.

## Configure and upload the ESP32

1. In the `ESP32` folder, copy `halamanhub_config.example.h` to
   `halamanhub_config.h`.
2. Set `HALAMANHUB_DEVICE_ID` if you have more than one device. No Wi-Fi name,
   password, laptop IP, or device token is needed in the ESP32 config.
3. Open `halamanhub_esp32_updated.ino` in Arduino IDE, install the libraries
   already used by the sketch (`DHT`, `ArduinoJson`) and select the ESP32
   board/port. Upload it over USB and keep the cable connected for readings and
   watering control. Close Arduino Serial Monitor before running the gateway;
   only one program can own the serial port at a time.
4. Set `IOT_DEVICE_TOKEN` in `server/.env`. Generate a random value on
   macOS/Linux with:

   ```sh
   openssl rand -hex 32
   ```

   In PowerShell, generate one with:

   ```powershell
   $bytes = New-Object byte[] 32
   $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
   $rng.GetBytes($bytes)
   -join ($bytes | ForEach-Object { $_.ToString('x2') })
   $rng.Dispose()
   ```

   Keep the 64-character result private. The Python gateway reads this key from
   `server/.env` and sends it to the local API; it is not flashed onto the ESP32.
5. Install pyserial and start the gateway from the project root on Windows:

   ```sh
   py -m pip install pyserial
   py server/scripts/python_usb_gateway.py --port COM5
   ```

   Replace `COM5` with the ESP32 port shown in Device Manager. The gateway can
   auto-detect a single likely ESP32 serial port if `--port` is omitted. Confirm
   the terminal reports that readings are saved, and leave the gateway running.
   On macOS, use `python3 -m pip install pyserial` and
   `python3 server/scripts/python_usb_gateway.py --port /dev/cu.YOUR_ESP32_PORT`.
   From `server`, `npm run usb-gateway -- --port YOUR_PORT` chooses `py` on
   Windows or `python3` on macOS and forwards the port argument.

## How control updates reach the ESP32

When staff save Auto/Manual mode, dry/wet thresholds, pump/backup-line controls,
tank calibration, or pulse timing in the admin, the server stores the settings
in local MongoDB. The Python gateway polls the local API every five seconds;
the server reads the local settings and sends them over USB. The ESP32 validates and saves them, then
acknowledges the version. Its next reading reports the applied version, which
the admin uses to show whether the settings reached the device.

The ESP32 runs its sensor and relay safety loop without Wi-Fi. It keeps the
last accepted settings in its own memory, so Auto mode continues when USB, the
laptop gateway, or cloud is temporarily unavailable. New dashboard control
changes need the laptop server, local MongoDB, USB gateway, and a cached admin
or staff login; internet is not required. On the first start, existing cloud
watering settings are imported if available. If the first start happens
offline, local defaults are shown but are not sent to the ESP32 until staff
review and save them or the cloud settings are imported. Local staff changes
take priority when the cloud reconnects. Soil and tank readings are
considered stale after 12 seconds. If either becomes stale during watering, both outputs
turn off and watering pauses for safety until an admin resets the pause after
fresh readings return. The safety pause is saved on the ESP32 and remains after
a restart. A reset is accepted only after fresh soil and tank readings return.

Manual pump and backup-line commands expire after five minutes. If the ESP32
does not receive a settings heartbeat from the laptop gateway for 15 seconds
during manual watering, it switches both outputs off. After a restart, it clears any old manual-on
command. After a gateway-loss stop, staff must clear the old manual command in
the admin before turning it on again; the ESP32 reports this stop so the server
clears the old command. Auto/Manual thresholds and timing remain
available without a cloud connection because they are stored locally.

## Check offline control before a demo

1. While online, sign in as an admin or staff member once so the account is
   cached on the laptop. Confirm `/api/health` reports `plant: connected` and
   the gateway reports saved readings.
2. Open **Watering**, save a small dry/wet threshold change, and wait for the
   page to show the ESP32 applied the new settings version.
3. Disconnect the laptop from the internet, keeping local MongoDB, the
   HalamanHub server, Python gateway, and USB cable running. Sign in with the
   same cached staff account if needed.
4. Change the dry/wet thresholds again. Confirm the gateway prints an ESP32
   acknowledgement and the page shows the applied version. Manual controls
   also work here when fresh tank readings and the safety checks allow it.
5. Reconnect the internet. The laptop sends local watering settings and history
   to the cloud automatically and retries every 15 seconds. The separate offline
   viewer account can only read the live page.

The ESP32 samples every two seconds and keeps up to 60 readings (about two
minutes) in a RAM queue if the laptop gateway is briefly unreachable. It sends
the oldest saved reading first and removes it only after the laptop confirms
that the reading was saved or was already present in local MongoDB. The laptop
time is included with each sample, so restored history keeps its approximate sampling time. The
buffer is held in RAM, so an ESP32 restart clears queued readings. The device
records when it restarts with unsent readings; a longer outage fills the queue
and the admin dashboard reports how many later samples were skipped. Keep the
ESP32 powered and the USB cable connected during a short gateway interruption.
One device can create up to 43,200 history records per day at the normal
two-second rate, so back up the
local database regularly. From the `server` folder, run:

```sh
npm run backup:iot
```

This uses MongoDB Database Tools (`mongodump`) and saves a compressed backup
under `server/backups/`. Install MongoDB Database Tools if `mongodump` is not
found; on Windows, make sure `mongodump.exe` is on PATH. Backups are excluded
from Git. Restore into an empty local database with MongoDB Database Tools:

```sh
mongorestore --gzip --uri="mongodb://127.0.0.1:27017/halamanhub_iot" "PATH_TO_BACKUP/halamanhub_iot"
```

Stop the HalamanHub server before restoring. Keep at least one backup on a
separate drive; a backup stored only on the laptop will not protect against
laptop failure. The restore command is intended for an empty database. It
does not delete old history automatically.

## Daily operation checks

Before moving the soil probe, open **Watering** and turn the shared system off.
Wait for the ESP32 to confirm the pump and backup line are off. Physically
place the probe in the new bed, then open **Growing areas** and choose **Probe
is now here**. Wait for a fresh reading before using that area's values. The
other beds keep their last measurements and history. Turn watering back on only
after moving the probe to the original watered bed and receiving a fresh soil
and tank reading.

The RS485 soil probe reports its own moisture, pH, EC, and NPK values. Compare
its readings with the probe maker's guide or a known reference before relying
on them; assigning a growing area does not calibrate the probe. For watering
history, the admin saves pump run time and compares soil wetness before watering
with the next Auto reading when the cycle finishes. This confirms the soil
response, but does not confirm water flow unless a flow sensor is installed.

## Troubleshooting

- **No readings arrive:** check that the USB cable supports data, close Arduino
  Serial Monitor, confirm the correct COM port, and keep the Python gateway open.
- **Gateway reports HTTP 401:** set `IOT_DEVICE_TOKEN` in `server/.env`,
  restart the server, and restart the Python gateway.
- **Gateway reports HTTP 503 while forwarding readings:** check local MongoDB
  and `/api/health`. A settings-poll 503 on a new offline laptop means the
  local default watering settings still need review and saving in **Watering**.
- **Gateway cannot open the serial port:** close Arduino Serial Monitor or any
  other program using that COM port, then restart the gateway.
- **`plant` is disconnected:** start the MongoDB service/process and confirm
  `IOT_MONGODB_URI` uses `127.0.0.1:27017`.
- **Admin login does not work:** accounts are created in Atlas and copied to
  the laptop while online. Sign in once online to cache the account; then the
  same credentials work while the cloud is unavailable. The separate offline
  viewer account cannot change watering. If no admin exists, run
  `npm run seed:admin` from `server` while online.
- **Shop pages show an unavailable message:** check the laptop's internet
  connection and cloud URI. The sensor and watering APIs remain local.
- **Sensor history is empty:** the gateway should report that readings were
  saved. Migration copies past records; it does not create new samples.
- **Manual watering stops:** it ends after five minutes or after 15 seconds
  without a successful local gateway response. Reconnect the ESP32, check fresh
  soil/tank readings, and clear any old manual-on switch before enabling it.
- **Watering is paused for safety:** wait for fresh soil and tank readings,
  check the cause, then use **Reset safety pause** on the Watering page.

## Files changed for this workflow

- `server/config/connections.js` keeps readings, local plants, and watering
  data on the laptop; accounts and shop data use the cloud.
- `server/config/db.js` requires local MongoDB and reconnects to the cloud
  application database in the background.
- `server/scripts/migrateIotData.js` copies ESP32 readings and local plant data without
  deleting or replacing records.
- `ESP32/halamanhub_esp32_updated.ino` sends acknowledged telemetry and receives
  validated settings over USB serial; it does not use Wi-Fi.
- `ESP32/halamanhub_config.example.h` contains the ESP32 device ID only.
- `server/scripts/python_usb_gateway.py` relays readings and settings between
  the USB serial port and the laptop API.
- `server/scripts/backupLocalIot.js` creates compressed local MongoDB backups.
