
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


## Multi-page church administration

The protected Express admin has independent page documents at `/admin/admin-dashboard.html`, `/admin/admin-donations.html`, `/admin/admin-finances.html`, `/admin/admin-events.html`, `/admin/admin-announcements.html`, `/admin/admin-sermons.html`, `/admin/admin-services.html`, `/admin/admin-leadership.html`, `/admin/admin-ministries.html`, `/admin/admin-sponsorships.html`, `/admin/admin-members.html`, `/admin/admin-attendance.html`, `/admin/admin-messages.html`, `/admin/admin-gallery.html`, `/admin/admin-users.html`, and `/admin/admin-settings.html`. Older section URLs remain supported. Every page requires a valid active database-backed administrator session; API permissions are enforced on the server.

Roles are Owner, Administrator, Finance Manager, Content Manager, and Pastoral Care. Only Owners manage administrator accounts. Set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and an unpredictable `ADMIN_SESSION_SECRET` of at least 32 characters privately in the backend environment. The configured account is created as Owner only if it does not already exist; subsequent role changes are not overwritten at restart. Passwords use scrypt hashes, role changes/deactivation invalidate sessions, and passwords are not returned by any API. Keep Cloudinary credentials (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) private for sermon resource and gallery uploads.

Startup adds `admin_users`, `church_sermons`, message-triage status, and Cloudinary gallery-reference columns idempotently in the existing PostgreSQL database. The admin pages use real database/API records, not demo data. Gallery retains support for existing HTTPS image URLs; new uploads are content-signature checked and limited to 5 MB. Sermon resources use authenticated Cloudinary storage and an authenticated backend download route. Message triage status is `new`, `in_progress`, `resolved`, or `archived`.

The repository-root `_config.yml` excludes `mpesa-backend/admin-pages` and `mpesa-backend/admin-assets` from GitHub Pages output. The backend serves these assets on its authenticated origin; the static site must not serve administrative documents or private records. PostgreSQL migration and production behavior must be validated only in the deployed environment, not by writing to production during sandbox checks.


## Holy Bible API proxy
The public static site calls the backend's `/api/bible/*` routes for translation metadata, books, chapters, passages, reference lookup, and keyword search. The backend obtains Bible text from external providers and uses a bounded in-memory cache only; it does not create scripture tables, save Bible content to PostgreSQL, or use the database for reader content. Configure `API_BIBLE_KEY` privately in the existing Render Web Service environment to enable API.Bible translations (including Kiswahili where the API account exposes an appropriately licensed edition) and keyword search. The key is sent only in server-side request headers. The public-domain KJV reader/reference lookup has a bible-api.com fallback and supports saving only explicitly opened KJV chapters in the browser's IndexedDB for offline use; the local copy expires after 30 days. No whole-Bible download is performed. API.Bible translations are not offered for offline saving by default; verify the translation's rights and terms before any future offline enablement. API.Bible web usage is reported with its required FUMS JavaScript tracker. The browser stores personal reading notes/bookmarks/highlights/preferences locally; no reader data is written to PostgreSQL.

Audio is requested only for Audio Bible editions surfaced by the active API.Bible translation catalog. Audio Bible access requires additional provider licensing; if no licensed audio edition is exposed, no audio button is shown. Chapter audio is streamed by the backend using a short-lived opaque token so the API key and signed provider URL remain server-side, and FUMS listen events are reported on playback.

Provider references: [API.Bible authentication](https://docs.api.bible/quick-start/authentication), [licensing and access](https://docs.api.bible/quick-start/licensing-and-access), [Fair Use Management System](https://docs.api.bible/guides/fair-use), and [audio Bibles](https://docs.api.bible/guides/audio-bibles). The fallback provider is [bible-api.com](https://bible-api.com/). Confirm current account entitlements and individual translation terms before enabling editions or audio in production.
