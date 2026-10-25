
const express = require("express");
const { Pool } = require("pg");

const app = express();

app.use(express.json({ limit: "100kb" }));

// ========================================
// CONFIGURATION
// ========================================

const PORT = process.env.PORT || 3000;

const FRONTEND_ORIGIN =
  "https://isaacnyongesa459-jpg.github.io";

const {
  MPESA_ENV = "sandbox",
  MPESA_SHORTCODE,
  MPESA_TRANSACTION_TYPE = "CustomerPayBillOnline",
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_PASSKEY,
  MPESA_ACCOUNT_REFERENCE = "ChurchDon",
  MPESA_CALLBACK_BASE_URL,
  DATABASE_URL
} = process.env;

// Required environment variables.
// The callback URL is checked separately before making a payment.
const requiredEnv = [
  "MPESA_SHORTCODE",
  "MPESA_CONSUMER_KEY",
  "MPESA_CONSUMER_SECRET",
  "MPESA_PASSKEY",
  "DATABASE_URL"
];

const missingEnv = requiredEnv.filter(
  (key) => !process.env[key]
);

if (missingEnv.length > 0) {
  console.error(
    "Missing required environment variables:",
    missingEnv.join(", ")
  );
  process.exit(1);
}

if (!["sandbox", "live"].includes(MPESA_ENV)) {
  throw new Error("MPESA_ENV must be sandbox or live.");
}

const mpesaBaseUrl =
  MPESA_ENV === "live"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

// ========================================
// DATABASE
// ========================================

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.on("error", (error) => {
  console.error("Unexpected database error:", error.message);
});

// ========================================
// CORS
// ========================================

app.use((req, res, next) => {
  res.setHeader(
    "Access-Control-Allow-Origin",
    FRONTEND_ORIGIN
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// ========================================
// DATABASE INITIALIZATION
// ========================================

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS donations (
      id BIGSERIAL PRIMARY KEY,
      checkout_request_id TEXT UNIQUE NOT NULL,
      merchant_request_id TEXT,
      phone TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      mpesa_receipt_number TEXT,
      result_desc TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

// ========================================
// HELPER FUNCTIONS
// ========================================

function normalizePhone(value) {
  let phone = String(value || "").replace(/\D/g, "");

  if (phone.startsWith("0")) {
    phone = "254" + phone.slice(1);
  } else if (
    phone.startsWith("7") ||
    phone.startsWith("1")
  ) {
    phone = "254" + phone;
  }

  if (!/^254[17]\d{8}$/.test(phone)) {
    throw new Error(
      "Enter a valid Kenyan mobile number, such as 0712345678."
    );
  }

  return phone;
}

function getTimestamp() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return (
    values.year +
    values.month +
    values.day +
    values.hour +
    values.minute +
    values.second
  );
}

function getCallbackUrl() {
  if (!MPESA_CALLBACK_BASE_URL) {
    throw new Error(
      "M-PESA callback URL is not configured. Please contact the website administrator."
    );
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(MPESA_CALLBACK_BASE_URL);
  } catch {
    throw new Error(
      "The configured M-PESA callback URL is invalid."
    );
  }

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.pathname !== "/" ||
    parsedUrl.search ||
    parsedUrl.hash ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error(
      "The callback base URL must be an HTTPS base URL without a path."
    );
  }

  return `${parsedUrl.origin}/api/mpesa/callback`;
}

async function getAccessToken() {
  const credentials = Buffer.from(
    `${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`
  ).toString("base64");

  const response = await fetch(
    `${mpesaBaseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: {
        Authorization: `Basic ${credentials}`
      }
    }
  );

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    console.error(
      "M-PESA OAuth authentication failed:",
      data.errorCode || "Unknown error"
    );

    throw new Error(
      "Could not authenticate with Safaricom. Check your sandbox API credentials."
    );
  }

  return data.access_token;
}

// ========================================
// HOME AND HEALTH ROUTES
// ========================================

app.get("/", (req, res) => {
  res.json({
    message:
      "Imperishable Crown Church M-PESA backend is running."
  });
});

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      status: "ok",
      database: "connected"
    });
  } catch (error) {
    console.error("Database health check failed:", error.message);

    res.status(503).json({
      status: "error",
      message: "Database connection failed."
    });
  }
});

// ========================================
// INITIATE M-PESA STK PUSH
// ========================================

app.post("/api/donations/mpesa", async (req, res) => {
  try {
    // Check callback configuration before contacting Safaricom.
    const callbackUrl = getCallbackUrl();

    const phone = normalizePhone(req.body?.phone);
    const amount = Number(req.body?.amount);

    if (
      !Number.isSafeInteger(amount) ||
      amount < 1 ||
      amount > 250000
    ) {
      return res.status(400).json({
        error:
          "Enter a whole-number donation amount between KSh 1 and KSh 250,000."
      });
    }

    const timestamp = getTimestamp();

    const password = Buffer.from(
      `${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`
    ).toString("base64");

    const accessToken = await getAccessToken();

    const stkResponse = await fetch(
      `${mpesaBaseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          BusinessShortCode: MPESA_SHORTCODE,
          Password: password,
          Timestamp: timestamp,
          TransactionType: MPESA_TRANSACTION_TYPE,
          Amount: amount,
          PartyA: phone,
          PartyB: MPESA_SHORTCODE,
          PhoneNumber: phone,
          CallBackURL: callbackUrl,
          AccountReference: MPESA_ACCOUNT_REFERENCE,
          TransactionDesc: "Church donation"
        })
      }
    );

    const result = await stkResponse.json();

    if (
      !stkResponse.ok ||
      result.ResponseCode !== "0" ||
      !result.CheckoutRequestID
    ) {
      console.error(
        "M-PESA STK request failed:",
        result.errorCode || result.ResponseCode || "Unknown error",
        result.errorMessage || ""
      );

      return res.status(502).json({
        error:
          result.CustomerMessage ||
          result.errorMessage ||
          "Safaricom could not start the payment. Check your sandbox settings and try again."
      });
    }

    await pool.query(
      `INSERT INTO donations
        (
          checkout_request_id,
          merchant_request_id,
          phone,
          amount,
          status
        )
       VALUES ($1, $2, $3, $4, 'pending')
       ON CONFLICT (checkout_request_id) DO NOTHING`,
      [
        result.CheckoutRequestID,
        result.MerchantRequestID || null,
        phone,
        amount
      ]
    );

    return res.json({
      success: true,
      message:
        result.CustomerMessage ||
        "Payment request initiated. Follow the instructions from Safaricom if a payment prompt is available.",
      checkoutRequestId: result.CheckoutRequestID
    });
  } catch (error) {
    console.error(
      "Donation request error:",
      error.message
    );

    return res.status(400).json({
      error: error.message || "Could not start the donation."
    });
  }
});

// ========================================
// SAFARICOM PAYMENT CALLBACK
// ========================================

app.post("/api/mpesa/callback", async (req, res) => {
  const callback = req.body?.Body?.stkCallback;

  // Reject malformed callback requests.
  if (!callback?.CheckoutRequestID) {
    return res.status(400).json({
      ResultCode: 1,
      ResultDesc: "Invalid callback data."
    });
  }

  try {
    const success = Number(callback.ResultCode) === 0;

    const items = callback.CallbackMetadata?.Item || [];

    const metadata = Object.fromEntries(
      items.map((item) => [item.Name, item.Value])
    );

    const update = await pool.query(
      `UPDATE donations
       SET status = $1,
           mpesa_receipt_number =
             COALESCE($2, mpesa_receipt_number),
           result_desc = $3,
           updated_at = NOW()
       WHERE checkout_request_id = $4`,
      [
        success ? "completed" : "failed",
        metadata.MpesaReceiptNumber
          ? String(metadata.MpesaReceiptNumber)
          : null,
        callback.ResultDesc || null,
        callback.CheckoutRequestID
      ]
    );

    if (update.rowCount === 0) {
      console.error(
        "Callback received for an unknown checkout request."
      );
    }

    return res.json({
      ResultCode: 0,
      ResultDesc: "Accepted"
    });
  } catch (error) {
    console.error(
      "M-PESA callback processing failed:",
      error.message
    );

    return res.status(500).json({
      ResultCode: 1,
      ResultDesc: "Callback processing failed."
    });
  }
});

// ========================================
// CHECK DONATION STATUS
// ========================================

app.get(
  "/api/donations/status/:checkoutRequestId",
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT status, amount, mpesa_receipt_number, result_desc
         FROM donations
         WHERE checkout_request_id = $1`,
        [req.params.checkoutRequestId]
      );

      if (!result.rowCount) {
        return res.status(404).json({
          error: "Donation record not found."
        });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      console.error(
        "Donation status lookup failed:",
        error.message
      );

      return res.status(500).json({
        error: "Could not check payment status."
      });
    }
  }
);

// ========================================
// TOTAL COMPLETED DONATIONS
// ========================================

app.get("/api/donations/total", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM donations
       WHERE status = 'completed'`
    );

    return res.json({
      total: Number(result.rows[0].total)
    });
  } catch (error) {
    console.error(
      "Donation total lookup failed:",
      error.message
    );

    return res.status(500).json({
      error: "Could not load donation total."
    });
  }
});

// ========================================
// START SERVER
// ========================================

async function startServer() {
  await initializeDatabase();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `Church donation backend listening on port ${PORT}`
    );

    console.log(`M-PESA environment: ${MPESA_ENV}`);
    console.log(
      `M-PESA callback configured: ${Boolean(MPESA_CALLBACK_BASE_URL)}`
    );
  });
}

startServer().catch((error) => {
  console.error(
    "Could not start backend:",
    error.message
  );

  process.exit(1);
});
