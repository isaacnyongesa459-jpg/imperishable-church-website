
# Imperishable Crown Bible Baptist Church — M-PESA Backend

This Node.js backend starts M-PESA STK Push payments through Safaricom Daraja, converts KES/USD/INR donations with Frankfurter reference rates, runs PayPal Live USD checkout, and records verified donation results in PostgreSQL.

## Files

- `package.json` — project dependencies and start command.
- `server.js` — Express API, Daraja integration, callback handling, and donation records.
- `.env.example` — example of the required environment variable names.
- `.gitignore` — excludes private environment files and dependencies from Git.

## API endpoints

- `GET /api/health` — checks backend and database availability.
- `POST /api/donations/mpesa` — initiates an M-PESA STK Push.
- `POST /api/mpesa/callback` — receives Safaricom payment callbacks.
- `GET /api/donations/status/:checkoutRequestId` — checks a payment status.
- `GET /api/donations/total` — returns completed M-PESA and PayPal donations in the reporting total, with PayPal converted to the recorded KES equivalent.
- `GET /api/currency/rates` — returns cached Frankfurter indicative rates for KES, USD, and INR in all six directions.
- `GET /api/donations/paypal/config` — returns the public PayPal client ID, environment, and current currency-rate set.
- `POST /api/donations/paypal/create-order` — validates the original KES/USD/INR amount, converts it server-side to USD, and creates a PayPal order.
- `POST /api/donations/paypal/capture-order` — captures and verifies the approved PayPal order before marking it completed.

## Required environment variables

- `MPESA_ENV`
- `MPESA_SHORTCODE`
- `MPESA_TRANSACTION_TYPE`
- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_PASSKEY`
- `MPESA_CALLBACK_BASE_URL`
- `DATABASE_URL`

Optional:

- `PAYPAL_ENV` (`sandbox` for testing; `live` for production)
- `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` (PayPal app credentials; keep both in Render only)
- `MPESA_ACCOUNT_REFERENCE`

Configure actual values privately in Render Environment settings. Frankfurter is used as the public reference-rate source; no Frankfurter secret is required. Never commit credentials, database URLs, or `.env` files to GitHub.

## Deployment

The backend is intended to run as a Render Web Service using:

- Root directory: `mpesa-backend`
- Build command: `npm install`
- Start command: `npm start`

M-PESA accepts KES only. PayPal Live settles in USD; donors may select KES, USD, or INR and the backend converts the selected amount using the cached Frankfurter rate immediately before creating the PayPal order. The selected amount, original currency, USD payment amount, KES reporting amount, provider, transaction reference, exchange-rate date, and verified status are stored. All displayed conversions are clearly labeled indicative reference rates.

## Important

The frontend must send API requests to the deployed backend's public HTTPS URL. A GitHub Pages website cannot run this Node.js backend itself.

Historical `paystack_donations` rows are retained so existing records are not deleted, but Paystack routes, frontend controls, webhooks, environment variables, and active totals have been removed. The secret is used only by the server; donations count only after the backend verifies the PayPal capture status, amount, and currency or receives a verified Daraja callback.


## Administrator dashboard

Admin sign-in and management views are delivered by the backend at `/admin/login` and `/admin/<section>` (dashboard, members, attendance, expenses, reports, ministries, announcements, events, donations, messages, and gallery). Section pages require the signed administrator session cookie; all `/api/admin/*` data operations remain protected by the same server-side middleware. Public pages link directly to the backend sign-in page. Set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and a unique random `ADMIN_SESSION_SECRET` (at least 32 characters) in Render's environment settings; never commit credential values.

GitHub Pages cannot enforce authorization for static files. Therefore admin views are not served from the public Pages site; the Express backend is the protected page origin. The public repository itself remains inspectable, so protection applies to the deployed admin routes and data/API operations, not to source code visibility.


## Children Sponsorship Programme

The public website page is `children-sponsorship.html`; the backend public directory is `GET /api/sponsorships`. It returns only active, published sponsor profiles and child profiles with explicit profile consent. A public portrait is served through `GET /api/sponsorships/media/:type/:id` only if the profile is approved and photo consent is recorded. The response omits addresses, school locations, phone numbers, exact birth dates, guardian details and internal notes. Profiles without permission are not included; an empty directory does not imply that no children need support.

The authenticated backend dashboard section is `/admin/children-sponsors`. The management API is protected by the existing signed administrator session and origin check:

- `GET /api/admin/children-sponsors/overview` — private sponsor/child records, assignment history and statistics.
- `POST`, `PUT /:id`, `DELETE /:id` under `/api/admin/sponsors` — create, update and deactivate sponsor records. Deactivation retains history.
- `POST`, `PUT /:id`, `DELETE /:id` under `/api/admin/children` — register, update and archive children. Archiving ends active assignments without deleting history.
- `POST /api/admin/sponsorships` — assign or reassign an active child; one active sponsor per child, one sponsor may support multiple children.
- `DELETE /api/admin/sponsorships/:id` — end an active assignment while keeping its historical record.
- `POST /api/admin/sponsorship-photos/:type/:id` — upload/replace a JPG, PNG or WebP portrait (max 5 MB).
- `GET /api/admin/sponsorship-media/:type/:id` — authenticated delivery of a private portrait.

Startup creates `sponsors`, `sponsored_children`, `sponsorships` and `sponsorship_audit_log` in the existing PostgreSQL database and idempotently adds 30 inactive sponsor placeholders labelled Sponsor 01–30. They are marked as placeholders and excluded from public directories and sponsor totals until an administrator edits them into actual records. Child records start empty; no invented child identities or photographs are used. A partial unique index ensures no child has more than one active sponsor.

Photo upload requires the following values set privately in the deployed backend environment: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. Uploads use authenticated Cloudinary image delivery; the application proxies bytes only after an administrator session check or a public consent/publishing check. Until these settings are configured, the management interface and records work, while photo upload returns a clear configuration-required response. Never put Cloudinary credentials in static site code or commit real values.

The child profile form intentionally uses an approved display name and optional age rather than date of birth. Administrators must obtain appropriate guardian/sponsor consent and complete church safeguarding review before checking publication/photo-consent settings. GitHub Pages serves only the public directory UI; private child records and the management interface remain on the authenticated backend origin.
