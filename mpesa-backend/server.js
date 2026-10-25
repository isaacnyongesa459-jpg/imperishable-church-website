
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
// DATABASE CONNECTION
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
// All table creation belongs inside this function.
// ========================================

async function initializeDatabase() {
  // M-Pesa donations
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

  // About page and other church information
  await pool.query(`
    CREATE TABLE IF NOT EXISTS church_content (
      content_key VARCHAR(100) PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Announcements
  await pool.query(`
    CREATE TABLE IF NOT EXISTS announcements (
      id BIGSERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      body TEXT NOT NULL,
      published BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Church leadership
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leaders (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      title VARCHAR(150) NOT NULL,
      biography TEXT NOT NULL DEFAULT '',
      photo_url TEXT NOT NULL DEFAULT '',
      display_order INTEGER NOT NULL DEFAULT 0,
      published BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Regular church services
  await pool.query(`
    CREATE TABLE IF NOT EXISTS services (
      id BIGSERIAL PRIMARY KEY,
      title VARCHAR(150) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      day_of_week VARCHAR(20) NOT NULL,
      start_time VARCHAR(20) NOT NULL,
      location VARCHAR(200) NOT NULL DEFAULT '',
      published BOOLEAN NOT NULL DEFAULT FALSE,
      display_order INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Church events
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id BIGSERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      event_date TIMESTAMPTZ NOT NULL,
      location VARCHAR(200) NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      published BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Contact messages and prayer requests
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(254) NOT NULL,
      subject VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  console.log("All church website database tables are ready.");
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
      "M-PESA callback URL is not configured."
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
      "Could not authenticate with Safaricom. Check your API credentials."
    );
  }

  return data.access_token;
}

// ========================================
// HOME AND HEALTH
// ========================================

app.get("/", (req, res) => {
  res.json({
    message:
      "Imperishable Crown Church backend is running."
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
    console.error("Health check failed:", error.message);

    res.status(503).json({
      status: "error",
      message: "Database connection failed."
    });
  }
});

// ========================================
// M-PESA STK PUSH
// ========================================

app.post("/api/donations/mpesa", async (req, res) => {
  try {
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
          "Safaricom could not start the payment. Check your settings and try again."
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
        "Payment request initiated. Follow the Safaricom instructions.",
      checkoutRequestId: result.CheckoutRequestID
    });
  } catch (error) {
    console.error("Donation request error:", error.message);

    return res.status(400).json({
      error: error.message || "Could not start the donation."
    });
  }
});

// ========================================
// M-PESA CALLBACK
// ========================================

app.post("/api/mpesa/callback", async (req, res) => {
  const callback = req.body?.Body?.stkCallback;

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
// DONATION STATUS
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

      if (result.rowCount === 0) {
        return res.status(404).json({
          error: "Donation record not found."
        });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      console.error("Donation status error:", error.message);

      return res.status(500).json({
        error: "Could not check payment status."
      });
    }
  }
);

// ========================================
// COMPLETED DONATION TOTAL
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
    console.error("Donation total error:", error.message);

    return res.status(500).json({
      error: "Could not load donation total."
    });
  }
});

// ========================================
// ABOUT PAGE
// ========================================

app.get("/api/about", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT title, body
       FROM church_content
       WHERE content_key = 'about'`
    );

    if (result.rowCount === 0) {
      return res.json({
        title: "About Our Church",
        body: ""
      });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("About API error:", error.message);

    return res.status(500).json({
      error: "Unable to load church information."
    });
  }
});

// ========================================
// ANNOUNCEMENTS
// ========================================

app.get("/api/announcements", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, body, created_at
       FROM announcements
       WHERE published = TRUE
       ORDER BY created_at DESC
       LIMIT 20`
    );

    return res.json({
      announcements: result.rows
    });
  } catch (error) {
    console.error("Announcements API error:", error.message);

    return res.status(500).json({
      error: "Unable to load announcements."
    });
  }
});

// ========================================
// CHURCH LEADERS
// ========================================

app.get("/api/leaders", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, title, biography, photo_url
       FROM leaders
       WHERE published = TRUE
       ORDER BY display_order ASC, id ASC`
    );

    return res.json({
      leaders: result.rows
    });
  } catch (error) {
    console.error("Leaders API error:", error.message);

    return res.status(500).json({
      error: "Unable to load church leadership."
    });
  }
});

// ========================================
// CHURCH SERVICES
// ========================================

app.get("/api/services", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, description, day_of_week,
              start_time, location
       FROM services
       WHERE published = TRUE
       ORDER BY display_order ASC, id ASC`
    );

    return res.json({
      services: result.rows
    });
  } catch (error) {
    console.error("Services API error:", error.message);

    return res.status(500).json({
      error: "Unable to load service schedules."
    });
  }
});

// ========================================
// UPCOMING EVENTS
// ========================================

app.get("/api/events", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, description, event_date,
              location, image_url
       FROM events
       WHERE published = TRUE
         AND event_date >= NOW()
       ORDER BY event_date ASC
       LIMIT 50`
    );

    return res.json({
      events: result.rows
    });
  } catch (error) {
    console.error("Events API error:", error.message);

    return res.status(500).json({
      error: "Unable to load church events."
    });
  }
});

// ========================================
// HOME PAGE CONTENT
// ========================================

app.get("/api/home", async (req, res) => {
  try {
    const [announcements, events, services] =
      await Promise.all([
        pool.query(
          `SELECT id, title, body, created_at
           FROM announcements
           WHERE published = TRUE
           ORDER BY created_at DESC
           LIMIT 3`
        ),
        pool.query(
          `SELECT id, title, description, event_date,
                  location, image_url
           FROM events
           WHERE published = TRUE
             AND event_date >= NOW()
           ORDER BY event_date ASC
           LIMIT 3`
        ),
        pool.query(
          `SELECT id, title, description, day_of_week,
                  start_time, location
           FROM services
           WHERE published = TRUE
           ORDER BY display_order ASC, id ASC
           LIMIT 10`
        )
      ]);

    return res.json({
      announcements: announcements.rows,
      events: events.rows,
      services: services.rows
    });
  } catch (error) {
    console.error("Home API error:", error.message);

    return res.status(500).json({
      error: "Unable to load home page content."
    });
  }
});

// ========================================
// CONTACT FORM / PRAYER REQUESTS
// ========================================

app.post("/api/contact", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();

    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();

    const subject = String(req.body?.subject || "").trim();

    const message = String(req.body?.message || "").trim();

    // Optional hidden honeypot field.
    const website = String(req.body?.website || "").trim();

    if (website) {
      return res.status(200).json({
        success: true,
        message: "Your message has been received."
      });
    }

    if (
      name.length < 2 ||
      name.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      subject.length < 2 ||
      subject.length > 200 ||
      message.length < 5 ||
      message.length > 5000
    ) {
      return res.status(400).json({
        error:
          "Please provide a valid name, email, subject and message."
      });
    }

    await pool.query(
      `INSERT INTO contact_messages
         (name, email, subject, message)
       VALUES ($1, $2, $3, $4)`,
      [name, email, subject, message]
    );

    return res.status(201).json({
      success: true,
      message:
        "Your message has been received. Thank you for contacting us."
    });
  } catch (error) {
    console.error("Contact API error:", error.message);

    return res.status(500).json({
      error:
        "Unable to submit your message. Please try again later."
    });
  }
});

// ========================================
// START SERVER
// ========================================

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `Church backend listening on port ${PORT}`
      );

      console.log(`M-PESA environment: ${MPESA_ENV}`);
    });
  } cat