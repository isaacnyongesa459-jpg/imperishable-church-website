process.on("uncaughtException", (err) => {
  console.error("CRASH ERROR (Uncaught Exception):", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("CRASH ERROR (Unhandled Rejection):", reason);
  process.exit(1);
});

const express = require("express");
const adminViews = require("./admin-views");
const { retainOnlyAdminSection } = require("./admin-view-filter");
const { Pool } = require("pg");
const crypto = require("crypto");
const path = require("node:path");
const {
  SUPPORTED_ROLES,
  hashPassword,
  verifyPassword,
  hasPermission,
  hasAdminSectionAccess,
  permissionForAdminApi
} = require("./admin-security");
const { runMigrations, ensureBootstrapSuperAdmin } = require("./migrate");
const app = express();

const ADMIN_COOKIE_NAME = "__Host-admin_session";
const ADMIN_SESSION_HOURS = 8;
const ADMIN_FRONTEND_ORIGIN =
  "https://imperishable-church-mpesa-backend-fa2a.onrender.com";

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

    const isLegacyBootstrapSession =
      !payload.userId && payload.username === process.env.ADMIN_USERNAME;
    if (
      typeof payload.username !== "string" ||
      (!/^\d+$/.test(String(payload.userId || "")) && !isLegacyBootstrapSession) ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= Date.now() ||
      (payload.authVersion !== undefined && !Number.isInteger(payload.authVersion))
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

async function resolveAdminSession(req) {
  const token = getAdminToken(req);
  const session = verifyAdminToken(token);
  if (!session) return null;

  const accountQuery = session.userId
    ? `SELECT u.id::text AS id, u.username, u.display_name, u.is_active,
              u.auth_version, COALESCE(ARRAY_AGG(DISTINCT r.role_key)
                FILTER (WHERE r.role_key IS NOT NULL), ARRAY[]::varchar[]) AS roles,
              COALESCE(JSONB_AGG(DISTINCT r.permissions)
                FILTER (WHERE r.role_key IS NOT NULL), '[]'::jsonb) AS role_permissions
       FROM admin_users u
       LEFT JOIN admin_user_roles ur ON ur.user_id = u.id
       LEFT JOIN admin_roles r ON r.id = ur.role_id
       WHERE u.id = $1
       GROUP BY u.id`
    : `SELECT u.id::text AS id, u.username, u.display_name, u.is_active,
              u.auth_version, COALESCE(ARRAY_AGG(DISTINCT r.role_key)
                FILTER (WHERE r.role_key IS NOT NULL), ARRAY[]::varchar[]) AS roles,
              COALESCE(JSONB_AGG(DISTINCT r.permissions)
                FILTER (WHERE r.role_key IS NOT NULL), '[]'::jsonb) AS role_permissions
       FROM admin_users u
       LEFT JOIN admin_user_roles ur ON ur.user_id = u.id
       LEFT JOIN admin_roles r ON r.id = ur.role_id
       WHERE u.username = $1
       GROUP BY u.id`;
  const account = await pool.query(accountQuery, [session.userId || session.username]);
  if (!account.rowCount) return null;
  const row = account.rows[0];
  if (!row.is_active || Number(row.auth_version) !== Number(session.authVersion || 0)) {
    return null;
  }

  const rolePermissions = Array.isArray(row.role_permissions)
    ? row.role_permissions
    : [];
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    roles: row.roles || [],
    permissions: rolePermissions.flatMap((permissions) =>
      Array.isArray(permissions) ? permissions : []
    )
  };
}

function authorizeAdmin({ superAdminOnly = false, permission = null } = {}) {
  return async (req, res, next) => {
    try {
      const admin = await resolveAdminSession(req);
      if (!admin) {
        return res.status(401).json({
          success: false,
          message: "Administrator login required."
        });
      }
      if (superAdminOnly && !admin.roles.includes("super_admin")) {
        return res.status(403).json({
          success: false,
          message: "Super Administrator permission required."
        });
      }
      if (permission && !hasPermission(admin.permissions, permission)) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to perform this action."
        });
      }
      req.admin = admin;
      return next();
    } catch (error) {
      console.error("Administrator authorization error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Unable to verify administrator access."
      });
    }
  };
}

const requireAdmin = (req, res, next) => {
  const permission = permissionForAdminApi(req.path);
  return permission
    ? authorizeAdmin({ permission })(req, res, next)
    : authorizeAdmin({ superAdminOnly: true })(req, res, next);
};
const requirePermission = (permission) => authorizeAdmin({ permission });

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

app.use(express.json({ limit: "100kb", verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
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
  const origin = req.get("origin");
  const allowedOrigins = [FRONTEND_ORIGIN, ADMIN_FRONTEND_ORIGIN];
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
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

    // ========================================
    // 1. M-PESA DONATIONS
    // ========================================

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
    // Historical Paystack rows, if present, are intentionally not deleted or used by active code.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS paypal_donations (
        id BIGSERIAL PRIMARY KEY,
        order_id TEXT UNIQUE NOT NULL,
        email VARCHAR(254) NOT NULL,
        amount_usd NUMERIC(12, 2) NOT NULL,
        amount_kes NUMERIC(12, 2) NOT NULL,
        fx_rate NUMERIC(12, 6) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'USD',
        status TEXT NOT NULL DEFAULT 'pending',
        paypal_status TEXT,
        capture_id TEXT UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`ALTER TABLE donations
      ADD COLUMN IF NOT EXISTS original_amount NUMERIC(12, 2),
      ADD COLUMN IF NOT EXISTS original_currency VARCHAR(3) NOT NULL DEFAULT 'KES',
      ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(12, 2),
      ADD COLUMN IF NOT EXISTS payment_currency VARCHAR(3) NOT NULL DEFAULT 'KES',
      ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18, 8),
      ADD COLUMN IF NOT EXISTS exchange_rate_date DATE,
      ADD COLUMN IF NOT EXISTS provider VARCHAR(30) NOT NULL DEFAULT 'mpesa',
      ADD COLUMN IF NOT EXISTS transaction_reference TEXT;`);
    await pool.query(`ALTER TABLE paypal_donations
      ADD COLUMN IF NOT EXISTS original_amount NUMERIC(12, 2),
      ADD COLUMN IF NOT EXISTS original_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
      ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(12, 2),
      ADD COLUMN IF NOT EXISTS payment_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
      ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18, 8),
      ADD COLUMN IF NOT EXISTS exchange_rate_date DATE,
      ADD COLUMN IF NOT EXISTS provider VARCHAR(30) NOT NULL DEFAULT 'paypal',
      ADD COLUMN IF NOT EXISTS transaction_reference TEXT;`);
    await pool.query(`UPDATE donations
      SET original_amount = amount, payment_amount = amount,
          original_currency = 'KES', payment_currency = 'KES',
          provider = 'mpesa', transaction_reference = checkout_request_id
      WHERE original_amount IS NULL;`);
    await pool.query(`UPDATE paypal_donations
      SET original_amount = amount_usd, payment_amount = amount_usd,
          original_currency = 'USD', payment_currency = 'USD',
          exchange_rate = fx_rate, provider = 'paypal', transaction_reference = order_id
      WHERE original_amount IS NULL;`);

    // ========================================
    // 2. CHURCH WEBSITE CONTENT
    // ========================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS church_content (
        content_key VARCHAR(100) PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ========================================
    // 3. ANNOUNCEMENTS
    // ========================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id BIGSERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        body TEXT NOT NULL,
        published BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ========================================
    // 4. CHURCH LEADERS
    // ========================================

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

    // ========================================
    // 5. CHURCH SERVICES
    // ========================================

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

    // ========================================
    // 6. CHURCH EVENTS
    // ========================================

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

    // ========================================
    // 7. CONTACT MESSAGES
    // ========================================

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

    // ========================================
    // 8. CHURCH MEMBERS
    // ========================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS church_members (
        id BIGSERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        gender VARCHAR(20),
        phone VARCHAR(30),
        email VARCHAR(150),
        date_of_birth DATE,
        address TEXT,
        ministry VARCHAR(100),
        membership_status VARCHAR(30) DEFAULT 'active',
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ========================================
    // 9. CHURCH ATTENDANCE
    // ========================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS church_attendance (
        id BIGSERIAL PRIMARY KEY,
        member_id BIGINT REFERENCES church_members(id)
          ON DELETE SET NULL,
        attendee_name VARCHAR(200),
        service_name VARCHAR(150) NOT NULL,
        attendance_date DATE NOT NULL,
        attendance_type VARCHAR(30) DEFAULT 'member',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ========================================
    // 10. CHURCH EXPENSES
    // ========================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS church_expenses (
        id BIGSERIAL PRIMARY KEY,
        expense_title VARCHAR(200) NOT NULL,
        category VARCHAR(100) NOT NULL,
        amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
        payment_method VARCHAR(50),
        description TEXT,
        expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ========================================
    // 11. CHURCH MINISTRIES
    // ========================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS church_ministries (
        id BIGSERIAL PRIMARY KEY,
        ministry_name VARCHAR(150) NOT NULL UNIQUE,
        description TEXT DEFAULT '',
        leader_name VARCHAR(150),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ========================================
    // 12. FINANCIAL CATEGORIES
    // ========================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS financial_categories (
        id BIGSERIAL PRIMARY KEY,
        category_name VARCHAR(100) NOT NULL UNIQUE,
        category_type VARCHAR(30) NOT NULL
          CHECK (category_type IN ('income', 'expense')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ========================================
    // 13. ADMIN ACTIVITY LOG
    // ========================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_activity_logs (
        id BIGSERIAL PRIMARY KEY,
        admin_username VARCHAR(100),
        action VARCHAR(200) NOT NULL,
        details TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ========================================
    // 14. DATABASE INDEXES
    // ========================================

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_members_name
      ON church_members(last_name, first_name);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_date
      ON church_attendance(attendance_date);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_expenses_date
      ON church_expenses(expense_date);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_donations_status
      ON donations(status);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_donations_created
      ON donations(created_at);
    `);

    console.log("All church website database tables are ready.");

  } catch (error) {

    console.error(
      "Database initialization error:",
      error.message
    );

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
        (checkout_request_id, merchant_request_id, phone, amount, original_amount, original_currency,
         payment_amount, payment_currency, provider, transaction_reference, status)
       VALUES ($1, $2, $3, $4, $4, 'KES', $4, 'KES', 'mpesa', $1, 'pending')
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
// PAYPAL LIVE DONATIONS WITH SERVER-SIDE CURRENCY CONVERSION
// ========================================
const SUPPORTED_CURRENCIES = ["KES", "USD", "INR"];
const PAYPAL_ENV = process.env.PAYPAL_ENV === "live" ? "live" : "sandbox";
const PAYPAL_API_BASE = PAYPAL_ENV === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";
const PAYPAL_CURRENCY = "USD";
const PAYPAL_MAX_USD = 10000;
const FRANKFURTER_BASE_URL = "https://api.frankfurter.dev/v2/rate";
const FRANKFURTER_CACHE_MS = 15 * 60 * 1000;
const frankfurterCache = new Map();

function paypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

async function getPayPalAccessToken() {
  if (!paypalConfigured()) {
    const error = new Error("PayPal is not configured on the server.");
    error.status = 503;
    throw error;
  }
  const credentials = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: "grant_type=client_credentials"
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    const error = new Error("PayPal authentication failed.");
    error.status = 502;
    throw error;
  }
  return payload.access_token;
}

function validateCurrency(currency) {
  const normalized = String(currency || "").trim().toUpperCase();
  if (!SUPPORTED_CURRENCIES.includes(normalized)) {
    const error = new Error("Currency must be KES, USD, or INR.");
    error.status = 400;
    throw error;
  }
  return normalized;
}

function validateOriginalAmount(value, currency) {
  const amount = Number(value);
  const maximum = currency === "KES" ? 250000 : currency === "INR" ? 900000 : PAYPAL_MAX_USD;
  if (!Number.isFinite(amount) || amount <= 0 || amount > maximum) {
    const error = new Error(`Enter a valid ${currency} donation amount up to ${maximum.toLocaleString("en-US")}.`);
    error.status = 400;
    throw error;
  }
  return Math.round(amount * 100) / 100;
}

function rateKey(base, quote) {
  return `${base}/${quote}`;
}

async function getFrankfurterRate(base, quote) {
  base = validateCurrency(base);
  quote = validateCurrency(quote);
  if (base === quote) return { base, quote, rate: 1, date: new Date().toISOString().slice(0, 10) };
  const key = rateKey(base, quote);
  const cached = frankfurterCache.get(key);
  if (cached && Date.now() - cached.cachedAt < FRANKFURTER_CACHE_MS) return cached;
  const response = await fetch(`${FRANKFURTER_BASE_URL}/${base}/${quote}`, { headers: { Accept: "application/json" } });
  const payload = await response.json();
  const rate = Number(payload?.rate);
  if (!response.ok || !Number.isFinite(rate) || rate <= 0 || payload?.base !== base || payload?.quote !== quote) {
    const error = new Error(`Frankfurter could not provide an indicative ${base}/${quote} rate.`);
    error.status = 502;
    throw error;
  }
  const result = { base, quote, rate, date: payload.date, cachedAt: Date.now() };
  frankfurterCache.set(key, result);
  return result;
}

async function getAllCurrencyRates() {
  const pairs = [];
  for (const base of SUPPORTED_CURRENCIES) {
    for (const quote of SUPPORTED_CURRENCIES) {
      if (base !== quote) pairs.push(getFrankfurterRate(base, quote));
    }
  }
  const results = await Promise.all(pairs);
  const rates = {};
  for (const result of results) rates[rateKey(result.base, result.quote)] = result.rate;
  return { currencies: SUPPORTED_CURRENCIES, rates, rateDate: results.map((r) => r.date).sort().pop(), source: "Frankfurter", indicative: true };
}

async function convertCurrency(amount, base, quote) {
  const rate = await getFrankfurterRate(base, quote);
  return { amount: Math.round(amount * rate.rate * 100) / 100, rate: rate.rate, rateDate: rate.date };
}

app.get("/api/currency/rates", async (_req, res) => {
  try {
    return res.json(await getAllCurrencyRates());
  } catch (error) {
    return res.status(error.status || 502).json({ error: error.message || "Currency rates are temporarily unavailable." });
  }
});

app.get("/api/donations/paypal/config", async (_req, res) => {
  try {
    const rates = await getAllCurrencyRates();
    return res.json({ enabled: paypalConfigured(), clientId: paypalConfigured() ? process.env.PAYPAL_CLIENT_ID : null, environment: PAYPAL_ENV, currency: PAYPAL_CURRENCY, ...rates });
  } catch (error) {
    return res.status(error.status || 502).json({ error: error.message });
  }
});

app.post("/api/donations/paypal/create-order", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
    const originalCurrency = validateCurrency(req.body?.currency);
    const originalAmount = validateOriginalAmount(req.body?.amount, originalCurrency);
    const conversion = await convertCurrency(originalAmount, originalCurrency, "USD");
    const amountUsd = Math.round(conversion.amount * 100) / 100;
    if (amountUsd < 0.01 || amountUsd > PAYPAL_MAX_USD) return res.status(400).json({ error: `The converted PayPal amount must be between USD 0.01 and USD ${PAYPAL_MAX_USD}.` });
    const token = await getPayPalAccessToken();
    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation", "PayPal-Request-Id": crypto.randomUUID() },
      body: JSON.stringify({ intent: "CAPTURE", purchase_units: [{ reference_id: "church-donation", description: "Imperishable Crown Outreach Baptist Church donation", custom_id: "church-donation", amount: { currency_code: "USD", value: amountUsd.toFixed(2) } }], application_context: { brand_name: "Imperishable Crown Outreach Baptist Church", shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW", return_url: `${FRONTEND_ORIGIN}/imperishable-church-website/donate.html`, cancel_url: `${FRONTEND_ORIGIN}/imperishable-church-website/donate.html` } })
    });
    const payload = await response.json();
    if (!response.ok || !payload.id) {
      const providerCode = payload.name || payload.error || "ORDER_CREATE_FAILED";
      const providerDetail = payload.details?.[0] || {};
      const providerIssue = providerDetail.issue || providerDetail.description || "PayPal rejected the order request.";
      const providerField = providerDetail.field || "unknown_field";
      const providerValue = providerDetail.value || "not_provided";
      const debugId = payload.debug_id || "not_provided";
      console.error("PayPal order rejected:", response.status, providerCode, providerIssue, providerField, providerValue, debugId);
      return res.status(502).json({ error: `PayPal rejected the order: ${providerCode}. ${providerIssue} Field: ${providerField}. No donation was charged.`, providerStatus: response.status, providerCode, providerField, providerValue, debugId });
    }
    await pool.query(`INSERT INTO paypal_donations (order_id, email, amount_usd, amount_kes, fx_rate, currency, original_amount, original_currency, payment_amount, payment_currency, exchange_rate, exchange_rate_date, provider, transaction_reference, status, paypal_status) VALUES ($1,$2,$3,$4,$5,'USD',$6,$7,$3,'USD',$5,$8,'paypal',$1,'pending',$9) ON CONFLICT (order_id) DO NOTHING`, [payload.id, email, amountUsd, originalCurrency === "KES" ? originalAmount : (await convertCurrency(originalAmount, originalCurrency, "KES")).amount, conversion.rate, originalAmount, originalCurrency, conversion.rateDate, payload.status || "CREATED"]);
    return res.json({ orderId: payload.id, originalAmount, originalCurrency, amountUsd, rate: conversion.rate, rateDate: conversion.rateDate, currency: "USD" });
  } catch (error) {
    console.error("PayPal order error:", error.message);
    return res.status(error.status || 500).json({ error: error.message || "Could not start the PayPal donation." });
  }
});

app.post("/api/donations/paypal/capture-order", async (req, res) => {
  try {
    const orderId = String(req.body?.orderId || "").trim();
    if (!/^[A-Z0-9-]{5,100}$/i.test(orderId)) return res.status(400).json({ error: "A valid PayPal order is required." });
    const record = await pool.query(`SELECT order_id, email, original_amount, original_currency, amount_usd, amount_kes, exchange_rate, exchange_rate_date, currency, status, capture_id FROM paypal_donations WHERE order_id = $1`, [orderId]);
    if (!record.rowCount) return res.status(404).json({ error: "PayPal donation record not found." });
    const donation = record.rows[0];
    if (donation.status === "completed") return res.json({ status: "completed", orderId, captureId: donation.capture_id, originalAmount: Number(donation.original_amount), originalCurrency: donation.original_currency, amountUsd: Number(donation.amount_usd), amountKes: Number(donation.amount_kes), currency: donation.currency });
    const token = await getPayPalAccessToken();
    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" } });
    const payload = await response.json();
    const capture = payload.purchase_units?.[0]?.payments?.captures?.[0];
    const capturedAmount = Number(capture?.amount?.value);
    const successful = response.ok && payload.status === "COMPLETED" && capture?.status === "COMPLETED" && capture?.amount?.currency_code === donation.currency && capturedAmount === Number(donation.amount_usd);
    const status = successful ? "completed" : response.ok && payload.status === "PAYER_ACTION_REQUIRED" ? "pending" : "failed";
    await pool.query(`UPDATE paypal_donations SET status=$1, paypal_status=$2, capture_id=COALESCE($3,capture_id), updated_at=NOW() WHERE order_id=$4`, [status, payload.status || capture?.status || "UNKNOWN", capture?.id || null, orderId]);
    if (!successful) {
      const providerStatus = payload.status || capture?.status || "NOT_CONFIRMED";
      return res.status(status === "pending" ? 202 : 402).json({ status, providerStatus, message: status === "pending" ? "PayPal payment is still processing." : `PayPal returned ${providerStatus}. No donation was recorded.` });
    }
    return res.json({ status, orderId, captureId: capture.id, originalAmount: Number(donation.original_amount), originalCurrency: donation.original_currency, amountUsd: Number(donation.amount_usd), amountKes: Number(donation.amount_kes), currency: donation.currency, message: "Your donation has been confirmed. Thank you for giving." });
  } catch (error) {
    console.error("PayPal capture error:", error.message);
    return res.status(error.status || 500).json({ error: error.message || "Could not capture the PayPal donation." });
  }
});

// Historical Paystack records are retained in the database for preservation, but Paystack is no longer an active payment integration.

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
      `SELECT
         (SELECT COALESCE(SUM(amount), 0) FROM donations WHERE status = 'completed') +
         (SELECT COALESCE(SUM(amount_kes), 0) FROM paypal_donations WHERE status = 'completed')
         AS total`
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
  async (req, res) => {
    res.setHeader("Cache-Control", "no-store");

    const username = typeof req.body?.username === "string"
      ? req.body.username.trim()
      : "";
    const password = typeof req.body?.password === "string"
      ? req.body.password
      : "";

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

    let account = null;
    let validCredentials = false;
    if (
      username.length > 0 && username.length <= 60 &&
      password.length > 0 && password.length <= 1024 &&
      typeof process.env.ADMIN_SESSION_SECRET === "string" &&
      process.env.ADMIN_SESSION_SECRET.length >= 32
    ) {
      try {
        const result = await pool.query(
          `SELECT u.id::text AS id, u.username, u.password_hash,
                  u.is_active, u.auth_version,
                  COALESCE(ARRAY_AGG(DISTINCT r.role_key)
                    FILTER (WHERE r.role_key IS NOT NULL), ARRAY[]::varchar[]) AS roles
           FROM admin_users u
           LEFT JOIN admin_user_roles ur ON ur.user_id = u.id
           LEFT JOIN admin_roles r ON r.id = ur.role_id
           WHERE u.username = $1
           GROUP BY u.id`,
          [username]
        );
        account = result.rows[0] || null;
        validCredentials = Boolean(
          account && account.is_active && account.roles.length &&
          await verifyPassword(password, account.password_hash)
        );
      } catch (error) {
        console.error("Administrator login lookup failed:", error.message);
        return res.status(503).json({
          success: false,
          message: "Administrator sign-in is temporarily unavailable."
        });
      }
    }

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
      userId: account.id,
      username: account.username,
      authVersion: Number(account.auth_version),
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

app.get("/api/admin/me", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  try {
    const admin = await resolveAdminSession(req);
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Not logged in."
      });
    }

    return res.json({
      success: true,
      id: admin.id,
      username: admin.username,
      displayName: admin.displayName,
      roles: admin.roles,
      permissions: admin.permissions
    });
  } catch (error) {
    console.error("Administrator session lookup failed:", error.message);
    return res.status(503).json({
      success: false,
      message: "Unable to verify the administrator session."
    });
  }
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

app.get("/api/admin/users", requirePermission("users:manage"), async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const result = await pool.query(`
      SELECT u.id::text AS id, u.username, u.display_name, u.is_active,
             u.is_bootstrap, u.created_at,
             COALESCE(ARRAY_AGG(DISTINCT r.role_key)
               FILTER (WHERE r.role_key IS NOT NULL), ARRAY[]::varchar[]) AS roles
      FROM admin_users u
      LEFT JOIN admin_user_roles ur ON ur.user_id = u.id
      LEFT JOIN admin_roles r ON r.id = ur.role_id
      GROUP BY u.id
      ORDER BY u.created_at ASC, u.id ASC
    `);
    return res.json({ success: true, users: result.rows });
  } catch (error) {
    console.error("Admin user listing failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load administrator accounts." });
  }
});

app.post(
  "/api/admin/users",
  requireAdminOrigin,
  requirePermission("users:manage"),
  async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const roleKey = typeof req.body?.role === "string" ? req.body.role : "";
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,59}$/.test(username) ||
        displayName.length < 2 || displayName.length > 120 ||
        password.length < 12 || Buffer.byteLength(password, "utf8") > 1024 ||
        !SUPPORTED_ROLES.includes(roleKey)) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid username, display name, 12-character minimum password, and supported role."
      });
    }

    const client = await pool.connect();
    try {
      const passwordHash = await hashPassword(password);
      await client.query("BEGIN");
      const created = await client.query(
        `INSERT INTO admin_users (username, display_name, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id::text AS id, username, display_name, is_active, created_at`,
        [username, displayName, passwordHash]
      );
      const user = created.rows[0];
      await client.query(
        `INSERT INTO admin_user_roles (user_id, role_id, assigned_by)
         SELECT $1, id, $2 FROM admin_roles WHERE role_key = $3`,
        [user.id, req.admin.id, roleKey]
      );
      await client.query(
        `INSERT INTO admin_activity_logs (admin_username, action, details)
         VALUES ($1, 'admin.user.created', $2)`,
        [req.admin.username, JSON.stringify({ username, role: roleKey })]
      );
      await client.query("COMMIT");
      return res.status(201).json({ success: true, user: { ...user, roles: [roleKey] } });
    } catch (error) {
      await client.query("ROLLBACK");
      if (error.code === "23505") {
        return res.status(409).json({ success: false, message: "That username is already in use." });
      }
      console.error("Administrator account creation failed:", error.message);
      return res.status(500).json({ success: false, message: "Unable to create the administrator account." });
    } finally {
      client.release();
    }
  }
);

app.patch(
  "/api/admin/users/:id",
  requireAdminOrigin,
  requirePermission("users:manage"),
  async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    const userId = req.params.id;
    const roleKey = req.body?.role;
    const isActive = req.body?.isActive;
    const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : undefined;
    if (!/^\d+$/.test(userId) ||
        (roleKey !== undefined && !SUPPORTED_ROLES.includes(roleKey)) ||
        (isActive !== undefined && typeof isActive !== "boolean") ||
        (displayName !== undefined && (displayName.length < 2 || displayName.length > 120)) ||
        (roleKey === undefined && isActive === undefined && displayName === undefined)) {
      return res.status(400).json({ success: false, message: "Invalid administrator update." });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const lockedAccount = await client.query(
        "SELECT id FROM admin_users WHERE id = $1 FOR UPDATE",
        [userId]
      );
      if (!lockedAccount.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ success: false, message: "Administrator account not found." });
      }
      const existing = await client.query(
        `SELECT u.id::text AS id, u.username, u.display_name, u.is_active,
                u.is_bootstrap,
                COALESCE(ARRAY_AGG(DISTINCT r.role_key)
                  FILTER (WHERE r.role_key IS NOT NULL), ARRAY[]::varchar[]) AS roles
         FROM admin_users u
         LEFT JOIN admin_user_roles ur ON ur.user_id = u.id
         LEFT JOIN admin_roles r ON r.id = ur.role_id
         WHERE u.id = $1
         GROUP BY u.id`,
        [userId]
      );
      const current = existing.rows[0];
      const willRemainSuperAdmin =
        (roleKey === undefined ? current.roles.includes("super_admin") : roleKey === "super_admin") &&
        (isActive === undefined ? current.is_active : isActive);
      if (current.roles.includes("super_admin") && !willRemainSuperAdmin) {
        await client.query("SELECT pg_advisory_xact_lock($1)", [731942602]);
        const activeAdmins = await client.query(`
          SELECT COUNT(DISTINCT u.id)::int AS count
          FROM admin_users u
          JOIN admin_user_roles ur ON ur.user_id = u.id
          JOIN admin_roles r ON r.id = ur.role_id AND r.role_key = 'super_admin'
          WHERE u.is_active = TRUE
        `);
        if (activeAdmins.rows[0].count <= 1) {
          await client.query("ROLLBACK");
          return res.status(409).json({ success: false, message: "At least one active Super Administrator must remain." });
        }
      }
      if (current.is_bootstrap && (roleKey !== undefined && roleKey !== "super_admin" || isActive === false)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "The bootstrap Super Administrator account cannot be demoted or deactivated." });
      }
      if (String(current.id) === String(req.admin.id) && isActive === false) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "You cannot deactivate your own account." });
      }

      if (roleKey !== undefined) {
        await client.query("DELETE FROM admin_user_roles WHERE user_id = $1", [userId]);
        await client.query(
          `INSERT INTO admin_user_roles (user_id, role_id, assigned_by)
           SELECT $1, id, $2 FROM admin_roles WHERE role_key = $3`,
          [userId, req.admin.id, roleKey]
        );
      }
      const updated = await client.query(
        `UPDATE admin_users
         SET display_name = COALESCE($2, display_name),
             is_active = COALESCE($3, is_active),
             auth_version = auth_version + 1,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id::text AS id, username, display_name, is_active, created_at`,
        [userId, displayName ?? null, isActive ?? null]
      );
      const auditDetails = {
        username: current.username,
        role: roleKey ?? current.roles[0] ?? null,
        isActive: isActive ?? current.is_active
      };
      await client.query(
        `INSERT INTO admin_activity_logs (admin_username, action, details)
         VALUES ($1, 'admin.user.updated', $2)`,
        [req.admin.username, JSON.stringify(auditDetails)]
      );
      await client.query("COMMIT");
      return res.json({
        success: true,
        user: { ...updated.rows[0], roles: roleKey ? [roleKey] : current.roles }
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Administrator account update failed:", error.message);
      return res.status(500).json({ success: false, message: "Unable to update the administrator account." });
    } finally {
      client.release();
    }
  }
);

// Admin views are delivered by the authenticated backend, not GitHub Pages.
const ADMIN_SECTIONS = {
  dashboard: "dashboardTop", members: "membersSection", attendance: "attendanceSection",
  expenses: "expensesSection", reports: "financialReportsSection", ministries: "ministriesSection",
  announcements: "announcementsSection", events: "eventsSection", donations: "donationsSection",
  messages: "messagesSection", gallery: "gallerySection"
};
const ADMIN_SECTION_MARKUP_IDS = [...Object.values(ADMIN_SECTIONS), "churchStatistics"];
app.get(["/admin", "/admin/login"], (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.type("html").send(adminViews.login);
});
app.get("/admin/users", requirePermission("users:manage"), (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.sendFile(path.join(__dirname, "admin-users.html"));
});
app.get("/admin/:section", async (req, res) => {
  const section = req.params.section;
  if (!Object.prototype.hasOwnProperty.call(ADMIN_SECTIONS, section)) return res.sendStatus(404);
  try {
    const admin = await resolveAdminSession(req);
    if (!admin) return res.redirect("/admin/login");
    if (!hasAdminSectionAccess(admin, section)) {
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      return res.status(403).type("html").send("<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><title>Access denied</title><main><h1>Access denied</h1><p>Your administrator role cannot open this section.</p><a href=\"/admin/login\">Return to administrator login</a></main></html>");
    }
    let html = adminViews.dashboard;
    if (section !== "dashboard") {
      html = retainOnlyAdminSection(
        html,
        ADMIN_SECTIONS[section],
        ADMIN_SECTION_MARKUP_IDS
      );
    }
    const sectionLinks = Object.entries(ADMIN_SECTIONS)
      .filter(([key]) => hasAdminSectionAccess(admin, key))
      .map(([key]) => `<a href="/admin/${key}"${key === section ? ' aria-current="page"' : ""}>${key[0].toUpperCase()+key.slice(1)}</a>`)
      .join("");
    const userLink = hasPermission(admin.permissions, "users:manage")
      ? `<a href="/admin/users">User management</a>`
      : "";
    const nav = sectionLinks + userLink + `<a class="church-site-link" href="https://isaacnyongesa459-jpg.github.io/imperishable-church-website/index.html">Church website</a>`;
    html = html.replace(/<nav>[\s\S]*?<\/nav>/, `<nav aria-label="Admin dashboard sections">${nav}</nav>`);
    html = html.replace("</body>", `<script>document.documentElement.dataset.adminPage=${JSON.stringify(section)}; const selected=${JSON.stringify(ADMIN_SECTIONS[section])}; document.querySelectorAll('.admin-main > section').forEach(el=>{if(el.id!==selected)el.hidden=true}); if(selected==='dashboardTop')document.querySelectorAll('.admin-main > section').forEach(el=>el.hidden=false); const siteLink=document.querySelector('.church-site-link'); if(siteLink) siteLink.href += '?theme='+encodeURIComponent(document.documentElement.dataset.theme);</script></body>`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    return res.type("html").send(html);
  } catch (error) {
    console.error("Admin section authorization error:", error.message);
    return res.status(500).type("text/plain").send("Unable to verify administrator access.");
  }
});

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
// CHURCH MEMBERS MANAGEMENT API
// ========================================

// GET ALL MEMBERS
app.get(
  "/api/admin/members",
  requireAdmin,
  async (req, res) => {
    try {
      const search = String(req.query.search || "").trim();

      const result = await pool.query(
        `SELECT *
         FROM church_members
         WHERE first_name ILIKE $1
            OR last_name ILIKE $1
            OR phone ILIKE $1
            OR email ILIKE $1
         ORDER BY created_at DESC
         LIMIT 200`,
        [`%${search}%`]
      );

      res.json({
        success: true,
        members: result.rows
      });

    } catch (error) {
      console.error("Fetch members:", error.message);

      res.status(500).json({
        success: false,
        message: "Unable to fetch members."
      });
    }
  }
);


// REGISTER A NEW MEMBER
app.post(
  "/api/admin/members",
  requireAdmin,
  requireAdminOrigin,
  async (req, res) => {
    try {
      const {
        first_name,
        last_name,
        gender,
        phone,
        email,
        date_of_birth,
        address,
        ministry
      } = req.body;

      if (!first_name?.trim() || !last_name?.trim()) {
        return res.status(400).json({
          success: false,
          message: "First name and last name are required."
        });
      }

      const result = await pool.query(
        `INSERT INTO church_members
         (
           first_name,
           last_name,
           gender,
           phone,
           email,
           date_of_birth,
           address,
           ministry
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [
          first_name.trim(),
          last_name.trim(),
          gender || null,
          phone || null,
          email || null,
          date_of_birth || null,
          address || null,
          ministry || null
        ]
      );

      res.status(201).json({
        success: true,
        message: "Church member registered successfully.",
        member: result.rows[0]
      });

    } catch (error) {
      console.error("Register member:", error.message);

      res.status(500).json({
        success: false,
        message: "Unable to register member."
      });
    }
  }
);


// UPDATE MEMBER DETAILS
app.put(
  "/api/admin/members/:id",
  requireAdmin,
  requireAdminOrigin,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid member ID."
        });
      }

      const {
        first_name,
        last_name,
        gender,
        phone,
        email,
        date_of_birth,
        address,
        ministry,
        membership_status
      } = req.body;

      if (!first_name?.trim() || !last_name?.trim()) {
        return res.status(400).json({
          success: false,
          message: "First name and last name are required."
        });
      }

      const result = await pool.query(
        `UPDATE church_members
         SET first_name = $1,
             last_name = $2,
             gender = $3,
             phone = $4,
             email = $5,
             date_of_birth = $6,
             address = $7,
             ministry = $8,
             membership_status = $9
         WHERE id = $10
         RETURNING *`,
        [
          first_name.trim(),
          last_name.trim(),
          gender || null,
          phone || null,
          email || null,
          date_of_birth || null,
          address || null,
          ministry || null,
          membership_status || "active",
          id
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Member not found."
        });
      }

      res.json({
        success: true,
        message: "Member updated successfully.",
        member: result.rows[0]
      });

    } catch (error) {
      console.error("Update member:", error.message);

      res.status(500).json({
        success: false,
        message: "Unable to update member."
      });
    }
  }
);


// DELETE MEMBER
app.delete(
  "/api/admin/members/:id",
  requireAdmin,
  requireAdminOrigin,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid member ID."
        });
      }

      const result = await pool.query(
        `DELETE FROM church_members
         WHERE id = $1
         RETURNING id`,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Member not found."
        });
      }

      res.json({
        success: true,
        message: "Member deleted successfully."
      });

    } catch (error) {
      console.error("Delete member:", error.message);

      res.status(500).json({
        success: false,
        message: "Unable to delete member."
      });
    }
  }
);

// ========================================
// CHURCH ATTENDANCE MANAGEMENT API
// ========================================


// ========================================
// 1. GET ALL ATTENDANCE RECORDS
// ========================================

app.get(
  "/api/admin/attendance",
  requireAdmin,
  async (req, res) => {
    try {
      const { date, service, type } = req.query;

      const result = await pool.query(
        `SELECT
           a.id,
           a.member_id,
           a.attendee_name,
           a.service_name,
           a.attendance_date,
           a.attendance_type,
           a.created_at,
           m.first_name,
           m.last_name
         FROM church_attendance a
         LEFT JOIN church_members m
           ON a.member_id = m.id
         WHERE ($1::date IS NULL OR a.attendance_date = $1::date)
           AND ($2::text IS NULL OR a.service_name ILIKE '%' || $2 || '%')
           AND ($3::text IS NULL OR a.attendance_type = $3)
         ORDER BY a.attendance_date DESC, a.id DESC
         LIMIT 500`,
        [
          date || null,
          service || null,
          type || null
        ]
      );

      res.json({
        success: true,
        attendance: result.rows
      });

    } catch (error) {
      console.error("Fetch attendance:", error.message);

      res.status(500).json({
        success: false,
        message: "Unable to retrieve attendance records."
      });
    }
  }
);


// ========================================
// 2. RECORD ATTENDANCE
// ========================================

app.post(
  "/api/admin/attendance",
  requireAdmin,
  requireAdminOrigin,
  async (req, res) => {
    try {
      const {
        member_id,
        attendee_name,
        service_name,
        attendance_date,
        attendance_type
      } = req.body;

      if (!service_name?.trim() || !attendance_date) {
        return res.status(400).json({
          success: false,
          message: "Service name and attendance date are required."
        });
      }

      // Validate date
      const parsedDate = new Date(`${attendance_date}T00:00:00Z`);

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(attendance_date) ||
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== attendance_date
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid attendance date."
        });
      }

      const allowedTypes = ["member", "visitor", "child"];

      const type = attendance_type || "member";

      if (!allowedTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid attendance type."
        });
      }

      let memberId = null;
      let name = attendee_name?.trim() || null;

      // Verify member exists
      if (member_id !== undefined && member_id !== null && member_id !== "") {
        memberId = Number(member_id);

        if (!Number.isSafeInteger(memberId) || memberId <= 0) {
          return res.status(400).json({
            success: false,
            message: "Invalid member ID."
          });
        }

        const member = await pool.query(
          `SELECT first_name, last_name
           FROM church_members
           WHERE id = $1`,
          [memberId]
        );

        if (member.rowCount === 0) {
          return res.status(404).json({
            success: false,
            message: "Church member not found."
          });
        }

        name = name || 
          `${member.rows[0].first_name} ${member.rows[0].last_name}`;
      }

      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Please provide an attendee name."
        });
      }

      const result = await pool.query(
        `INSERT INTO church_attendance (
           member_id,
           attendee_name,
           service_name,
           attendance_date,
           attendance_type
         )
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          memberId,
          name,
          service_name.trim(),
          attendance_date,
          type
        ]
      );

      res.status(201).json({
        success: true,
        message: "Attendance recorded successfully.",
        attendance: result.rows[0]
      });

    } catch (error) {
      console.error("Record attendance:", error.message);

      res.status(500).json({
        success: false,
        message: "Unable to record attendance."
      });
    }
  }
);


// ========================================
// 3. UPDATE ATTENDANCE RECORD
// ========================================

app.put(
  "/api/admin/attendance/:id",
  requireAdmin,
  requireAdminOrigin,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid attendance ID."
        });
      }

      const {
        attendee_name,
        service_name,
        attendance_date,
        attendance_type
      } = req.body;

      if (!attendee_name?.trim() || !service_name?.trim() || !attendance_date) {
        return res.status(400).json({
          success: false,
          message: "Attendee name, service and date are required."
        });
      }

      const parsedDate = new Date(`${attendance_date}T00:00:00Z`);

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(attendance_date) ||
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== attendance_date
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid attendance date."
        });
      }

      const allowedTypes = ["member", "visitor", "child"];

      if (!allowedTypes.includes(attendance_type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid attendance type."
        });
      }

      const result = await pool.query(
        `UPDATE church_attendance
         SET attendee_name = $1,
             service_name = $2,
             attendance_date = $3,
             attendance_type = $4
         WHERE id = $5
         RETURNING *`,
        [
          attendee_name.trim(),
          service_name.trim(),
          attendance_date,
          attendance_type,
          id
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Attendance record not found."
        });
      }

      res.json({
        success: true,
        message: "Attendance updated successfully.",
        attendance: result.rows[0]
      });

    } catch (error) {
      console.error("Update attendance:", error.message);

      res.status(500).json({
        success: false,
        message: "Unable to update attendance."
      });
    }
  }
);


// ========================================
// 4. DELETE ATTENDANCE RECORD
// ========================================

app.delete(
  "/api/admin/attendance/:id",
  requireAdmin,
  requireAdminOrigin,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid attendance ID."
        });
      }

      const result = await pool.query(
        `DELETE FROM church_attendance
         WHERE id = $1
         RETURNING id`,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Attendance record not found."
        });
      }

      res.json({
        success: true,
        message: "Attendance record deleted successfully."
      });

    } catch (error) {
      console.error("Delete attendance:", error.message);

      res.status(500).json({
        success: false,
        message: "Unable to delete attendance record."
      });
    }
  }
);


// ========================================
// 5. ATTENDANCE STATISTICS
// ========================================

app.get(
  "/api/admin/attendance/stats",
  requireAdmin,
  async (req, res) => {
    try {
      const { date } = req.query;

      const result = await pool.query(
        `SELECT
           COUNT(*)::INTEGER AS total_attendance,
           COUNT(*) FILTER (
             WHERE attendance_type = 'member'
           )::INTEGER AS members,
           COUNT(*) FILTER (
             WHERE attendance_type = 'visitor'
           )::INTEGER AS visitors,
           COUNT(*) FILTER (
             WHERE attendance_type = 'child'
           )::INTEGER AS children
         FROM church_attendance
         WHERE ($1::date IS NULL OR attendance_date = $1::date)`,
        [date || null]
      );

      res.json({
        success: true,
        statistics: result.rows[0]
      });

    } catch (error) {
      console.error("Attendance statistics:", error.message);

      res.status(500).json({
        success: false,
        message: "Unable to retrieve attendance statistics."
      });
    }
  }
);


// ========================================
// CHURCH EXPENSES MANAGEMENT API
// ========================================


// ========================================
// 1. GET ALL CHURCH EXPENSES
// ========================================

app.get(
  "/api/admin/expenses",
  requireAdmin,
  async (req, res) => {
    try {
      const { category, start_date, end_date } = req.query;

      const result = await pool.query(
        `SELECT *
         FROM church_expenses
         WHERE ($1::text IS NULL OR category = $1)
           AND ($2::date IS NULL OR expense_date >= $2::date)
           AND ($3::date IS NULL OR expense_date <= $3::date)
         ORDER BY expense_date DESC, id DESC
         LIMIT 500`,
        [
          category || null,
          start_date || null,
          end_date || null
        ]
      );

      res.json({
        success: true,
        expenses: result.rows
      });

    } catch (error) {
      console.error("Fetch expenses:", error.message);

      res.status(500).json({
        success: false,
        message: "Unable to retrieve expenses."
      });
    }
  }
);


// ========================================
// 2. ADD NEW CHURCH EXPENSE
// ========================================

app.post(
  "/api/admin/expenses",
  requireAdmin,
  requireAdminOrigin,
  async (req, res) => {
    try {
      const {
        expense_title,
        category,
        amount,
        payment_method,
        description,
        expense_date
      } = req.body;

      if (!expense_title?.trim() || !category?.trim() || amount === undefined) {
        return res.status(400).json({
          success: false,
          message: "Expense title, category and amount are required."
        });
      }

      const expenseAmount = Number(amount);

      if (!Number.isFinite(expenseAmount) || expenseAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid expense amount greater than zero."
        });
      }

      if (expenseAmount > 9999999999.99) {
        return res.status(400).json({
          success: false,
          message: "Expense amount is too large."
        });
      }

      const date = expense_date || new Date().toISOString().slice(0, 10);

      const parsedDate = new Date(`${date}T00:00:00Z`);

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== date
      ) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid expense date."
        });
      }

      const result = await pool.query(
        `INSERT INTO church_expenses (
          expense_title,
          category,
          amount,
          payment_method,
          description,
          expense_date
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          expense_title.trim(),
          category.trim(),
          expenseAmount,
          payment_method || "Cash",
          description || "",
          date
        ]
      );

      res.status(201).json({
        success: true,
        message: "Church expense recorded successfully.",
        expense: result.rows[0]
      });

    } catch (error) {
      console.error("Add expense:", error.message);

      res.status(500).json({
        success: false,
        message: "Unable to record expense."
      });
    }
  }
);


// ========================================
// 3. UPDATE CHURCH EXPENSE
// ========================================

app.put(
  "/api/admin/expenses/:id",
  requireAdmin,
  requireAdminOrigin,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid expense ID."
        });
      }

      const {
        expense_title,
        category,
        amount,
        payment_method,
        description,
        expense_date
      } = req.body;

      const expenseAmount = Number(amount);

      if (
        !expense_title?.trim() ||
        !category?.trim() ||
        !Number.isFinite(expenseAmount) ||
        expenseAmount <= 0 ||
        expenseAmount > 9999999999.99
      ) {
        return res.status(400).json({
          success: false,
          message: "Provide a valid title, category and amount."
        });
      }

      const parsedDate = new Date(`${expense_date}T00:00:00Z`);

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(expense_date || "") ||
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== expense_date
      ) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid expense date."
        });
      }

      const result = await pool.query(
        `UPDATE church_expenses
         SET expense_title = $1,
             category = $2,
             amount = $3,
             payment_method = $4,
             description = $5,
             expense_date = $6
         WHERE id = $7
         RETURNING *`,
        [
          expense_title.trim(),
          category.trim(),
          expenseAmount,
          payment_method || "Cash",
          description || "",
          expense_date,
          id
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Expense record not found."
        });
      }

      res.json({
        success: true,
        message: "Expense updated successfully.",
        expense: result.rows[0]
      });

    } catch (error) {
      console.error("Update expense:", error.message);

      res.status(500).json({
        success: false,
        message: "Unable to update expense."
      });
    }
  }
);


// ========================================
// 4. DELETE CHURCH EXPENSE
// ========================================

app.delete(
  "/api/admin/expenses/:id",
  requireAdmin,
  requireAdminOrigin,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid expense ID."
        });
      }

      const result = await pool.query(
        `DELETE FROM church_expenses
         WHERE id = $1
         RETURNING id`,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Expense record not found."
        });
      }

      res.json({
        success: true,
        message: "Expense deleted successfully."
      });

    } catch (error) {
      console.error("Delete expense:", error.message);

      res.status(500).json({
        success: false,
        message: "Unable to delete expense."
      });
    }
  }
);


// ========================================
// 5. EXPENSE STATISTICS
// ========================================

app.get(
  "/api/admin/expenses/stats",
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           COUNT(*)::INTEGER AS total_records,
           COALESCE(SUM(amount), 0) AS total_expenses,
           COALESCE(AVG(amount), 0) AS average_expense
         FROM church_expenses`
      );

      const monthly = await pool.query(
        `SELECT
           TO_CHAR(DATE_TRUNC('month', expense_date), 'YYYY-MM') AS month,
           SUM(amount) AS total
         FROM church_expenses
         WHERE expense_date >= CURRENT_DATE - INTERVAL '11 months'
         GROUP BY DATE_TRUNC('month', expense_date)
         ORDER BY DATE_TRUNC('month', expense_date)`
      );

      res.json({
        success: true,
        statistics: result.rows[0],
        monthly_expenses: monthly.rows
      });

    } catch (error) {
      console.error("Expense statistics:", error.message);

      res.status(500).json({
        success: false,
        message: "Unable to retrieve expense statistics."
      });
    }
  }
);

// ========================================
// ADMIN FINANCIAL REPORTS
// ========================================

app.get(
  "/api/admin/financial-reports",
  requireAdmin,
  async (req, res) => {
    try {
      // 1. Calculate total successful donations
      const donationsResult = await pool.query(`
        SELECT
          (SELECT COALESCE(SUM(amount), 0) FROM donations WHERE status = 'completed') +
          (SELECT COALESCE(SUM(amount_kes), 0) FROM paypal_donations WHERE status = 'completed') AS total
      `);

      // 2. Calculate total church expenses
      const expensesResult = await pool.query(`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM church_expenses
      `);

      // 3. Get monthly donations and expenses for the last 6 months
      const monthlyResult = await pool.query(`
        SELECT
          TO_CHAR(months.month_start, 'YYYY-MM') AS month,
          COALESCE(donations.total, 0) AS donations,
          COALESCE(expenses.total, 0) AS expenses
        FROM generate_series(
          DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months',
          DATE_TRUNC('month', CURRENT_DATE),
          INTERVAL '1 month'
        ) AS months(month_start)

        LEFT JOIN (
          SELECT month_start, SUM(total) AS total
          FROM (
            SELECT DATE_TRUNC('month', created_at) AS month_start, SUM(amount) AS total
            FROM donations
            WHERE status = 'completed'
            GROUP BY DATE_TRUNC('month', created_at)
            UNION ALL
            SELECT DATE_TRUNC('month', created_at) AS month_start, SUM(amount_kes) AS total
            FROM paypal_donations
            WHERE status = 'completed'
            GROUP BY DATE_TRUNC('month', created_at)
          ) donation_sources
          GROUP BY month_start
        ) donations
        ON donations.month_start = months.month_start

        LEFT JOIN (
          SELECT
            DATE_TRUNC('month', expense_date) AS month_start,
            SUM(amount) AS total
          FROM church_expenses
          GROUP BY DATE_TRUNC('month', expense_date)
        ) expenses
        ON expenses.month_start = months.month_start

        ORDER BY months.month_start ASC
      `);

      const totalDonations = Number(
        donationsResult.rows[0].total
      );

      const totalExpenses = Number(
        expensesResult.rows[0].total
      );

      return res.json({
        success: true,

        summary: {
          total_donations: totalDonations,
          total_expenses: totalExpenses,
          balance: totalDonations - totalExpenses
        },

        monthly_reports: monthlyResult.rows.map(row => ({
          month: row.month,
          donations: Number(row.donations),
          expenses: Number(row.expenses),
          balance:
            Number(row.donations) - Number(row.expenses)
        }))
      });

    } catch (error) {
      console.error(
        "Financial reports error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "Unable to generate financial reports."
      });
    }
  }
);

// ========================================
// ADMIN DASHBOARD CHURCH STATISTICS
// ========================================

app.get(
  "/api/admin/dashboard/church-statistics",
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM church_members)
            AS total_members,

          (SELECT COUNT(*) FROM church_attendance)
            AS total_attendance,

          (SELECT COUNT(*) FROM church_ministries)
            AS total_ministries,

          (SELECT COALESCE(SUM(amount), 0)
           FROM church_expenses)
            AS total_expenses
      `);

      const stats = result.rows[0];

      res.json({
        success: true,
        statistics: {
          total_members: Number(stats.total_members),
          total_attendance: Number(stats.total_attendance),
          total_ministries: Number(stats.total_ministries),
          total_expenses: Number(stats.total_expenses)
        }
      });

    } catch (error) {
      console.error("Dashboard statistics error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to load dashboard statistics."
      });
    }
  }
);

 // ========================================
 // ADMIN CHURCH MINISTRIES API
 // ========================================

 // GET ALL MINISTRIES
 app.get("/api/admin/ministries", requireAdmin, async (req, res) => {
   try {
     const result = await pool.query(`
       SELECT *
       FROM church_ministries
       ORDER BY created_at DESC
     `);

     res.json({
       success: true,
       ministries: result.rows
     });
   } catch (error) {
     console.error("Get ministries error:", error);
     res.status(500).json({
       success: false,
       message: "Failed to retrieve ministries."
     });
   }
 });

 // ADD MINISTRY
 app.post(
   "/api/admin/ministries",
   requireAdmin,
   requireAdminOrigin,
   async (req, res) => {
     try {
       const { ministry_name, description, leader_name } = req.body;

       if (
         typeof ministry_name !== "string" ||
         !ministry_name.trim()
       ) {
         return res.status(400).json({
           success: false,
           message: "Ministry name is required."
         });
       }

       const result = await pool.query(
         `
         INSERT INTO church_ministries
           (ministry_name, description, leader_name)
         VALUES ($1, $2, $3)
         RETURNING *
         `,
         [
           ministry_name.trim(),
           description || "",
           leader_name || null
         ]
       );

       res.status(201).json({
         success: true,
         message: "Ministry added successfully.",
         ministry: result.rows[0]
       });
     } catch (error) {
       console.error("Add ministry error:", error);

       res.status(error.code === "23505" ? 409 : 500).json({
         success: false,
         message: error.code === "23505"
           ? "This ministry already exists."
           : "Failed to add ministry."
       });
     }
   }
 );

 // UPDATE MINISTRY
 app.put(
   "/api/admin/ministries/:id",
   requireAdmin,
   requireAdminOrigin,
   async (req, res) => {
     try {
       const { ministry_name, description, leader_name } = req.body;

       if (
         typeof ministry_name !== "string" ||
         !ministry_name.trim()
       ) {
         return res.status(400).json({
           success: false,
           message: "Ministry name is required."
         });
       }

       const result = await pool.query(
         `
         UPDATE church_ministries
         SET
           ministry_name = $1,
           description = $2,
           leader_name = $3
         WHERE id = $4
         RETURNING *
         `,
         [
           ministry_name.trim(),
           description || "",
           leader_name || null,
           req.params.id
         ]
       );

       if (!result.rowCount) {
         return res.status(404).json({
           success: false,
           message: "Ministry not found."
         });
       }

       res.json({
         success: true,
         message: "Ministry updated successfully.",
         ministry: result.rows[0]
       });
     } catch (error) {
       console.error("Update ministry error:", error);

       res.status(error.code === "23505" ? 409 : 500).json({
         success: false,
         message: error.code === "23505"
           ? "Another ministry already has that name."
           : "Failed to update ministry."
       });
     }
   }
 );

 // DELETE MINISTRY
 app.delete(
   "/api/admin/ministries/:id",
   requireAdmin,
   requireAdminOrigin,
   async (req, res) => {
     try {
       const result = await pool.query(
         `
         DELETE FROM church_ministries
         WHERE id = $1
         RETURNING id
         `,
         [req.params.id]
       );

       if (!result.rowCount) {
         return res.status(404).json({
           success: false,
           message: "Ministry not found."
         });
       }

       res.json({
         success: true,
         message: "Ministry deleted successfully."
       });
     } catch (error) {
       console.error("Delete ministry error:", error);
       res.status(500).json({
         success: false,
         message: "Failed to delete ministry."
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
        `SELECT id, 'M-PESA' AS source, phone, NULL::text AS email,
                amount, NULL::numeric AS amount_usd, amount AS amount_kes,
                status, mpesa_receipt_number, result_desc, created_at, updated_at
         FROM donations
         UNION ALL
         SELECT id, 'PayPal' AS source, NULL::text AS phone, email,
                ROUND(amount_kes)::integer AS amount,
                amount_usd, amount_kes, status, capture_id AS mpesa_receipt_number,
                paypal_status AS result_desc, created_at, updated_at
         FROM paypal_donations
         ORDER BY created_at DESC
         LIMIT 100`
      );

      const totalResult = await pool.query(
        `SELECT
           (SELECT COALESCE(SUM(amount), 0) FROM donations WHERE status = 'completed') +
           (SELECT COALESCE(SUM(amount_kes), 0) FROM paypal_donations WHERE status = 'completed') AS total`
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
    await runMigrations(pool);
    const createdBootstrapAdmin = await ensureBootstrapSuperAdmin(pool);
    if (createdBootstrapAdmin) {
      console.log("Bootstrapped the configured owner account with a hashed password.");
    }

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
