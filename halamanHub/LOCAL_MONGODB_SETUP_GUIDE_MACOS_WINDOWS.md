# Local MongoDB Setup for HalamanHub

This guide installs MongoDB Community Server on the laptop that runs HalamanHub. The API connects to MongoDB; the ESP32 never connects directly to the database.

## How the current project connects

The server uses two MongoDB connections:

- `IOT_MONGODB_URI` points to MongoDB on the laptop. Sensor records, local plant profiles, watering settings, and watering history are saved here so monitoring and controls continue when the internet or cloud database is unavailable.
- `SHOP_MONGODB_URI` points to the cloud database for accounts, products, orders, and other shop data. When this connection returns, the server automatically copies local sensor snapshots, sensor reading history, watering settings, and watering history to the cloud. Order data is not queued or copied.

Admin and staff accounts are copied from the cloud database to the laptop as an offline login cache. Keep the server running while online so account changes can sync. Offline sign-in uses the last cached password and account status; order and other cloud-only actions still require internet access.

The **Watering** and rain-tank calibration controls use local settings. A cached admin or staff account can change them while the internet is down, provided the local MongoDB, server, USB gateway, and ESP32 are running. On a new laptop, connect once to import older cloud watering settings. If the first start is offline, review and save the displayed local defaults before they are sent to the ESP32. The offline viewer account remains read-only.

For a local database, use:

```text
mongodb://127.0.0.1:27017/halamanhub_iot
```

Keep `IOT_MONGODB_URI` pointed at the laptop database and set `SHOP_MONGODB_URI` to your MongoDB Atlas connection string. `MONGODB_URI` is also accepted as a legacy cloud URI. For an internet-facing shop, host the API and its database where customers can reach them; a local-only API address is not a public shop URL.

## macOS

### Install MongoDB with Homebrew

1. Install Homebrew from <https://brew.sh/> if needed.
2. Open Terminal and run:

   ```sh
   brew tap mongodb/brew
   brew update
   brew install mongodb-community@8.0
   brew services start mongodb-community@8.0
   ```

3. Confirm that the service started:

   ```sh
   brew services list
   ```

   `mongodb-community@8.0` should say `started`.

4. Connect to the local database:

   ```sh
   mongosh "mongodb://127.0.0.1:27017/halamanhub_iot"
   ```

   At the `mongosh` prompt, run:

   ```javascript
   db.runCommand({ ping: 1 })
   ```

   Look for `ok: 1`, then type `exit`.

If `mongosh` is missing, install it with `brew install mongosh` or use MongoDB's [official Shell downloads](https://www.mongodb.com/try/download/shell). If Homebrew reports that Command Line Tools are outdated, the failed install did not install MongoDB. Check **System Settings → General → Software Update**, or try `xcode-select --install`. This updates developer tools separately from macOS. Do not delete the existing Command Line Tools folder. If no compatible tools update is available, see MongoDB's [official macOS install options](https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-os-x/) or use Atlas.

Stop or start the background service later with:

```sh
brew services stop mongodb-community@8.0
brew services start mongodb-community@8.0
```

### Point HalamanHub to MongoDB

1. Create `server/.env` in the project folder if it does not already exist.
2. Add the local URI and required application settings:

   ```env
   IOT_MONGODB_URI=mongodb://127.0.0.1:27017/halamanhub_iot
   SHOP_MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<database>
   JWT_SECRET=replace-this-with-a-long-random-secret
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=replace-this-with-a-password
   PORT=4000
   CLIENT_ORIGIN=http://localhost:3000
   SHOP_ORIGIN=http://localhost:3001
   ```

3. Generate a random secret in Terminal with:

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Replace the example `JWT_SECRET` and choose your own admin password. Keep `.env` private; Git ignores it.

## Windows

### Install MongoDB Community Server

1. Download the Windows MSI from <https://www.mongodb.com/try/download/community>.
2. Run the installer, choose **Complete**, and leave **Install MongoD as a Service** selected. MongoDB Compass is optional.
3. Finish installation. Open PowerShell and check the service:

   ```powershell
   Get-Service MongoDB
   ```

   If it is stopped, open PowerShell as Administrator and run:

   ```powershell
   Start-Service MongoDB
   ```

4. MongoDB Shell (`mongosh`) may need to be installed separately. Get it from <https://www.mongodb.com/try/download/shell>, then close and reopen PowerShell.
5. Connect to MongoDB:

   ```powershell
   mongosh "mongodb://127.0.0.1:27017/halamanhub_iot"
   ```

   At the `mongosh` prompt, run `db.runCommand({ ping: 1 })`. Look for `ok: 1`, then type `exit`.

See MongoDB's [official Windows install guide](https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-windows/) for installer details.

### Point HalamanHub to MongoDB

1. Create `server/.env` in the project folder if it does not already exist.
2. In Notepad, choose **Save as type: All files** and save the filename as `.env` (not `.env.txt`). Add:

   ```env
   IOT_MONGODB_URI=mongodb://127.0.0.1:27017/halamanhub_iot
   SHOP_MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<database>
   JWT_SECRET=replace-this-with-a-long-random-secret
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=replace-this-with-a-password
   PORT=4000
   CLIENT_ORIGIN=http://localhost:3000
   SHOP_ORIGIN=http://localhost:3001
   ```

3. Generate a random secret in PowerShell:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Replace the example `JWT_SECRET` and choose your own admin password. Keep `.env` private; Git ignores it.

## Seed a new development database

The project seed creates an admin account using `ADMIN_USERNAME` and `ADMIN_PASSWORD`. It also adds sample products, orders, sensors, watering zones, schedules, alerts, and default settings to collections that are empty.

Run this only when you intend to create demo data, from the `server` folder:

```sh
npm run seed
```

The same command works in PowerShell. It skips collections that already contain records. If you want a clean empty database, skip seeding and add the required records through the app.

## Confirm the API connection

1. Make sure MongoDB is running.
2. From the project folder, start the API and admin dashboard:

   ```sh
   npm run dev
   ```

   PowerShell uses the same command.

3. Open <http://localhost:4000/api/health>. Check `databases.plant` for `connected`. The `databases.shop` value can be `unavailable` while local monitoring and watering still work.

Use MongoDB Compass with `mongodb://127.0.0.1:27017` to browse the database and collections. Collections appear after seed data is added or the app first saves records.

## Useful commands

| Task | macOS Terminal | Windows PowerShell |
|---|---|---|
| Check MongoDB service | `brew services list` | `Get-Service MongoDB` |
| Start MongoDB | `brew services start mongodb-community@8.0` | `Start-Service MongoDB` (Administrator) |
| Stop MongoDB | `brew services stop mongodb-community@8.0` | `Stop-Service MongoDB` (Administrator) |
| Connect with shell | `mongosh "mongodb://127.0.0.1:27017/halamanhub_iot"` | `mongosh "mongodb://127.0.0.1:27017/halamanhub_iot"` |

Keep MongoDB connection strings and passwords in `server/.env`. Do not put them in `src/`, `mapili/`, or any other browser code.

For complete app setup, including Node.js, frontends, ESP32 Wi-Fi, and USB serial, see the [main README](README.md).
