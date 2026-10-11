# Local MongoDB Setup Guide

Install MongoDB Community on the laptop that runs the HalamanHub API. The API
uses this local database for plant monitoring and watering. The ESP32 sends
readings to the API over Wi-Fi; it never connects directly to MongoDB.

## How HalamanHub uses the databases

| Data | Database |
|---|---|
| Sensor readings and history, irrigation settings and logs, admin accounts, alerts, activity, plant profiles, monitoring setup | Local MongoDB on the laptop |
| Shop products, customer accounts, orders, payments, and synced cloud plant profiles | Cloud MongoDB |

The local connection is:

```text
mongodb://127.0.0.1:27017/halamanhub_iot
```

Keep MongoDB bound to `127.0.0.1`. The ESP32 communicates with the laptop's
API over local Wi-Fi, not with the database port. The online shop needs the
laptop's internet connection and cloud database; monitoring and watering can
continue on the local network when they are unavailable.

## macOS

### Requirements

- Homebrew
- A macOS version supported by the MongoDB release you install
- Apple's Command Line Tools if Homebrew requests them

Install Homebrew using its [official installation guide](https://brew.sh/).

### Install and start MongoDB

Open Terminal and run:

```sh
brew tap mongodb/brew
brew trust mongodb/brew
brew update
brew install mongodb-community@8.0
brew services start mongodb-community@8.0
```

Check that the service is running:

```sh
brew services list
```

### Connect and verify

The MongoDB server and `mongosh` shell are separate tools. If `mongosh` is
already installed, run:

```sh
mongosh "mongodb://127.0.0.1:27017"
```

At the `mongosh` prompt, run:

```javascript
db.runCommand({ ping: 1 })
```

A successful response contains `ok: 1`. If the terminal says `mongosh: command not found`, install MongoDB Shell from the [official download page](https://www.mongodb.com/try/download/shell), then open a new Terminal window and repeat the connection command.

To stop the background service later:

```sh
brew services stop mongodb-community@8.0
```

If Homebrew reports that the Command Line Tools are outdated, the MongoDB
formula was not installed. Check **System Settings → General → Software
Update**, or run `xcode-select --install` to ask Apple for a compatible tools
update. This is separate from upgrading macOS. If Apple does not offer
compatible tools for your current macOS, follow MongoDB's [official macOS
installation guide](https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-os-x/)
for another supported installation option. Do not treat a failed Homebrew
install as a running MongoDB service.

## Windows

### Install MongoDB Server

1. Open the [MongoDB Community download page](https://www.mongodb.com/try/download/community).
2. Select Windows and the MSI package, then download it.
3. Run the installer and choose **Complete**.
4. Select **Install MongoD as a Service**. Keep the default service name
   `MongoDB`. MongoDB Compass is optional.
5. Finish the installer. The service should start automatically.

MongoDB Server does not include `mongosh`; install the shell separately from
the [official MongoDB Shell download page](https://www.mongodb.com/try/download/shell).
If the installer offers it, add `mongosh` to `PATH`.

### Connect and verify

Open PowerShell or Command Prompt and run:

```powershell
mongosh "mongodb://127.0.0.1:27017"
```

At the `mongosh` prompt, run:

```javascript
db.runCommand({ ping: 1 })
```

A successful response contains `ok: 1`.

To check the service in PowerShell:

```powershell
Get-Service MongoDB
```

Start or stop it with:

```powershell
Start-Service MongoDB
Stop-Service MongoDB
```

You can also open the Windows **Services** app and find `MongoDB`.
See MongoDB's [official Windows installation guide](https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-windows/).

## Connect HalamanHub to local MongoDB

1. Confirm MongoDB is running and the `ping` command returned `ok: 1`.
2. In `server/.env`, set the local connection:

   ```env
   IOT_MONGODB_URI=mongodb://127.0.0.1:27017/halamanhub_iot
   ```

3. Keep the existing cloud MongoDB URI for shop data. You can keep it in
   `MONGODB_URI`, or set it explicitly in `SHOP_MONGODB_URI`:

   ```env
   SHOP_MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<database>
   ```

   If both `SHOP_MONGODB_URI` and `MONGODB_URI` are set, the shop uses
   `SHOP_MONGODB_URI`. `IOT_MONGODB_URI` selects the laptop database for plant
   and watering data. If you omit it, older installations can continue using
   one database for both groups.

4. Start the API from the `server` folder:

   ```sh
   npm start
   ```

   In PowerShell, the same command is `npm start`.

5. Open the health check at <http://localhost:4000/api/health>. It should show
   `plant: connected`. The shop database can show `connected`, `unavailable`,
   or `not-configured`; local plant monitoring does not depend on it.

Keep database URIs and passwords in `server/.env`. Do not put them in frontend
code or share them publicly.

## Move existing monitoring data to the laptop

If monitoring, admin, or watering records already exist in the cloud database,
keep that URI in `MONGODB_URI` or `SHOP_MONGODB_URI`, set `IOT_MONGODB_URI` to
the local address above, then run this from `server/`:

```sh
npm run migrate:iot
```

The migration copies admin accounts, settings, alerts, activity, sensors,
sensor readings, irrigation settings, logs, zones, and schedules. It keeps
existing local records with matching IDs and does not modify or delete the
source records. It does not copy shop products, customers, or orders. If no
admin account was copied, create one using the configured local admin
credentials:

```sh
npm run seed:local-admin
```

For ESP32 Wi-Fi setup, laptop IP address, device token, backup, and offline
behavior, see [LOCAL_WIFI_IOT_WORKFLOW.md](LOCAL_WIFI_IOT_WORKFLOW.md).
