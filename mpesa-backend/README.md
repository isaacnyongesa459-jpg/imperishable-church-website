
# Imperishable Crown Bible Baptist Church — M-PESA Backend

This Node.js backend starts M-PESA STK Push payments through Safaricom Daraja, converts KES/USD/INR donations with Frankfurter reference rates, runs PayPal Live USD checkout, and records verified donation results in PostgreSQL.

## Files

- `package.json` — project dependencies and start command.
- `server.js` — Express API, Daraja integration, callback handling, and donation records.
- `admin-view-filter.js` — removes unauthorized sections from the shared legacy dashboard before sending role-scoped pages.
- `cms-content.js` — public localized reads and permission-protected content listing/upserts, with input validation and audit events.
- `migrations/` — ordered additive PostgreSQL migrations, applied transactionally before the server begins accepting requests.
- `admin-security.js` and `migrate.js` — password hashing, role definitions, migration execution, and initial owner-account bootstrap.
- `admin-content.html` — protected website-content editor for localized page sections, drafts, publication state, and ordering.
- `admin-users.html` — user-management screen, served only through its authenticated backend route.
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
- `GET /api/admin/users`, `POST /api/admin/users`, `PATCH /api/admin/users/:id` — Super Administrator-only account management; responses never include password hashes.
- `GET /api/content/:page?lang=en` — returns only published content sections for the selected supported locale, with English fallback per section.
- `GET /api/admin/content?page=home`, `PUT /api/admin/content` — `content:manage`-protected CMS listing and transactional section upsert with an audit record.

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

Admin sign-in and management views are delivered by the backend at `/admin/login`, `/admin/users`, `/admin/content`, and `/admin/<section>` (dashboard, members, attendance, expenses, reports, ministries, announcements, events, donations, messages, and gallery). Section pages require the signed administrator session cookie; all `/api/admin/*` data operations remain protected by server-side authorization. Public pages link directly to the backend sign-in page. Set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and a unique random `ADMIN_SESSION_SECRET` (at least 32 characters) in Render's environment settings; never commit credential values.

On startup, the backend applies unapplied files in `migrations/` under a PostgreSQL advisory lock and transaction, then creates the configured owner account only if it does not already exist. The owner password is stored as a salted scrypt hash; changing `ADMIN_PASSWORD` in Render does not overwrite an existing database password. The new `/admin/users` screen and `/api/admin/users` endpoints let the Super Administrator add accounts for Super Administrator, Pastor, Treasurer, Media Administrator, or Prayer Team Member roles, and update role/active status. Role/status changes increment the account's session version to revoke existing sessions; at least one active Super Administrator is required and the bootstrap owner cannot be demoted/deactivated.

Current least-privilege access for existing modules is limited to implemented features: Pastors can manage website content, ministries, announcements, and events; Treasurers can manage expenses and view donation history and financial reports; Media Administrators can manage the gallery. Dashboard summaries, members, attendance, contact messages, user administration, and unmapped admin APIs remain Super-Administrator-only. Admin navigation and each served non-dashboard page are filtered server-side; every mapped data API independently checks its permission. The new editor reuses `church_content`, keeps draft rows private, supports the ten existing locale codes with per-section English fallback, and audits saves without logging copy. Its images are HTTPS URL references with required alternative text; binary uploads are not implemented. The public page binding currently updates Home (`hero`, `story`) and About (`main`, `history`) only; editing other page keys does not imply those pages are dynamically rendered yet. Sermon/livestream and private prayer-request workflows are not yet implemented, so role creation does not grant those unfinished capabilities. Run `npm test` for unit validation, security, migration-discovery, and view-filter tests; they require installed backend dependencies but do not connect to a live payment provider or production database.

GitHub Pages cannot enforce authorization for static files. Therefore admin views are not served from the public Pages site; the Express backend is the protected page origin. The public repository itself remains inspectable, so protection applies to the deployed admin routes and data/API operations, not to source code visibility.
