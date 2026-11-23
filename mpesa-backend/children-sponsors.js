const crypto = require("node:crypto");
const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    callback(allowed.has(file.mimetype) ? null : new Error("Upload a JPG, PNG, or WebP image."), allowed.has(file.mimetype));
  }
});

const cleanText = (value, max, field, required = false) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (required && !text) throw Object.assign(new Error(`${field} is required.`), { status: 400 });
  if (text.length > max) throw Object.assign(new Error(`${field} must be ${max} characters or fewer.`), { status: 400 });
  return text;
};
const bool = (value, fallback = false) => value === undefined ? fallback : value === true || value === "true";
const validId = (value) => /^\d+$/.test(String(value)) && Number(value) > 0;
const sendError = (res, error, fallback = "Unable to complete the request.") => {
  if (error.code === "23503") return res.status(409).json({ success: false, message: "This record is still linked to sponsorship history." });
  if (error.code === "23505") return res.status(409).json({ success: false, message: "An active sponsorship already exists for this child." });
  console.error("Children & sponsors API error:", error.message);
  return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : fallback });
};

async function initializeChildrenSponsors(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sponsors (
      id BIGSERIAL PRIMARY KEY,
      display_name VARCHAR(120) NOT NULL,
      biography TEXT NOT NULL DEFAULT '',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      public_profile BOOLEAN NOT NULL DEFAULT FALSE,
      profile_consent BOOLEAN NOT NULL DEFAULT FALSE,
      photo_consent BOOLEAN NOT NULL DEFAULT FALSE,
      is_placeholder BOOLEAN NOT NULL DEFAULT FALSE,
      placeholder_code VARCHAR(20) UNIQUE,
      photo_public_id TEXT,
      photo_format VARCHAR(8),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sponsored_children (
      id BIGSERIAL PRIMARY KEY,
      display_name VARCHAR(80) NOT NULL,
      age SMALLINT CHECK (age IS NULL OR (age >= 0 AND age <= 18)),
      background TEXT NOT NULL DEFAULT '',
      educational_needs TEXT NOT NULL DEFAULT '',
      welfare_needs TEXT NOT NULL DEFAULT '',
      status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      public_profile BOOLEAN NOT NULL DEFAULT FALSE,
      profile_consent BOOLEAN NOT NULL DEFAULT FALSE,
      photo_consent BOOLEAN NOT NULL DEFAULT FALSE,
      photo_public_id TEXT,
      photo_format VARCHAR(8),
      registered_at DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sponsorships (
      id BIGSERIAL PRIMARY KEY,
      sponsor_id BIGINT NOT NULL REFERENCES sponsors(id) ON DELETE RESTRICT,
      child_id BIGINT NOT NULL REFERENCES sponsored_children(id) ON DELETE RESTRICT,
      status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at TIMESTAMPTZ,
      changed_by VARCHAR(100),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK ((status = 'active' AND ended_at IS NULL) OR (status = 'inactive' AND ended_at IS NOT NULL))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sponsorship_one_active_child
      ON sponsorships(child_id) WHERE status = 'active';
    CREATE INDEX IF NOT EXISTS idx_sponsorship_sponsor_status
      ON sponsorships(sponsor_id, status);
    CREATE TABLE IF NOT EXISTS sponsorship_audit_log (
      id BIGSERIAL PRIMARY KEY,
      admin_username VARCHAR(100),
      action VARCHAR(40) NOT NULL,
      sponsor_id BIGINT,
      child_id BIGINT,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    INSERT INTO sponsors (display_name, biography, active, public_profile, profile_consent, photo_consent, is_placeholder, placeholder_code)
    SELECT 'Sponsor ' || LPAD(n::text, 2, '0'), '', FALSE, FALSE, FALSE, FALSE, TRUE, 'SP-' || LPAD(n::text, 2, '0')
    FROM generate_series(1, 30) AS series(n)
    ON CONFLICT (placeholder_code) DO NOTHING
  `);
}

function imageSignature(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}
function cloudinaryReady() {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}
function configureCloudinary() {
  if (!cloudinaryReady()) throw Object.assign(new Error("Secure photo uploads are not configured. Add the Cloudinary environment settings to the backend."), { status: 503 });
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}
function signedPrivateUrl(publicId, format) {
  configureCloudinary();
  return cloudinary.url(publicId, { secure: true, sign_url: true, type: "authenticated", resource_type: "image", format: format || undefined });
}
async function pipePrivateImage(req, res, publicId, format) {
  if (!publicId) return res.sendStatus(404);
  const upstream = await fetch(signedPrivateUrl(publicId, format), { signal: AbortSignal.timeout(12000) });
  if (!upstream.ok) return res.sendStatus(upstream.status === 404 ? 404 : 502);
  res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Disposition", "inline");
  const bytes = Buffer.from(await upstream.arrayBuffer());
  if (bytes.length > 6 * 1024 * 1024) return res.sendStatus(502);
  return res.end(bytes);
}
function createChildrenSponsorsRouter(pool, { requireAdmin, requireAdminOrigin }) {
  const router = express.Router();

  router.get("/api/sponsorships", async (_req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    try {
      const [sponsors, children, links] = await Promise.all([
        pool.query(`SELECT s.id, s.display_name, s.biography, s.photo_public_id IS NOT NULL AND s.photo_consent AS has_photo,
          (SELECT COUNT(*) FROM sponsorships r JOIN sponsored_children c ON c.id=r.child_id
            WHERE r.sponsor_id=s.id AND r.status='active' AND c.status='active' AND c.public_profile=TRUE AND c.profile_consent=TRUE)::int AS children_supported
          FROM sponsors s WHERE s.active=TRUE AND s.is_placeholder=FALSE AND s.public_profile=TRUE AND s.profile_consent=TRUE
          ORDER BY s.display_name LIMIT 60`),
        pool.query(`SELECT c.id, c.display_name, c.age, c.background, c.educational_needs, c.welfare_needs, c.registered_at,
          c.photo_public_id IS NOT NULL AND c.photo_consent AS has_photo,
          CASE WHEN sponsor.display_name IS NOT NULL THEN 'sponsored' ELSE 'seeking' END AS sponsorship_status,
          CASE WHEN sponsor.display_name IS NULL THEN NULL
            WHEN sponsor.active=TRUE AND sponsor.is_placeholder=FALSE AND sponsor.public_profile=TRUE AND sponsor.profile_consent=TRUE THEN sponsor.display_name
            ELSE 'Sponsor assigned' END AS assigned_sponsor
          FROM sponsored_children c
          LEFT JOIN LATERAL (SELECT s.display_name,s.active,s.is_placeholder,s.public_profile,s.profile_consent
            FROM sponsorships r JOIN sponsors s ON s.id=r.sponsor_id
            WHERE r.child_id=c.id AND r.status='active' ORDER BY r.id DESC LIMIT 1) sponsor ON TRUE
          WHERE c.status='active' AND c.public_profile=TRUE AND c.profile_consent=TRUE ORDER BY c.registered_at DESC LIMIT 100`),
        pool.query(`SELECT r.id, s.display_name AS sponsor_name, c.display_name AS child_name,
          s.id AS sponsor_id, c.id AS child_id, (s.photo_public_id IS NOT NULL AND s.photo_consent) AS sponsor_has_photo,
          (c.photo_public_id IS NOT NULL AND c.photo_consent) AS child_has_photo
          FROM sponsorships r JOIN sponsors s ON s.id=r.sponsor_id JOIN sponsored_children c ON c.id=r.child_id
          WHERE r.status='active' AND s.active=TRUE AND s.is_placeholder=FALSE AND s.public_profile=TRUE AND s.profile_consent=TRUE
          AND c.status='active' AND c.public_profile=TRUE AND c.profile_consent=TRUE ORDER BY s.display_name, c.display_name LIMIT 200`)
      ]);
      return res.json({
        sponsors: sponsors.rows.map(({ has_photo, ...s }) => ({ ...s, photo_url: has_photo ? `/api/sponsorships/media/sponsor/${s.id}` : null })),
        children: children.rows.map(({ has_photo, ...c }) => ({ ...c, photo_url: has_photo ? `/api/sponsorships/media/child/${c.id}` : null })),
        relationships: links.rows.map(({ sponsor_has_photo, child_has_photo, ...r }) => ({
          ...r,
          sponsor_photo_url: sponsor_has_photo ? `/api/sponsorships/media/sponsor/${r.sponsor_id}` : null,
          child_photo_url: child_has_photo ? `/api/sponsorships/media/child/${r.child_id}` : null
        }))
      });
    } catch (error) { return sendError(res, error); }
  });

  router.get("/api/sponsorships/media/:type/:id", async (req, res) => {
    if (!validId(req.params.id) || !["child", "sponsor"].includes(req.params.type)) return res.sendStatus(404);
    try {
      const table = req.params.type === "child" ? "sponsored_children" : "sponsors";
      const conditions = req.params.type === "child"
        ? "status='active' AND public_profile=TRUE AND profile_consent=TRUE AND photo_consent=TRUE"
        : "active=TRUE AND is_placeholder=FALSE AND public_profile=TRUE AND profile_consent=TRUE AND photo_consent=TRUE";
      const result = await pool.query(`SELECT photo_public_id, photo_format FROM ${table} WHERE id=$1 AND ${conditions}`, [req.params.id]);
      if (!result.rowCount) return res.sendStatus(404);
      return await pipePrivateImage(req, res, result.rows[0].photo_public_id, result.rows[0].photo_format);
    } catch (error) { return sendError(res, error); }
  });

  const admin = (method, path, handler) => router[method](path, requireAdmin, handler);
  const mutate = (method, path, ...handlers) => router[method](path, requireAdmin, requireAdminOrigin, ...handlers);
  const handlePhotoUpload = (req, res, next) => upload.single("photo")(req, res, (error) => {
    if (!error) return next();
    const tooLarge = error.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : 400).json({ success: false, message: tooLarge ? "Image must be 5 MB or smaller." : error.message });
  });
  admin("get", "/api/admin/children-sponsors/overview", async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    try {
      const [stats, sponsors, children, links] = await Promise.all([
        pool.query(`SELECT
          (SELECT COUNT(*) FROM sponsors WHERE active=TRUE AND is_placeholder=FALSE)::int AS total_sponsors,
          (SELECT COUNT(*) FROM sponsored_children WHERE status='active')::int AS total_children,
          (SELECT COUNT(DISTINCT child_id) FROM sponsorships WHERE status='active')::int AS sponsored_children,
          (SELECT COUNT(*) FROM sponsored_children c WHERE c.status='active' AND NOT EXISTS (SELECT 1 FROM sponsorships r WHERE r.child_id=c.id AND r.status='active'))::int AS unsponsored_children,
          (SELECT COUNT(*) FROM sponsorships WHERE status='active')::int AS active_relationships,
          (SELECT COUNT(*) FROM sponsors WHERE is_placeholder=TRUE)::int AS placeholder_sponsors`),
        pool.query(`SELECT s.id,s.display_name,s.biography,s.active,s.public_profile,s.profile_consent,s.photo_consent,s.is_placeholder,s.placeholder_code,
          s.photo_public_id IS NOT NULL AS has_photo,(SELECT COUNT(*) FROM sponsorships r WHERE r.sponsor_id=s.id AND r.status='active')::int AS sponsored_children
          FROM sponsors s ORDER BY s.is_placeholder DESC,s.display_name,s.id`),
        pool.query(`SELECT c.id,c.display_name,c.age,c.background,c.educational_needs,c.welfare_needs,c.status,c.public_profile,c.profile_consent,c.photo_consent,c.registered_at,
          c.photo_public_id IS NOT NULL AS has_photo, s.display_name AS assigned_sponsor, s.id AS sponsor_id,
          CASE WHEN r.id IS NULL THEN 'unsponsored' ELSE r.status END AS sponsorship_status
          FROM sponsored_children c LEFT JOIN LATERAL (SELECT r.* FROM sponsorships r WHERE r.child_id=c.id AND r.status='active' ORDER BY r.id DESC LIMIT 1) r ON TRUE
          LEFT JOIN sponsors s ON s.id=r.sponsor_id ORDER BY c.status,c.display_name,c.id`),
        pool.query(`SELECT r.id,r.sponsor_id,r.child_id,r.status,r.started_at,r.ended_at,s.display_name AS sponsor_name,c.display_name AS child_name
          FROM sponsorships r JOIN sponsors s ON s.id=r.sponsor_id JOIN sponsored_children c ON c.id=r.child_id ORDER BY r.id DESC LIMIT 300`)
      ]);
      return res.json({ success: true, statistics: stats.rows[0], sponsors: sponsors.rows.map(s => ({ ...s, photo_url: s.has_photo ? `/api/admin/sponsorship-media/sponsor/${s.id}` : null })), children: children.rows.map(c => ({ ...c, photo_url: c.has_photo ? `/api/admin/sponsorship-media/child/${c.id}` : null })), relationships: links.rows });
    } catch (error) { return sendError(res, error); }
  });

  admin("get", "/api/admin/sponsorship-media/:type/:id", async (req, res) => {
    if (!validId(req.params.id) || !["child", "sponsor"].includes(req.params.type)) return res.sendStatus(404);
    try {
      const table = req.params.type === "child" ? "sponsored_children" : "sponsors";
      const result = await pool.query(`SELECT photo_public_id, photo_format FROM ${table} WHERE id=$1`, [req.params.id]);
      if (!result.rowCount) return res.sendStatus(404);
      return await pipePrivateImage(req, res, result.rows[0].photo_public_id, result.rows[0].photo_format);
    } catch (error) { return sendError(res, error); }
  });

  mutate("post", "/api/admin/sponsors", async (req, res) => {
    try {
      const displayName = cleanText(req.body?.display_name, 120, "Sponsor name", true);
      const biography = cleanText(req.body?.biography, 2000, "Biography");
      const profileConsent = bool(req.body?.profile_consent);
      const result = await pool.query(`INSERT INTO sponsors(display_name,biography,active,public_profile,profile_consent,photo_consent,is_placeholder,placeholder_code)
        VALUES($1,$2,$3,$4,$5,$6,FALSE,NULL) RETURNING id`, [displayName, biography, bool(req.body?.active, true), bool(req.body?.public_profile) && profileConsent, profileConsent, bool(req.body?.photo_consent) && profileConsent]);
      await pool.query(`INSERT INTO sponsorship_audit_log(admin_username,action,sponsor_id,details) VALUES($1,'sponsor_created',$2,$3)`, [req.admin.username, result.rows[0].id, JSON.stringify({ display_name: displayName })]);
      return res.status(201).json({ success: true, id: result.rows[0].id });
    } catch (error) { return sendError(res, error); }
  });

  mutate("put", "/api/admin/sponsors/:id", async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid sponsor ID." });
    try {
      const displayName = cleanText(req.body?.display_name, 120, "Sponsor name", true);
      const biography = cleanText(req.body?.biography, 2000, "Biography");
      const profileConsent = bool(req.body?.profile_consent);
      const active = bool(req.body?.active, true);
      const existing = await pool.query(`SELECT is_placeholder FROM sponsors WHERE id=$1`, [req.params.id]);
      if (!existing.rowCount) return res.sendStatus(404);
      if (existing.rows[0].is_placeholder && (!bool(req.body?.confirm_placeholder_conversion) || /^Sponsor\s*\d{1,2}$/i.test(displayName))) {
        throw Object.assign(new Error("To convert this placeholder, confirm the conversion and replace its generated label with the sponsor's real approved name."), { status: 400 });
      }
      const result = await pool.query(`UPDATE sponsors SET display_name=$2,biography=$3,active=$4,public_profile=$5,profile_consent=$6,photo_consent=$7,
        is_placeholder=FALSE,placeholder_code=NULL,updated_at=NOW() WHERE id=$1 RETURNING id`, [req.params.id,displayName,biography,active,bool(req.body?.public_profile)&&profileConsent,profileConsent,bool(req.body?.photo_consent)&&profileConsent]);
      if (!result.rowCount) return res.sendStatus(404);
      if (!active) await pool.query(`UPDATE sponsorships SET status='inactive',ended_at=NOW() WHERE sponsor_id=$1 AND status='active'`, [req.params.id]);
      await pool.query(`INSERT INTO sponsorship_audit_log(admin_username,action,sponsor_id,details) VALUES($1,'sponsor_updated',$2,$3)`, [req.admin.username, req.params.id, JSON.stringify({ display_name: displayName })]);
      return res.json({ success: true });
    } catch (error) { return sendError(res, error); }
  });

  mutate("delete", "/api/admin/sponsors/:id", async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid sponsor ID." });
    try {
      const result = await pool.query(`UPDATE sponsors SET active=FALSE,public_profile=FALSE,updated_at=NOW() WHERE id=$1 RETURNING id`, [req.params.id]);
      if (!result.rowCount) return res.sendStatus(404);
      await pool.query(`UPDATE sponsorships SET status='inactive',ended_at=NOW() WHERE sponsor_id=$1 AND status='active'`, [req.params.id]);
      await pool.query(`INSERT INTO sponsorship_audit_log(admin_username,action,sponsor_id,details) VALUES($1,'sponsor_deactivated',$2,'{}')`, [req.admin.username,req.params.id]);
      return res.json({ success: true, message: "Sponsor deactivated. Sponsorship history has been retained." });
    } catch (error) { return sendError(res, error); }
  });

  mutate("post", "/api/admin/children", async (req, res) => {
    try {
      const name = cleanText(req.body?.display_name, 80, "Approved display name", true);
      const age = req.body?.age === "" || req.body?.age === null || req.body?.age === undefined ? null : Number(req.body.age);
      if (age !== null && (!Number.isInteger(age) || age < 0 || age > 18)) throw Object.assign(new Error("Age must be a whole number from 0 to 18, or left blank."), { status: 400 });
      const profileConsent = bool(req.body?.profile_consent);
      const result = await pool.query(`INSERT INTO sponsored_children(display_name,age,background,educational_needs,welfare_needs,public_profile,profile_consent,photo_consent)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [name,age,cleanText(req.body?.background,1500,"Background"),cleanText(req.body?.educational_needs,1000,"Educational needs"),cleanText(req.body?.welfare_needs,1000,"Welfare needs"),bool(req.body?.public_profile)&&profileConsent,profileConsent,bool(req.body?.photo_consent)&&profileConsent]);
      await pool.query(`INSERT INTO sponsorship_audit_log(admin_username,action,child_id,details) VALUES($1,'child_registered',$2,$3)`, [req.admin.username,result.rows[0].id,JSON.stringify({display_name:name})]);
      return res.status(201).json({ success: true, id: result.rows[0].id });
    } catch (error) { return sendError(res, error); }
  });

  mutate("put", "/api/admin/children/:id", async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid child ID." });
    try {
      const name = cleanText(req.body?.display_name, 80, "Approved display name", true);
      const age = req.body?.age === "" || req.body?.age === null || req.body?.age === undefined ? null : Number(req.body.age);
      if (age !== null && (!Number.isInteger(age) || age < 0 || age > 18)) throw Object.assign(new Error("Age must be a whole number from 0 to 18, or left blank."), { status: 400 });
      const profileConsent = bool(req.body?.profile_consent);
      const status = req.body?.status === "archived" ? "archived" : "active";
      const result = await pool.query(`UPDATE sponsored_children SET display_name=$2,age=$3,background=$4,educational_needs=$5,welfare_needs=$6,
        status=$7,public_profile=$8,profile_consent=$9,photo_consent=$10,updated_at=NOW() WHERE id=$1 RETURNING id`, [req.params.id,name,age,cleanText(req.body?.background,1500,"Background"),cleanText(req.body?.educational_needs,1000,"Educational needs"),cleanText(req.body?.welfare_needs,1000,"Welfare needs"),status,bool(req.body?.public_profile)&&profileConsent,profileConsent,bool(req.body?.photo_consent)&&profileConsent]);
      if (!result.rowCount) return res.sendStatus(404);
      if (status === "archived") await pool.query(`UPDATE sponsorships SET status='inactive',ended_at=NOW() WHERE child_id=$1 AND status='active'`, [req.params.id]);
      await pool.query(`INSERT INTO sponsorship_audit_log(admin_username,action,child_id,details) VALUES($1,'child_updated',$2,$3)`, [req.admin.username,req.params.id,JSON.stringify({display_name:name})]);
      return res.json({ success: true });
    } catch (error) { return sendError(res, error); }
  });

  mutate("delete", "/api/admin/children/:id", async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid child ID." });
    try {
      const result = await pool.query(`UPDATE sponsored_children SET status='archived',public_profile=FALSE,updated_at=NOW() WHERE id=$1 RETURNING id`, [req.params.id]);
      if (!result.rowCount) return res.sendStatus(404);
      await pool.query(`UPDATE sponsorships SET status='inactive',ended_at=NOW() WHERE child_id=$1 AND status='active'`, [req.params.id]);
      await pool.query(`INSERT INTO sponsorship_audit_log(admin_username,action,child_id,details) VALUES($1,'child_archived',$2,'{}')`, [req.admin.username,req.params.id]);
      return res.json({ success: true, message: "Child record archived; sponsorship history retained." });
    } catch (error) { return sendError(res, error); }
  });

  mutate("post", "/api/admin/sponsorships", async (req, res) => {
    const sponsorId = Number(req.body?.sponsor_id);
    const childId = Number(req.body?.child_id);
    if (!validId(sponsorId) || !validId(childId)) return res.status(400).json({ success: false, message: "Select a sponsor and child." });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const child = await client.query("SELECT id,status FROM sponsored_children WHERE id=$1 FOR UPDATE", [childId]);
      const sponsor = await client.query("SELECT id,active,is_placeholder FROM sponsors WHERE id=$1 FOR UPDATE", [sponsorId]);
      if (!child.rowCount || child.rows[0].status !== "active") throw Object.assign(new Error("Child is not active."), { status: 400 });
      if (!sponsor.rowCount || !sponsor.rows[0].active || sponsor.rows[0].is_placeholder) throw Object.assign(new Error("Select an active, registered sponsor (not a placeholder)."), { status: 400 });
      await client.query("UPDATE sponsorships SET status='inactive',ended_at=NOW() WHERE child_id=$1 AND status='active'", [childId]);
      const assignment = await client.query(`INSERT INTO sponsorships(sponsor_id,child_id,status,changed_by) VALUES($1,$2,'active',$3) RETURNING id`, [sponsorId,childId,req.admin.username]);
      await client.query(`INSERT INTO sponsorship_audit_log(admin_username,action,sponsor_id,child_id,details) VALUES($1,'sponsor_assigned',$2,$3,$4)`, [req.admin.username,sponsorId,childId,JSON.stringify({ previous_history_closed: true })]);
      await client.query("COMMIT");
      return res.status(201).json({ success: true, id: assignment.rows[0].id });
    } catch (error) { await client.query("ROLLBACK"); return sendError(res,error); }
    finally { client.release(); }
  });

  mutate("delete", "/api/admin/sponsorships/:id", async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid sponsorship ID." });
    try {
      const result = await pool.query(`UPDATE sponsorships SET status='inactive',ended_at=NOW() WHERE id=$1 AND status='active' RETURNING sponsor_id,child_id`, [req.params.id]);
      if (!result.rowCount) return res.sendStatus(404);
      const row = result.rows[0];
      await pool.query(`INSERT INTO sponsorship_audit_log(admin_username,action,sponsor_id,child_id,details) VALUES($1,'sponsorship_ended',$2,$3,$4)`, [req.admin.username,row.sponsor_id,row.child_id,JSON.stringify({ sponsorship_id: req.params.id })]);
      return res.json({ success: true });
    } catch (error) { return sendError(res,error); }
  });

  mutate("post", "/api/admin/sponsorship-photos/:type/:id", handlePhotoUpload, async (req, res) => {
    if (!validId(req.params.id) || !["child", "sponsor"].includes(req.params.type)) return res.status(400).json({ success: false, message: "Invalid profile." });
    if (!req.file) return res.status(400).json({ success: false, message: "Choose a JPG, PNG, or WebP image." });
    const format = imageSignature(req.file.buffer);
    if (!format) return res.status(400).json({ success: false, message: "The selected file is not a supported image." });
    const mimeMatches = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
    if (req.file.mimetype !== mimeMatches[format]) return res.status(400).json({ success: false, message: "The image content does not match its file type." });
    try {
      configureCloudinary();
      const table = req.params.type === "child" ? "sponsored_children" : "sponsors";
      const current = await pool.query(`SELECT id,photo_public_id FROM ${table} WHERE id=$1`, [req.params.id]);
      if (!current.rowCount) return res.sendStatus(404);
      const publicId = `imperishable-sponsorship/${req.params.type}-${req.params.id}-${crypto.randomUUID()}`;
      const uploaded = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ public_id: publicId, resource_type: "image", type: "authenticated", overwrite: false, unique_filename: false, format }, (error, result) => error ? reject(error) : resolve(result));
        stream.end(req.file.buffer);
      });
      let client;
      try {
        client = await pool.connect();
        await client.query("BEGIN");
        await client.query(`UPDATE ${table} SET photo_public_id=$2,photo_format=$3,updated_at=NOW() WHERE id=$1`, [req.params.id,uploaded.public_id,format]);
        const relationKey = req.params.type === "child" ? "child_id" : "sponsor_id";
        await client.query(`INSERT INTO sponsorship_audit_log(admin_username,action,${relationKey},details) VALUES($1,'photo_replaced',$2,$3)`, [req.admin.username,req.params.id,JSON.stringify({ type: req.params.type, format })]);
        await client.query("COMMIT");
      } catch (error) {
        if (client) await client.query("ROLLBACK").catch(() => {});
        await cloudinary.uploader.destroy(uploaded.public_id,{resource_type:"image",type:"authenticated"}).catch(()=>{});
        throw error;
      } finally {
        if (client) client.release();
      }
      if (current.rows[0].photo_public_id) await cloudinary.uploader.destroy(current.rows[0].photo_public_id,{resource_type:"image",type:"authenticated"}).catch(error => console.error("Old private sponsorship image cleanup failed:",error.message));
      return res.json({ success: true, photo_url: `/api/admin/sponsorship-media/${req.params.type}/${req.params.id}` });
    } catch (error) { return sendError(res,error); }
  });

  return router;
}

module.exports = { initializeChildrenSponsors, createChildrenSponsorsRouter };
