# HalamanHub local Wi-Fi plant system

## Architecture

```text
Soil, air, water sensors + relays
              │
              ▼ local Wi-Fi / HTTP (no internet needed)
            ESP32
              │  POST /api/sensor-data every 2 seconds
              │  GET  /api/irrigation/control for settings
              ▼
      HalamanHub server on laptop :4000
          │                         │
          │ loopback only           └── Internet, when available
          ▼                                  ▼
   Local MongoDB                     Cloud shop MongoDB
   plant readings                    products, customers,
   history, watering                  orders, payments,
   settings, admin, plant profiles     cloud plant profiles
```

The ESP32 talks to the laptop server over the local Wi-Fi network. It never
connects directly to MongoDB. MongoDB stays on the laptop at `127.0.0.1` and
is not exposed to the Wi-Fi network. Shop products, customer accounts, online
orders, and payment processing stay in the existing cloud database.

The admin dashboard's **Your plants** list uses local plant profiles. Staff can
create profiles on the laptop or copy selected shop products into the local
list. A copied product stores the plant name, category, and photo; soil targets
are managed in the local plant profile. It does not copy price, stock, customer,
or order data. The **Sync plant profiles** action copies profiles that are
missing by plant name and category between local profiles and the separate
`cloudplantprofiles` collection in the cloud database. Matching profiles are
left unchanged, including their soil targets. This collection is separate from
shop Products, so a synced plant profile does not become a customer listing.
Local profiles remain available without internet. In **Settings → Soil
monitoring setup**, staff name the growing area and choose the plant profiles
represented by the one shared soil probe. Dashboard comparisons use only those
selected profiles. The readings are a representative sample for that area,
not separate measurements for every plant.

To sell a locally saved plant, open **Products**. The page lists local plants
that do not already match a shop product. Choose **Set up shop listing**, then
add the customer-facing image, price, unit, and stock before saving. This
creates a Product in the cloud shop inventory and links it to the local profile;
it does not overwrite the profile's soil targets.

The laptop can have a separate internet connection for the online shop. When
the cloud database or internet is unavailable, plant readings and watering
settings continue on the local network; online orders and payments need
internet and the cloud database.

## Network choice

Use one Wi-Fi network that both the laptop and ESP32 can join. It does not need
an internet connection. Since you do not have a private local Wi-Fi network,
the most dependable option is a small travel router or access point. Connect
the laptop and ESP32 to it, and leave its internet/WAN port unplugged. The
laptop can use a separate connection for internet, such as Ethernet or USB
tethering.

A phone hotspot can be used to try the setup. Local ESP32-to-laptop traffic
stays inside that hotspot network, even if its internet is slow. A standalone
router is more reliable for daily use and does not depend on the phone. Make
sure Wi-Fi client/AP isolation is off; that setting prevents devices on the
same Wi-Fi from reaching each other. Reserve a fixed local address for the
laptop if the router supports it.

The sketch only sends requests to the laptop's local IP. A phone hotspot may
still give the ESP32 a route to the internet, but the sketch does not use it.
To ensure the ESP32 has no internet route at all, use a router/access point
with its WAN port disconnected.

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
3. From the `server` folder, copy existing local plant/admin records and keep
   the source records in the cloud:

   ```sh
   npm run migrate:iot
   ```

   This copies admin users, sensor readings/history, irrigation settings and
   logs, alerts, and activity history. It does not copy or delete shop data.
   Existing local documents with the same IDs are kept. Run it again later to
   copy newly added source records; already copied documents are skipped.
4. If you are starting with no existing local admin user, create one from the
   `ADMIN_USERNAME` and `ADMIN_PASSWORD` values already stored in `.env`:

   ```sh
   npm run seed:local-admin
   ```

   The command does not replace an existing account. You only need this if the
   migration did not copy a user.

## Start the local server and dashboard

From `server`:

```sh
npm run dev
```

The server waits for the laptop MongoDB, then starts even if the cloud shop
database is unavailable. Check its database status at:

```text
http://localhost:4000/api/health
```

The response should show `plant: connected`. `shop` can be `connected` or
`unavailable`; plant monitoring does not depend on the shop status. Start the
admin dashboard on the laptop as usual. It uses the page's host name to reach
port 4000, so it also works when opened from another device on the LAN. To open
the development page from another device, bind its dev server to all interfaces
(`HOST=0.0.0.0 npm start` on macOS/Linux; set `$env:HOST="0.0.0.0"` before
`npm start` in PowerShell) and allow its port through the laptop firewall.
If a frontend `.env` already sets `REACT_APP_API_URL` to `localhost`, remove
that setting for LAN use or change it to the laptop's LAN address.

## Find the laptop's Wi-Fi address

### macOS

Connect the laptop to the router/hotspot, then run:

```sh
ipconfig getifaddr en0
```

If that prints nothing, open **System Settings → Wi-Fi → Details** for the
connected network and find its IP address. Use the address for the same
network that the ESP32 will join.

### Windows

Connect the laptop to the router/hotspot, open Command Prompt, and run:

```bat
ipconfig
```

Under the connected Wi-Fi adapter, use its **IPv4 Address**. Do not use
`127.0.0.1` or the address shown for an unrelated VPN/virtual adapter.

## Configure and upload the ESP32

1. In the `ESP32` folder, copy `halamanhub_config.example.h` to
   `halamanhub_config.h`.
2. Set the router/hotspot name and password, then set `HALAMANHUB_LAPTOP_IP`
   to the laptop's Wi-Fi IPv4 address. Both devices must join the same network.
3. Open `halamanhub_esp32_updated.ino` in Arduino IDE, install the libraries
   already used by the sketch (`DHT`, `ArduinoJson`) and select the ESP32
   board/port. Upload it over USB once. The cable can be removed after upload;
   USB is not needed for regular readings or watering control.
4. Set the required device access key in both `server/.env` and
   `ESP32/halamanhub_config.h`. Generate a random value on macOS/Linux with:

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

   Copy the same 64-character result into `IOT_DEVICE_TOKEN` and
   `HALAMANHUB_DEVICE_TOKEN`. Keep it private. Restart the server and upload
   the sketch again after changing the token. The server rejects ESP32 requests
   until this key is configured.
5. Check the Arduino Serial Monitor once for `Wi-Fi Connected! IP: ...` and
   `Reading accepted by laptop gateway (HTTP 202)`. Serial output is
   diagnostic; the server receives readings over Wi-Fi.

## How control updates reach the ESP32

When staff save Auto/Manual mode, thresholds, pump/backup-line controls, tank
calibration, or pulse timing in the admin, the server stores those settings in
local MongoDB. The ESP32 checks the local control route every five seconds,
validates the response, applies it in the sensor/control loop, and reports the
settings version in its next reading. The admin shows whether the ESP32 has
confirmed the latest settings.

Wi-Fi and HTTP run in a separate ESP32 task. A slow laptop request does not
hold up the main sensor and relay loop. The ESP32 keeps the last accepted
automatic settings in its own memory, so Auto mode can continue when the
gateway connection is temporarily lost. Soil and tank readings are considered
stale after 12 seconds. If either becomes stale during watering, both outputs
turn off and watering pauses for safety until an admin resets the pause after
fresh readings return. The safety pause is saved on the ESP32 and remains after
a restart. A reset is accepted only after fresh soil and tank readings return.

Manual pump and backup-line commands expire after five minutes. If the ESP32
cannot reach the laptop gateway for 15 seconds during manual watering, it
switches both outputs off. After a restart, it clears any old manual-on
command. After a gateway-loss stop, staff must clear the old manual command in
the admin before turning it on again; the ESP32 reports this stop so the server
clears the old command. Auto/Manual thresholds and timing remain
available without a cloud connection because they are stored locally.

The ESP32 samples every two seconds and keeps up to 60 readings (about two
minutes) in a RAM queue if the laptop gateway is briefly unreachable. It sends
the oldest saved reading first and removes it only after the laptop confirms
that the reading was saved in local MongoDB. The laptop time is included with
each sample, so restored history keeps its approximate sampling time. The
buffer is held in RAM, so an ESP32 restart clears queued readings. The device
records when it restarts with unsent readings; a longer outage fills the queue
and the admin dashboard reports how many later samples were skipped. Keep the
ESP32 powered during a short network interruption. One device can create up to
43,200 history records per day at the normal two-second rate, so back up the
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

Before using Auto watering for a new bed, open **Settings → Soil monitoring
setup**. Set the monitoring station name and bed, select the plant profiles
that the one probe represents, then work through the four field checks. Add a
short note and the staff member is recorded automatically with each check.
Moving the probe to a different bed or changing the selected plants clears the
soil placement and reading checks so the new area is checked before relying on
it.

The RS485 soil probe reports its own moisture, pH, EC, and NPK values. The setup
page records that staff checked placement and readings against the probe's
guide; it does not change the probe's built-in calibration. For watering
history, the admin saves pump run time and compares soil wetness before watering
with the next Auto reading when the cycle finishes. This confirms the soil response,
but does not confirm water flow unless a flow sensor is installed.

## Troubleshooting

- **ESP32 joins Wi-Fi but cannot reach the API:** confirm the IP in the config
  header, confirm both devices use the same Wi-Fi, turn off client isolation,
  and allow Node.js on the laptop's private network firewall.
- **`plant` is disconnected:** start the MongoDB service/process and confirm
  `IOT_MONGODB_URI` uses `127.0.0.1:27017`.
- **Login does not work after switching to the local database:** run
  `npm run migrate:iot` to copy the old admin user, or use
  `npm run seed:local-admin` if starting fresh.
- **Shop pages show an unavailable message:** check the laptop's internet
  connection and cloud URI. The sensor and watering APIs remain local.
- **Sensor history is empty:** live readings should update after the ESP32
  reports HTTP 202. Migration copies past records; it does not create samples.
- **ESP32 receives HTTP 401 or 503:** copy the same private device token into
  `server/.env` and `ESP32/halamanhub_config.h`, restart the server, and upload
  the sketch again.
- **Manual watering stops:** it ends after five minutes or after 15 seconds
  without a successful local gateway response. Reconnect the ESP32, check fresh
  soil/tank readings, and clear any old manual-on switch before enabling it.
- **Watering is paused for safety:** wait for fresh soil and tank readings,
  check the cause, then use **Reset safety pause** on the Watering page.

## Files changed for this workflow

- `server/config/connections.js` assigns local, admin, and shop models to the
  appropriate database connection.
- `server/config/db.js` requires local MongoDB and reconnects to the optional
  cloud shop database in the background.
- `server/scripts/migrateIotData.js` copies plant/admin records without
  deleting or replacing records.
- `ESP32/halamanhub_esp32_updated.ino` sends telemetry and receives controls
  through local Wi-Fi, keeps network work off its safety loop, and applies
  stale-reading and manual-command failsafes.
- `ESP32/halamanhub_config.example.h` is a template for private Wi-Fi values.
- `server/scripts/backupLocalIot.js` creates compressed local MongoDB backups.
