# Architecture and API

## Modules

`apps/mobile/src/app` contains Expo Router screens. `components` contains shared UI and account forms. `lib` contains authenticated networking, file operations, sessions and TypeScript models.

`apps/api/src/app.js` defines the Express API and request authorization; `domain.js` defines validation and report date rules; `models.js` defines MongoDB collections; `reports.js` creates snapshots and Excel workbooks. `server.js` connects the database and runs report catch-up. `seed.js` creates the initial HR account.

## Data and identity

Users have `hr`, `department`, or `driver` roles. Passwords are bcrypt hashes; 12-hour JWTs contain a token version checked against the account on every request. Logout, HR password reset and password changes invalidate existing sessions. Inactive accounts cannot log in. There is no public signup or client-selected HR role.

Native tokens use SecureStore; the optional web preview uses sessionStorage. Never save backend credentials in the mobile app. Production requests must use HTTPS. The API validates IDs and request bodies, scopes trip access to the logged-in department/driver and restricts reports/account management to HR.

Assets are private MongoDB binary documents, limited to 5 MB with file-signature validation. Only HR and the asset's owner can read them. Drivers can update their own photos; HR manages licences. Replacing an asset swaps the reference and deletes the old asset in a transaction.

## Booking state machine

```text
requested -> assigned -> in_progress -> completed
    |           |
    +->rejected +->cancelled
    +->cancelled
```

Only HR assigns/rejects. HR or the owning department can cancel requested/assigned trips. Only the assigned driver can start/complete. Only the owning department can submit one rating after completion. State filters on database updates prevent repeated completion or feedback.

Driver record writes inside assignment/start transactions serialize competing allocations; retrying a transaction rechecks all constraints. Overlap uses half-open intervals `[startAt, endAt)` so adjacent bookings are permitted. Licence expiry is inclusive in the organisation timezone through the planned end date. Starting also checks the current date and blocks a driver's second in-progress trip.

## Endpoints

All paths below are relative to `/api/v1`. Except login, all need `Authorization: Bearer <token>`.

| Method | Path | Access / purpose |
| --- | --- | --- |
| POST | `/auth/login` | Email/password; rate limited |
| POST | `/auth/logout` | Revoke current account's sessions |
| POST | `/auth/password` | Current/new password |
| GET/PATCH | `/me` | Own profile / availability |
| GET | `/contacts` | HR and emergency phone numbers |
| GET/POST | `/users` | HR lists/creates drivers/departments |
| PATCH | `/users/:id` | HR changes account, password, vehicle, licence metadata |
| POST | `/users/:id/assets/:kind` | Multipart `file`, `kind=photo` or `license` |
| GET | `/assets/:id` | Private file; `?metadata=true` returns MIME/name |
| GET/POST | `/trips` | Scoped list / department request |
| GET | `/trips/:id` | Scoped trip details |
| GET | `/trips/:id/candidates` | HR suitable drivers |
| POST | `/trips/:id/assign` | HR `{driverId}` |
| POST | `/trips/:id/decision` | HR/department `{action,reason}` |
| POST | `/trips/:id/start` | Driver `{odometer}` |
| POST | `/trips/:id/complete` | Driver `{odometer,notes}` |
| POST | `/trips/:id/feedback` | Department `{rating,comment}` |
| GET | `/drivers/:id/summary?from=YYYY-MM-DD&to=YYYY-MM-DD` | HR or own driver summary |
| GET | `/reports/custom?from=...&to=...&driverId=...&format=xlsx` | HR; driverId and format optional; default JSON |
| GET | `/reports/monthly` | HR archive summary |
| GET | `/reports/monthly/YYYY-MM` | HR archived Excel download |

## Deployment

Run the API on a server with Node 22.14+, a MongoDB replica set and persistent secrets. The development MongoDB helper is not a production database service. Use a reverse proxy/TLS, process supervision and backups for the complete database including Asset and Report collections. Configure CORS for any deployed web client. Native clients do not rely on browser CORS for authorization.

For higher traffic, add shared login rate-limit storage, structured audit records, request tracing, report jobs stored outside BSON documents, malware scanning for document uploads, and pagination. The current report job is idempotent per month; a unique month index prevents duplicate archives across API instances. A transient duplicate-upsert error can be retried on the next hourly run.
