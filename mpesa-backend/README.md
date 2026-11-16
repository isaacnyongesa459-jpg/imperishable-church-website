
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
- `GET /api/donations/total` — returns the total of completed M-PESA and Paystack donations.
- `POST /api/donations/paystack/initialize` — starts hosted Paystack checkout.
- `POST /api/donations/paystack/verify` — verifies a transaction with Paystack before recording it.
- `POST /api/paystack/webhook` — validates Paystack webhook signatures and reconciles successful payments.

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
- `MPESA_ACCOUNT_REFERENCE`

Configure actual values privately in Render Environment settings. Set the Paystack webhook URL to `https://<backend-host>/api/paystack/webhook`. Never commit credentials, database URLs, or `.env` files to GitHub.

## Deployment

The backend is intended to run as a Render Web Service using:

- Root directory: `mpesa-backend`
- Build command: `npm install`
- Start command: `npm start`

Use the Safaricom Daraja sandbox for testing before considering production payments.

## Important

The frontend must send API requests to the deployed backend's public HTTPS URL. A GitHub Pages website cannot run this Node.js backend itself.

Before accepting real donations, set a valid Paystack secret key and webhook URL, then test payment success, cancellation, failure, callback handling, database recording, and security protections. The secret is used only by the server; donations count only after the backend verifies their status, amount, and currency with Paystack.
