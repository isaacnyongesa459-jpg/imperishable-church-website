
# Imperishable Crown Bible Baptist Church — M-PESA Backend

This Node.js backend starts M-PESA STK Push payments through Safaricom Daraja and records donation results in PostgreSQL.

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
- `GET /api/donations/total` — returns the total of completed M-PESA, Paystack, and PayPal donations, with PayPal converted to the recorded KES equivalent.
- `POST /api/donations/paystack/initialize` — starts hosted Paystack checkout.
- `POST /api/donations/paystack/verify` — verifies a transaction with Paystack before recording it.
- `POST /api/paystack/webhook` — validates Paystack webhook signatures and reconciles successful payments.
- `GET /api/donations/paypal/config` — returns the public PayPal client ID, environment, and cached USD/KES rate.
- `POST /api/donations/paypal/create-order` — creates a PayPal USD order and records the USD amount, KES equivalent, and rate used.
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

- `PAYSTACK_SECRET_KEY` (required to enable Paystack)
- `PAYSTACK_CALLBACK_URL` (optional; defaults to the GitHub Pages donation return page)
- `PAYPAL_ENV` (`sandbox` for testing; set to `live` only when ready to accept real payments)
- `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` (PayPal app credentials; keep both in Render only)
- `PAYPAL_FX_URL` (optional exchange-rate endpoint; defaults to the USD/KES endpoint in `.env.example`)
- `MPESA_ACCOUNT_REFERENCE`

Configure actual values privately in Render Environment settings. Set the Paystack webhook URL to `https://<backend-host>/api/paystack/webhook`. Never commit credentials, database URLs, or `.env` files to GitHub.

## Deployment

The backend is intended to run as a Render Web Service using:

- Root directory: `mpesa-backend`
- Build command: `npm install`
- Start command: `npm start`

Use the Safaricom Daraja sandbox and PayPal Sandbox before considering production payments. PayPal donations are charged in USD. The page displays an approximate KES equivalent, and the backend stores that equivalent and the exchange rate captured when the PayPal order is created. PayPal does not collect KES in this flow; the KES figure is for donor clarity and church reporting.

## Important

The frontend must send API requests to the deployed backend's public HTTPS URL. A GitHub Pages website cannot run this Node.js backend itself.

Before accepting real donations, configure PayPal Sandbox credentials and test successful payment, cancellation, failure, database recording, amount/currency verification, and the USD/KES display. Then add the PayPal Live client ID and secret to Render, change `PAYPAL_ENV` to `live`, redeploy, and verify a small real transaction. The secret is used only by the server; donations count only after the backend verifies the PayPal capture status, amount, and currency.


## Administrator dashboard

Admin sign-in and management views are delivered by the backend at `/admin/login` and `/admin/<section>` (dashboard, members, attendance, expenses, reports, ministries, announcements, events, donations, messages, and gallery). Section pages require the signed administrator session cookie; all `/api/admin/*` data operations remain protected by the same server-side middleware. Public pages link directly to the backend sign-in page. Set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and a unique random `ADMIN_SESSION_SECRET` (at least 32 characters) in Render's environment settings; never commit credential values.

GitHub Pages cannot enforce authorization for static files. Therefore admin views are not served from the public Pages site; the Express backend is the protected page origin. The public repository itself remains inspectable, so protection applies to the deployed admin routes and data/API operations, not to source code visibility.
