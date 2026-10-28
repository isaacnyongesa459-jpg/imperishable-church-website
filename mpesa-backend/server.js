process.on("uncaughtException", (err) => {
  console.error("CRASH ERROR (Uncaught Exception):", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("CRASH ERROR (Unhandled Rejection):", reason);
  process.exit(1);
});

const express = require("express");
const { Pool } = require("pg");
const crypto = require("crypto");
const app = express();

const ADMIN_COOKIE_NAME = "__Host-admin_session";
const ADMIN_SESSION_HOURS = 8;
const ADMIN_FRONTEND_ORIGIN =
  "https://isaacnyongesa459-jpg.github.io";

const adminLoginAttempts = new Map();

function safeStringEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  return (
    aBuffer.length === bBuffer.length &&
    crypto.timingSafeEqual(aBuffer, bBuffer)
  );
}

function signAdminPayload(payload) {
  const encoded = Buffer.from(
    JSON.stringify(payload)
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", process.env.ADMIN_SESSION_SECRET)
    .update(encoded)
    .digest("base64url");

  return `${encoded}.${signature}`;
}

function verifyAdminToken(token) {
  try {
    if (typeof token !== "string") return null;

    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [encoded, signature] = parts;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.ADMIN_SESSION_SECRET)
      .update(encoded)
      .digest("base64url");

    if (!safeStringEqual(signature, expectedSignature)) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    );

    if (
      payload.username !== process.env.ADMIN_USERNAME ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= Date.now()
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function getAdminToken(req) {
  const cookieHeader = req.headers.cookie || "";

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;

    const name = part.slice(0, separator).trim();

    if (name === ADMIN_COOKIE_NAME) {
      return part.slice(separator + 1).trim();
    }
  }

  return null;
}

function requireAdmin(req, res, next) {
  const token = getAdminToken(req);
  const session = verifyAdminToken(token);

  if (!session) {
    return res.status(401).json({
      success: false,
      message: "Administrator login required."
    });
  }

  req.admin = { username: session.username };
  next();
}

function requireAdminOrigin(req, res, next) {
  if (
    req.get("origin") !== ADMIN_FRONTEND_ORIGIN
  ) {
    return res.status(403).json({
      success: false,
      message: "Origin not allowed."
    });
  }

  next();
}

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


/* ========================================
   DATABASE CONNECTION
======================================== */

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.on("error", (error) => {
  console.error("Unexpected database error:", error.message);
});

// ========================================
// CHURCH PHOTO GALLERY DATABASE
// ========================================



pool.query(`
  CREATE TABLE IF NOT EXISTS church_gallery (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT DEFAULT '',
    image_url TEXT NOT NULL,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`)
.then(() => {
  console.log("Church gallery table is ready.");
})
.catch((error) => {
  console.error("Church gallery table setup failed:", error.message);
});

pool.query(`
  CREATE TABLE IF NOT EXISTS church_gallery (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT DEFAULT '',
    image_url TEXT NOT NULL,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`)
.then(() => {
  console.log("Church gallery table is ready.");
})
.catch((error) => {
  console.error(
    "Church gallery table setup failed:",
    error.message
  );
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
    "GET, POST, PUT, DELETE, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );
  res.setHeader(
    "Access-Control-Allow-Credentials",
    "true"
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
  try {
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS church_content (
        content_key VARCHAR(100) PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id BIGSERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        body TEXT NOT NULL,
        published BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

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
  } catch (error) {
    console.error("Database initialization error:", error.message);
    throw error;
  }
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
    throw new Error("M-PESA callback URL is not configured.");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(MPESA_CALLBACK_BASE_URL);
  } catch {
    throw new Error("The configured M-PESA callback URL is invalid.");
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
    message: "Imperishable Crown Church backend is running."
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
// DONATION STATUS & TOTAL
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
// CHURCH LEADERS & SERVICES
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
// ADMIN AUTHENTICATION
// ========================================

app.post(
  "/api/admin/login",
  requireAdminOrigin,
  (req, res) => {
    res.setHeader("Cache-Control", "no-store");

    const username = req.body?.username;
    const password = req.body?.password;

    const now = Date.now();
    const key = req.ip || "unknown";
    let attempt = adminLoginAttempts.get(key);

    if (!attempt || now - attempt.startedAt > 15 * 60 * 1000) {
      attempt = { count: 0, startedAt: now };
    }

    if (attempt.count >= 5) {
      adminLoginAttempts.set(key, attempt);

      return res.status(429).json({
        success: false,
        message: "Too many login attempts. Try again later."
      });
    }

    const validCredentials =
      typeof process.env.ADMIN_USERNAME === "string" &&
      process.env.ADMIN_USERNAME.length > 0 &&
      typeof process.env.ADMIN_PASSWORD === "string" &&
      process.env.ADMIN_PASSWORD.length > 0 &&
      typeof process.env.ADMIN_SESSION_SECRET === "string" &&
      process.env.ADMIN_SESSION_SECRET.length >= 32 &&
      safeStringEqual(username, process.env.ADMIN_USERNAME) &&
      safeStringEqual(password, process.env.ADMIN_PASSWORD);

    if (!validCredentials) {
      attempt.count += 1;
      adminLoginAttempts.set(key, attempt);

      return res.status(401).json({
        success: false,
        message: "Invalid username or password."
      });
    }

    adminLoginAttempts.delete(key);

    const token = signAdminPayload({
      username: process.env.ADMIN_USERNAME,
      exp: Date.now() + ADMIN_SESSION_HOURS * 60 * 60 * 1000
    });

    res.cookie(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: ADMIN_SESSION_HOURS * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      message: "Login successful."
    });
  }
);

app.get("/api/admin/me", (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const session = verifyAdminToken(getAdminToken(req));

  if (!session) {
    return res.status(401).json({
      success: false,
      message: "Not logged in."
    });
  }

  return res.json({
    success: true,
    username: session.username
  });
});

app.post(
  "/api/admin/logout",
  requireAdminOrigin,
  (req, res) => {
    res.setHeader("Cache-Control", "no-store");

    res.clearCookie(ADMIN_COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/"
    });

    return res.json({
      success: true,
      message: "Logged out successfully."
    });
  }
);

/* ========================================
   CHURCH PHOTO GALLERY API
======================================== */

// PUBLIC: Show published photos on the website
app.get("/api/gallery", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, title, description, image_url, created_at
      FROM church_gallery
      WHERE published = TRUE
      ORDER BY created_at DESC
      LIMIT 200
    `);

    return res.json({
      success: true,
      photos: result.rows
    });
  } catch (error) {
    console.error("Public gallery error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load gallery."
    });
  }
});

// ADMIN: View all photos, including unpublished ones
app.get(
  "/api/admin/gallery",
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT id, title, description, image_url, published, created_at
        FROM church_gallery
        ORDER BY created_at DESC
        LIMIT 200
      `);

      return res.json({
        success: true,
        photos: result.rows
      });
    } catch (error) {
      console.error("Admin gallery error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Unable to load gallery photos."
      });
    }
  }
);

// ADMIN: Add a photo
app.post(
  "/api/admin/gallery",
  requireAdminOrigin,
  requireAdmin,
  async (req, res) => {
    try {
      const title = String(req.body?.title || "").trim();
      const description = String(req.body?.description || "").trim();
      const imageUrl = String(req.body?.image_url || "").trim();

      let parsedUrl;

      try {
        parsedUrl = new URL(imageUrl);
      } catch {
        return res.status(400).json({
          success: false,
          message: "Enter a valid image URL."
        });
      }

      if (
        title.length < 1 ||
        title.length > 200 ||
        description.length > 2000 ||
        !["https:", "http:"].includes(parsedUrl.protocol) ||
        imageUrl.length > 2000
      ) {
        return res.status(400).json({
          success: false,
          message: "Check the title, description, and image URL."
        });
      }

      const result = await pool.query(
        `INSERT INTO church_gallery
           (title, description, image_url)
         VALUES ($1, $2, $3)
         RETURNING id, title, description, image_url, published, created_at`,
        [title, description, imageUrl]
      );

      return res.status(201).json({
        success: true,
        photo: result.rows[0]
      });
    } catch (error) {
      console.error("Add gallery photo error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Unable to add photo."
      });
    }
  }
);

// ADMIN: Edit a photo
app.patch(
  "/api/admin/gallery/:id",
  requireAdminOrigin,
  requireAdmin,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({
          success: false,
          message: "Invalid photo ID."
        });
      }

      const title = String(req.body?.title || "").trim();
      const description = String(req.body?.description || "").trim();
      const imageUrl = String(req.body?.image_url || "").trim();

      let parsedUrl;

      try {
        parsedUrl = new URL(imageUrl);
      } catch {
        return res.status(400).json({
          success: false,
          message: "Enter a valid image URL."
        });
      }

      if (
        title.length < 1 ||
        title.length > 200 ||
        description.length > 2000 ||
        imageUrl.length > 2000 ||
        !["https:", "http:"].includes(parsedUrl.protocol)
      ) {
        return res.status(400).json({
          success: false,
          message: "Check the title, description, and image URL."
        });
      }

      const result = await pool.query(
        `UPDATE church_gallery
         SET title = $1, description = $2, image_url = $3
         WHERE id = $4
         RETURNING id, title, description, image_url, published, created_at`,
        [title, description, imageUrl, id]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          success: false,
          message: "Photo not found."
        });
      }

      return res.json({
        success: true,
        photo: result.rows[0]
      });
    } catch (error) {
      console.error("Edit gallery photo error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Unable to edit photo."
      });
    }
  }
);

// ADMIN: Publish or unpublish a photo
app.patch(
  "/api/admin/gallery/:id/publish",
  requireAdminOrigin,
  requireAdmin,
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const published = req.body?.published;

      if (
        !Number.isSafeInteger(id) ||
        id < 1 ||
        typeof published !== "boolean"
      ) {
        return res.status(400).json({
          success: false,
          message: "Provide a valid photo ID and publish status."
        });
      }

      const result = await pool.query(
        `UPDATE church_gallery
         SET published = $1
         WHERE id = $2
         RETURNING id, title, published`,
        [published, id]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          success: false,
          message: "Photo not found."
        });
      }

      return res.json({
        success: true,
        photo: result.rows[0]
      });
    } catch (error) {
      console.error("Publish gallery photo error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Unable to update photo status."
      });
    }
  }
);

// ADMIN: Delete a photo
app.delete(
  "/api/admin/gallery/:id",
  requireAdminOrigin,
  requireAdmin,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({
          success: false,
          message: "Invalid photo ID."
        });
      }

      const result = await pool.query(
        `DELETE FROM church_gallery
         WHERE id = $1
         RETURNING id`,
        [id]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          success: false,
          message: "Photo not found."
        });
      }

      return res.json({
        success: true,
        message: "Photo deleted."
      });
    } catch (error) {
      console.error("Delete gallery photo error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Unable to delete photo."
      });
    }
  }
);


// ========================================
// ADMIN DONATIONS
// ========================================

app.get(
  "/api/admin/donations",
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           id,
           phone,
           amount,
           status,
           mpesa_receipt_number,
           result_desc,
           created_at,
           updated_at
         FROM donations
         ORDER BY created_at DESC
         LIMIT 100`
      );

      const totalResult = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM donations
         WHERE status = 'completed'`
      );

      return res.json({
        success: true,
        total: Number(totalResult.rows[0].total),
        donations: result.rows
      });
    } catch (error) {
      console.error(
        "Admin donations error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "Could not load donation records."
      });
    }
  }
);

// ========================================
// ADMIN ANNOUNCEMENTS
// ========================================

app.get(
  "/api/admin/announcements",
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, title, body, published, created_at
         FROM announcements
         ORDER BY created_at DESC
         LIMIT 100`
      );

      return res.json({
        success: true,
        announcements: result.rows
      });
    } catch (error) {
      console.error(
        "Admin announcements error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "Could not load announcements."
      });
    }
  }
);

app.post(
  "/api/admin/announcements",
  requireAdmin,
  requireAdminOrigin,
  async (req, res) => {
    try {
      const title = String(req.body?.title || "").trim();
      const body = String(req.body?.body || "").trim();
      const published = req.body?.published === true;

      if (
        title.length < 2 ||
        title.length > 200 ||
        body.length < 2
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Please provide a valid title and announcement."
        });
      }

      const result = await pool.query(
        `INSERT INTO announcements
          (title, body, published)
         VALUES ($1, $2, $3)
         RETURNING id, title, body, published, created_at`,
        [title, body, published]
      );

      return res.status(201).json({
        success: true,
        announcement: result.rows[0]
      });
    } catch (error) {
      console.error(
        "Create announcement error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "Could not create announcement."
      });
    }
  }
);

app.put(
  "/api/admin/announcements/:id",
  requireAdmin,
  requireAdminOrigin,
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const title = String(req.body?.title || "").trim();
      const body = String(req.body?.body || "").trim();
      const published = req.body?.published === true;

      if (
        !Number.isInteger(id) ||
        id < 1 ||
        title.length < 2 ||
        title.length > 200 ||
        body.length < 2
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Please provide valid announcement details."
        });
      }

      const result = await pool.query(
        `UPDATE announcements
         SET title = $1,
             body = $2,
             published = $3
         WHERE id = $4
         RETURNING id, title, body, published, created_at`,
        [title, body, published, id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Announcement not found."
        });
      }

      return res.json({
        success: true,
        announcement: result.rows[0]
      });
    } catch (error) {
      console.error(
        "Update announcement error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "Could not update announcement."
      });
    }
  }
);

app.delete(
  "/api/admin/announcements/:id",
  requireAdmin,
  requireAdminOrigin,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({
          success: false,
          message: "Invalid announcement ID."
        });
      }

      const result = await pool.query(
        `DELETE FROM announcements
         WHERE id = $1
         RETURNING id`,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Announcement not found."
        });
      }

      return res.json({
        success: true,
        message: "Announcement deleted successfully."
      });
    } catch (error) {
      console.error(
        "Delete announcement error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "Could not delete announcement."
      });
    }
  }
);

// ========================================
// ADMIN EVENTS
// ========================================

app.get(
  "/api/admin/events",
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, title, description, event_date,
                location, image_url, published
         FROM events
         ORDER BY event_date DESC
         LIMIT 100`
      );

      return res.json({
        success: true,
        events: result.rows
      });
    } catch (error) {
      console.error("Admin events error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Could not load events."
      });
    }
  }
);

app.post(
  "/api/admin/events",
  requireAdmin,
  requireAdminOrigin,
  async (req, res) => {
    try {
      const title = String(req.body?.title || "").trim();
      const description = String(req.body?.description || "").trim();
      const location = String(req.body?.location || "").trim();
      const imageUrl = String(req.body?.image_url || "").trim();
      const eventDate = req.body?.event_date;
      const published = req.body?.published === true;

      if (
        title.length < 2 ||
        title.length > 200 ||
        description.length < 2 ||
        description.length > 5000 ||
        location.length > 300 ||
        imageUrl.length > 2000 ||
        !eventDate ||
        !Number.isFinite(Date.parse(eventDate))
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid title, description, date, and event details."
        });
      }

      const result = await pool.query(
        `INSERT INTO events
          (title, description, event_date, location, image_url, published)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, title, description, event_date,
                   location, image_url, published`,
        [
          title,
          description,
          new Date(eventDate).toISOString(),
          location || null,
          imageUrl || null,
          published
        ]
      );

      return res.status(201).json({
        success: true,
        event: result.rows[0]
      });
    } catch (error) {
      console.error("Create event error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Could not create event."
      });
    }
  }
);

app.put(
  "/api/admin/events/:id",
  requireAdmin,
  requireAdminOrigin,
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const title = String(req.body?.title || "").trim();
      const description = String(req.body?.description || "").trim();
      const location = String(req.body?.location || "").trim();
      const imageUrl = String(req.body?.image_url || "").trim();
      const eventDate = req.body?.event_date;
      const published = req.body?.published === true;

      if (
        !Number.isInteger(id) ||
        id < 1 ||
        title.length < 2 ||
        title.length > 200 ||
        description.length < 2 ||
        description.length > 5000 ||
        location.length > 300 ||
        imageUrl.length > 2000 ||
        !eventDate ||
        !Number.isFinite(Date.parse(eventDate))
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide valid event details."
        });
      }

      const result = await pool.query(
        `UPDATE events
         SET title = $1,
             description = $2,
             event_date = $3,
             location = $4,
             image_url = $5,
             published = $6
         WHERE id = $7
         RETURNING id, title, description, event_date,
                   location, image_url, published`,
        [
          title,
          description,
          new Date(eventDate).toISOString(),
          location || null,
          imageUrl || null,
          published,
          id
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Event not found."
        });
      }

      return res.json({
        success: true,
        event: result.rows[0]
      });
    } catch (error) {
      console.error("Update event error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Could not update event."
      });
    }
  }
);

app.delete(
  "/api/admin/events/:id",
  requireAdmin,
  requireAdminOrigin,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({
          success: false,
          message: "Invalid event ID."
        });
      }

      const result = await pool.query(
        `DELETE FROM events
         WHERE id = $1
         RETURNING id`,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Event not found."
        });
      }

      return res.json({
        success: true,
        message: "Event deleted successfully."
      });
    } catch (error) {
      console.error("Delete event error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Could not delete event."
      });
    }
  }
);
// ========================================
// ADMIN: CONTACT MESSAGES
// ========================================

app.get(
  "/api/admin/contact-messages",
  requireAdmin,
  async (req, res) => {
    res.setHeader("Cache-Control", "no-store");

    try {
      const result = await pool.query(`
        SELECT *
        FROM contact_messages
        ORDER BY created_at DESC
        LIMIT 200
      `);

      return res.json({
        success: true,
        messages: result.rows
      });
    } catch (error) {
      console.error("Admin contact messages error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to load contact messages."
      });
    }
  }
);

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
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
