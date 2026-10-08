<div align="center">

# HR Transport

**Workplace transport management for HR teams, departments, and drivers.**

Coordinate requests, assign drivers, manage vehicle records, and report on completed journeys from one mobile application.

[Features](#features) · [Getting Started](#getting-started) · [Deployment](#deployment) · [Android APK](#android-apk) · [Documentation](#documentation)

</div>

---

## Overview

HR Transport provides a shared transport desk for organisations managing staff journeys. A single sign-in gives each user access to the tools appropriate to their role, from requesting a vehicle to assigning a driver and reviewing distance travelled.

The project includes an Expo / React Native mobile application and an Express API backed by MongoDB. Android emulator development is supported; the mobile code also targets iOS. Physical-device and release validation should be completed before an organisational rollout.

## Features

| Workspace | Capabilities |
| --- | --- |
| **HR administration** | Manage driver and department accounts, maintain vehicle and licence records, assign drivers, review journeys, and export Excel reports. |
| **Departments** | Request transport with pickup, destination, stops, schedule, passenger count, and contact details; track requests and rate completed journeys. |
| **Drivers** | View assignments, update availability, start and complete trips using odometer readings, and review journey history and feedback. |

### Scheduling and driver records

- Assignment checks for vehicle type, passenger capacity, driver availability, uploaded licence, licence expiry, and overlapping bookings.
- MongoDB transactions protect concurrent driver allocations.
- Trip status tracking from request through assignment, completion, rejection, or cancellation.
- Private licence documents and profile photos, with file-type validation and a 5 MB upload limit.
- Account deactivation preserves historical records.

### Reporting

- Date-range reports and individual driver summaries.
- Excel workbooks containing **Report details**, **Driver summary**, and **Trip details**.
- Actual distance calculated from start and end odometer readings.
- Monthly report snapshots with catch-up processing while the backend runs.
- Reports based on trip completion dates in the configured reporting timezone, defaulting to `Asia/Colombo`.

## Technology

| Layer | Technologies |
| --- | --- |
| Mobile application | Expo SDK 57, React Native, TypeScript, Expo Router |
| Backend API | Node.js, Express, Zod |
| Database | MongoDB, Mongoose, replica-set transactions |
| Authentication | JWT sessions, bcrypt password hashing, Expo SecureStore on native devices |
| Reporting | ExcelJS, Luxon |
| Deployment | Docker and Railway configuration; EAS profiles for mobile builds |

## Project Structure

```text
HRTransport/
├── apps/
│   ├── api/
│   │   ├── src/            # API, authentication, models, and reporting
│   │   └── test/           # Backend integration tests
│   └── mobile/
│       ├── src/app/        # Screens and navigation
│       ├── src/components/ # Shared interface components
│       ├── src/lib/        # Networking, sessions, and types
│       └── assets/         # Application icons and artwork
├── docs/                   # Architecture and deployment guides
├── scripts/                # Windows setup and development helpers
├── Dockerfile              # Backend container image
├── railway.json            # Railway deployment configuration
└── package.json            # Workspace commands
```

## Getting Started

### Requirements

- Node.js **22.14 or newer** and npm.
- MongoDB Atlas or a MongoDB replica set. A standalone MongoDB server does not support the transactions required by this application.
- Android Studio with a virtual device, or a compatible Expo Go installation on a mobile device.

### 1. Install dependencies

```bash
git clone https://github.com/MilanRanaweera/HRTransport.git
cd HRTransport
npm ci
```

Copy `apps/api/.env.example` to `apps/api/.env` and `apps/mobile/.env.example` to `apps/mobile/.env`.

For Windows installations at `D:\HRTransport`, the optional `scripts/Setup.ps1` helper installs dependencies, creates missing environment files, and generates a signing secret. The Windows helpers use D: for project caches; the standard npm commands can be used from other locations.

### 2. Configure the backend

Set these values in `apps/api/.env`:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB Atlas or replica-set connection string. |
| `JWT_SECRET` | Random signing secret of at least 32 characters. |
| `PORT` | API port; defaults to `4000`. |
| `REPORT_TIMEZONE` | Reporting timezone; defaults to `Asia/Colombo`. |
| `CORS_ORIGINS` | Comma-separated origins permitted for browser clients. |
| `HR_PHONE`, `EMERGENCY_PHONE` | Organisation contact numbers. |
| `SEED_HR_NAME`, `SEED_HR_EMAIL`, `SEED_HR_PASSWORD` | Initial administrator details used by the seed command. |

Generate a signing secret with:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Choose an administrator password of at least 10 characters and replace all example values. Keep backend credentials in private environment files or hosting variables. Only the public API address belongs in the mobile configuration.

For a local development database, run `npm run db` in a separate terminal. This starts a local MongoDB replica set and preserves its data under `data/mongodb`. Skip this command when using Atlas.

### 3. Create the administrator and start the API

```bash
npm run seed
npm run api
```

Seeding creates the initial HR account and does not overwrite an existing account. HR can then create department and driver accounts inside the application.

Check API availability at [localhost:4000/health](http://localhost:4000/health).

### 4. Run the mobile application

Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`:

| Environment | API address |
| --- | --- |
| Android Studio emulator | `http://10.0.2.2:4000/api/v1` |
| Physical device on the same Wi-Fi | `http://<computer-ip-address>:4000/api/v1` |
| Browser preview | `http://localhost:4000/api/v1` |
| Hosted release | `https://<backend-domain>/api/v1` |

Start an Android virtual device, then run:

```bash
npm run android
```

Alternatively, run `npm run mobile` and open the project with a compatible Expo Go client. Use `npm run web` for a browser preview. Restart Expo after changing environment variables.

On Windows, after completing the initial setup at `D:\HRTransport`, `Run Android.cmd` starts the backend and opens the app in an available emulator. Keep the development terminal open while using the app.

## Deployment

The mobile application connects to the backend API; the backend connects to MongoDB Atlas. Internet access from installed mobile apps requires a deployed API with a public HTTPS address.

The repository includes a Dockerfile for the API and Railway configuration with a `/health` readiness check. Supply database credentials and the signing secret through private Railway service variables. Existing Atlas accounts and records remain available when the hosted API uses the same database.

See [Railway deployment instructions](docs/RAILWAY.md) for configuration and rollout steps.

## Android APK

The `preview` profile in `apps/mobile/eas.json` is configured to produce an installable APK.

Before building, connect the project to an Expo account, verify the application identifier, and configure `EXPO_PUBLIC_API_URL` in the EAS preview environment to the deployed HTTPS API address, including `/api/v1`.

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

Download the APK from the completed EAS build. A build using the emulator address will not connect from a physical phone over the internet. The build configuration is included here; this README does not indicate that a hosted service or downloadable release is already available.

## Quality Checks

Run from the repository root:

```bash
npm test
npm run typecheck
npm run lint
```

Backend integration tests use a separate temporary MongoDB replica set. They cover permissions, driver allocation conflicts, licence validation, trip transitions, odometer readings, feedback, report contents, and session invalidation.

Before distributing a release, verify sign-in, licence uploads, trip completion, and Excel export on the intended Android devices. iOS requires its own build and device validation.

## Current Scope

- Journey distances are entered manually or calculated from odometer readings; live GPS tracking and route optimisation are not included.
- Licence expiry is verified by HR; documents are not processed with OCR.
- Each department uses a single account, and each driver has one current vehicle record.
- Data refreshes when screens load or users refresh them. Push notifications, offline changes, and automated report emails are not included.
- Trip lists display the latest 500 records; reports use all matching completed trips.

## Documentation

- [Architecture, access controls, and API reference](docs/ARCHITECTURE.md)
- [Railway deployment and APK builds](docs/RAILWAY.md)
- [Backend environment template](apps/api/.env.example)
- [Mobile environment template](apps/mobile/.env.example)

## Contributions

Open an issue describing the problem or proposed change before substantial development. Keep changes focused, run the relevant quality checks, and include verification steps with pull requests. Use sample data in issues and screenshots; omit credentials and personal documents.
