# HR Transport

A mobile transport desk for **Android and iOS**, with one login and separate HR, sub-department and driver workspaces. The code, dependencies, database files and project development caches are kept under **D:\HRTransport**.

## What is included

| HR | Sub-department | Driver |
| --- | --- | --- |
| Create and edit driver and department accounts | Request a driver | View assigned/upcoming trips |
| Set vehicle type, registration and passenger capacity | Enter pickup, destination, stops, schedule, kilometres and contact details | Set availability and update profile photo |
| Upload a driving licence and record expiry/notes | Track assignment and trip status | Call HR and trip contacts |
| Assign a suitable available driver | Cancel requested/assigned trips with a reason | Start/finish a trip using odometer readings |
| Reject/cancel requests and reset passwords | Rate a completed journey once | See month-to-date distance, trips and rating |
| View driver details and export Excel reports | Review trip history | Read feedback on completed trips |

Assignments check vehicle type, capacity, licence document, licence expiry and overlapping bookings. Concurrent assignments are protected by MongoDB transactions. Accounts can be deactivated without deleting their history.

## 1. First-time setup on Windows

Requirements: Node.js **22.14 or newer**, an internet connection for initial downloads, and an Android phone with Expo Go or an Android emulator. Node is already installed on this laptop; it can be used from C: while the project and packages stay on D:.

Open PowerShell:

```powershell
Set-Location D:\HRTransport
powershell -ExecutionPolicy Bypass -File .\scripts\Setup.ps1
```

The setup installs packages on D: and creates local environment files without overwriting existing ones. It generates a random API signing secret. If you prefer exact lockfile installs after initial setup, use `npm ci`.

Edit **D:\HRTransport\apps\api\.env**:

```dotenv
SEED_HR_NAME=HR Administrator
SEED_HR_EMAIL=your-hr-email@your-company.com
SEED_HR_PASSWORD=your-own-long-unique-password
HR_PHONE=your-HR-contact-number
EMERGENCY_PHONE=your-organisation-emergency-number
```

Replace the placeholder password before seeding. The example phone numbers are only examples: use numbers appropriate to your organisation. Do not commit `.env` files or put the MongoDB connection string in the mobile app.

## 2. Start MongoDB on D:

In terminal 1:

```powershell
Set-Location D:\HRTransport
. .\scripts\Use-D-Drive.ps1
npm run db
```

This downloads a development MongoDB binary on D: (or reuses the installation cache under `D:\HRTransport\node_modules\.cache\mongodb-memory-server`), starts a **single-node replica set** on localhost port 27017, and preserves data in `D:\HRTransport\data\mongodb`. Keep the terminal open. Stop it with Ctrl+C; do not delete the data folder. The helper uses `mongodb-memory-server` to manage a real MongoDB process with a persistent WiredTiger data directory; it is not a mock database.

The default API connection is:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/hr_transport?replicaSet=rs0
```

If another database already uses port 27017, stop this project's helper and use that database's actual replica-set URI instead. A standalone MongoDB instance without a replica set cannot provide the transaction guarantees used here.

For deployment, use MongoDB Atlas or an authenticated, maintained MongoDB replica set. The local helper is for development, bound to localhost with no database password. Do not expose its port to the network.

## 3. Create HR and start the backend

In terminal 2:

```powershell
Set-Location D:\HRTransport
. .\scripts\Use-D-Drive.ps1
npm run seed
npm run api
```

Seeding creates only your HR administrator and never overwrites an existing account. Sign in with the email/password from `.env`. HR then creates department and driver accounts inside the app. Share their initial passwords securely; each person can change their own password in Profile.

Health check: [http://localhost:4000/health](http://localhost:4000/health).

## 4. Run the Android app

### Quick start on this laptop (no physical phone needed)

Double-click **D:\HRTransport\Run Android.cmd**. This starts the backend and opens the app using an Android Studio virtual phone. Keep the terminal open. The launcher reuses the Android SDK and virtual phones already installed on this laptop when the project's D: SDK folder is empty; those existing Android files remain at their original locations.

Your local backend `.env` is configured for MongoDB Atlas, so you do not need `npm run db`. The HR login is stored in **apps\api\.env** under `SEED_HR_EMAIL` and `SEED_HR_PASSWORD`. Keep this file private. If Atlas stops connecting, check the cluster's Network Access settings for your current IP address.

If no virtual phone exists, open Android Studio → More Actions → Virtual Device Manager (or Tools → Device Manager), create a phone with an Android system image, and run the launcher again. Android Studio manages the virtual phone; Expo runs the app inside it.

Edit **D:\HRTransport\apps\mobile\.env**:

For an Android Studio emulator:

```dotenv
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000/api/v1
```

For a physical Android phone or iPhone on the same Wi-Fi:

```dotenv
EXPO_PUBLIC_API_URL=http://YOUR-LAPTOP-WIFI-IP:4000/api/v1
```

Find your laptop's Wi-Fi IPv4 address with `ipconfig`, for example `192.168.1.20`. Do not use `localhost` on a phone: that points to the phone itself. Allow the Node/Expo development servers on your **private** Windows network if prompted. Do not open MongoDB to the phone.

In terminal 3:

```powershell
Set-Location D:\HRTransport
. .\scripts\Use-D-Drive.ps1
npm run mobile
```

Scan the QR code with Expo Go (matching SDK 57). Press `a` to open an installed Android emulator. You can also run `npm run android` to start Expo and launch the emulator. After installing a native development build, use `npm run dev-client --workspace apps/mobile` instead.

To preview the UI in a browser, set the API URL to `http://localhost:4000/api/v1`, then run `npm run web`. Restart Expo after changing `.env`. The browser preview is useful for checking screens; device testing is still needed for file picking, calls, secure storage and sharing.

## Keeping storage on D:

Dot-source `. .\scripts\Use-D-Drive.ps1` in **every development terminal**. Settings apply to that terminal and child processes; existing machine-wide settings are not changed.

| Files / cache | Location |
| --- | --- |
| Project and dependencies | `D:\HRTransport` |
| npm | `D:\HRTransport\.cache\npm` |
| Temporary build files | `D:\HRTransport\.cache\temp` |
| Gradle | `D:\HRTransport\.cache\gradle` |
| Android SDK | `D:\HRTransport\.tools\android-sdk` |
| Emulator images / AVDs | `D:\HRTransport\.cache\android-avd` |
| Android preferences | `D:\HRTransport\.cache\android` |
| MongoDB binary | `D:\HRTransport\.cache\mongodb-binaries` |
| MongoDB data | `D:\HRTransport\data\mongodb` |

For Android Studio, choose a D: installation directory and set **Settings → Android SDK → SDK Location** to the SDK folder above. Launch Android Studio from a terminal where the script has run before creating an emulator, so it inherits the AVD location. If Android Studio is already running, fully close and reopen it from that terminal. Existing SDKs/emulators are not automatically moved. Set any JDK installation to a D: directory too if you install one.

Windows, user profiles, existing Node/Android Studio installations and some vendor-managed configuration may still write to C:. This project does not move Windows folders or guarantee zero C: usage. A physical phone with Expo Go avoids downloading a large Android SDK/emulator at all.

## iOS and installable builds

The same React Native code supports iOS. Windows cannot run Xcode or the iOS simulator. You can use an iPhone with Expo Go, or build a signed iOS app using EAS's macOS cloud builders. Native signing/distribution requires your Expo and Apple developer accounts. Android APKs can also be built in the cloud, saving local disk space.

From `D:\HRTransport\apps\mobile`:

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform ios --profile preview
```

Before building, choose your unique `android.package` and `ios.bundleIdentifier` in `app.json`, and configure `EXPO_PUBLIC_API_URL` in the corresponding EAS environment to your **public HTTPS backend URL**, including `/api/v1`. Preview and production binaries should use HTTPS. Local HTTP instructions above are for Expo Go development. Never put `JWT_SECRET` or `MONGODB_URI` in Expo's public environment.

The `development` profile includes `expo-dev-client`; the `preview` Android profile outputs an APK; `production` outputs store builds. iOS internal distribution uses registered devices and Apple provisioning. Creating a build does not publish it to a store.

Official references: [Expo SDK 57 support](https://docs.expo.dev/versions/v57.0.0/), [EAS Build configuration](https://docs.expo.dev/build/eas-json/), [Expo environment variables](https://docs.expo.dev/guides/environment-variables/).

## Excel and monthly reports

HR → Reports provides an inclusive date range, preview and `.xlsx` export. Each workbook has **Report details**, **Driver summary** and **Trip details** sheets: driver name, vehicle, actual kilometres, locations, rating counts/averages, individual feedback and odometer readings.

The default reporting timezone is **Asia/Colombo**, configurable via `REPORT_TIMEZONE`. Reports count trips by **completion date**, not request/departure date. Kilometres are calculated from end odometer minus start odometer; estimated kilometres are separate. Ratings exclude unrated trips.

The backend checks at startup and hourly. Once a month has closed, it saves a snapshot in MongoDB. Missed months since the earliest completed trip are backfilled. The backend must run for this to happen; opening the monthly report list also triggers catch-up. The report is available in the app, not automatically emailed. Monthly snapshots retain feedback as it existed at generation time; custom reports include feedback received later.

HR → People → Driver also exports that driver's month-to-date workbook.

## Future versions

- Mobile screens, API services, database models and reporting are separate modules. API routes are versioned under `/api/v1`.
- Add backwards-compatible API fields before requiring them in new mobile versions. Use explicit database migration scripts for schema changes; back up first.
- Increment `expo.version` and the package versions for releases. `runtimeVersion` uses `appVersion` so incompatible native binaries do not receive the same update.
- To enable over-the-air JS/asset updates, link your own EAS project and run `npx eas-cli@latest update:configure`, then use a preview channel before production: `npx eas-cli@latest update --channel preview --message "Describe the update"`.
- Native-library/configuration changes require a new binary. EAS project/account IDs are intentionally not invented in this repository.

## Verification

```powershell
Set-Location D:\HRTransport
. .\scripts\Use-D-Drive.ps1
npm test
npm run typecheck
npm run lint
Set-Location apps\mobile
npx expo install --check
npx expo export --platform all
```

Integration tests use a separate temporary MongoDB replica set and do not access your `.env` database. They cover permissions, private licence documents, conflicting concurrent bookings, vehicle/licence restrictions, trip states, odometer validation, feedback, Excel contents, reporting timezone boundaries and password-reset session invalidation.

## Current boundaries

This is a functional first version, not an app-store release. It has not been tested on a physical Android or iPhone here. Before live use, test the full workflow on both devices, configure HTTPS, database authentication/backups, real contact numbers and your distribution accounts.

- Distances are manually estimated and actual distance is odometer-based; there is no live GPS tracking or automatic routing-distance service. Maps links open the entered pickup and destination externally; other stops are shown as notes.
- Licence expiry is entered and checked by HR; uploads are not OCR-verified. Photos must be JPEG/PNG and licences JPEG/PNG/PDF, up to 5 MB each.
- Data refreshes on opening screens or pulling down; there are no background push notifications, offline mutation queues or email delivery yet.
- Each department account represents one sub-department. Multiple staff per department and multi-organisation tenancy are future extensions.
- Drivers have one current vehicle record. Trip lists show the latest 500 records; full report queries include all matching completed trips. Very large organisations should add paginated lists and streaming/background report storage.
- A trip can start up to one hour before departure. HR cannot cancel a trip already in progress. Estimated schedules cannot guarantee real-world availability if a preceding trip overruns; an in-progress trip blocks new assignments and starting another trip.
- Monthly snapshots use the driver's current display details when generated; editing a driver name/vehicle changes later custom report labels. Historical vehicle snapshots and audit records for account edits would be useful future additions.
