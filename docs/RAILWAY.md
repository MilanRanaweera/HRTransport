# Railway backend and Android APK

Deploy from the repository root using the supplied Dockerfile and railway.json.
The image includes only API source and production dependencies. It does not contain local environment files or MongoDB credentials.

## Railway setup

1. Sign in to Railway and create a project with a service for this repository (or deploy this folder with Railway CLI).
2. Keep the service root at the repository root; do not set it to apps/api.
3. Add private service variables:
   - MONGODB_URI: the Atlas URI from apps/api/.env.
   - JWT_SECRET: the signing secret from apps/api/.env, or a new random secret of at least 32 characters.
   - REPORT_TIMEZONE: Asia/Colombo.
   - HR_PHONE and EMERGENCY_PHONE: your organisation's contact numbers.
4. Allow the deployed service's outbound connection in Atlas Network Access.
5. Deploy and generate a public Railway HTTPS domain. Confirm /health returns HTTP 200.

Railway supplies PORT. The container starts Node directly and does not require an uploaded .env file. The existing HR account and other Atlas records remain available; do not seed a second administrator.

## Build the APK

Sign in to Expo on this computer, link the mobile project to that account, and set the preview environment's EXPO_PUBLIC_API_URL to the Railway HTTPS domain followed by /api/v1. Do not include database credentials in an Expo environment.

From apps/mobile run:

```powershell
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

The existing preview profile produces an installable APK. Download it after the build completes, install it on Android, and verify login, licence upload and Excel export against the hosted backend.

Until Railway is deployed and its HTTPS address is configured, a build using 10.0.2.2 is only suitable for the emulator and cannot be the internet-ready release.
