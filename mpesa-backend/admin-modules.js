const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 }
});
const ROLES = ["owner", "administrator", "finance_manager", "content_manager", "pastoral_care"];
const WEEKDAYS = new Set(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
const clean = (value, limit, required = false) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (required && !text) throw Object.assign(new Error("A required field is missing."), { status: 400 });
  if (text.length > limit) throw Object.assign(new Error(`Text must be ${limit} characters or fewer.`), { status: 400 });
  return text;
};
const idOk = (value) => /^\d+$/.test(String(value)) && Number(value) > 0;
const bool = (value, fallback = false) => value === undefined ? fallback : value === true || value === "true";
const safeRoute = (fallback, handler) => async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    return await handler(req, res);
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ success: false, message: "That record already exists." });
    if (error.code === "23503") return res.status(409).json({ success: false, message: "The record is still in use." });
    console.error("Admin module request failed:", error.message);
    return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : fallback });
  }
};
const bad = (message) => Object.assign(new Error(message), { status: 400 });
const notFound = (res, message = "Record not found.") => res.status(404).json({ success: false, message });
const imageSignature = (b) => {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
};
const resourceType = (format) => ["jpg", "png", "webp"].includes(format) ? "image" : format === "pdf" ? "raw" : "video";
const cloudinaryReady = () => Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
function configureCloudinary() {
  if (!cloudinaryReady()) throw Object.assign(new Error("Secure sermon-resource uploads are not configured. Add the existing Cloudinary environment settings to the backend."), { status: 503 });
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}
function uploadResource(buffer, format, publicId) {
  configureCloudinary();
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream({
      resource_type: resourceType(format),
      type: "authenticated",
      folder: "imperishable-church/sermons",
      public_id: publicId,
      overwrite: false,
      use_filename: false
    }, (error, result) => error ? reject(error) : resolve(result)).end(buffer);
  });
}
function deleteResource(publicId, format) {
  if (!publicId || !cloudinaryReady()) return Promise.resolve();
  configureCloudinary();
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType(format), type: "authenticated" });
}
function privateResourceUrl(publicId, format) {
  configureCloudinary();
  return cloudinary.url(publicId, {
    secure: true,
    sign_url: true,
    type: "authenticated",
    resource_type: resourceType(format),
    format: format || undefined
  });
}
function fileMime(format) {
  return ({ pdf: "application/pdf", mp3: "audio/mpeg", m4a: "audio/mp4", mp4: "video/mp4", jpg: "image/jpeg", png: "image/png", webp: "image/webp" })[format] || "application/octet-stream";
}

function createAdminModulesRouter(pool, { requireAdmin, requireAdminOrigin, hashAdminPassword, verifyAdminPassword }) {
  const router = express.Router();
  const read = (path, handler) => router.get(path, requireAdmin, safeRoute("Could not load records.", handler));
  const write = (method, path, handler) => router[method](path, requireAdmin, requireAdminOrigin, safeRoute("Could not save the record.", handler));

  read("/dashboard/summary", async (req, res) => {
    const result = await pool.query(`SELECT
      (SELECT COUNT(*)::int FROM church_members) AS members,
      (SELECT COUNT(*)::int FROM church_attendance) AS attendance,
      (SELECT COUNT(*)::int FROM church_ministries) AS ministries,
      (SELECT COUNT(*)::int FROM events WHERE published=TRUE AND event_date>=NOW()) AS upcoming_events,
      (SELECT COUNT(*)::int FROM announcements WHERE published=TRUE) AS published_announcements,
      (SELECT COUNT(*)::int FROM leaders WHERE published=TRUE) AS published_leaders,
      (SELECT COUNT(*)::int FROM services WHERE published=TRUE) AS published_services,
      (SELECT COUNT(*)::int FROM church_sermons WHERE published=TRUE) AS published_sermons`);
    const summary = result.rows[0];
    const financeAccess = req.admin.modules.includes("*") || req.admin.modules.includes("finances");
    if (financeAccess) {
      const finance = await pool.query(`SELECT
        (SELECT COALESCE(SUM(amount),0) FROM donations WHERE status='completed') +
        (SELECT COALESCE(SUM(amount_kes),0) FROM paypal_donations WHERE status='completed') AS donations_kes,
        (SELECT COALESCE(SUM(amount),0) FROM church_expenses) AS expenses_kes`);
      summary.finances = finance.rows[0];
    }
    return res.json({ success: true, summary });
  });
  read("/dashboard/activity", async (_req, res) => {
    const result = await pool.query(`SELECT id,admin_username,action,details,created_at
      FROM admin_activity_logs ORDER BY created_at DESC,id DESC LIMIT 15`);
    return res.json({ success: true, activities: result.rows });
  });

  // Services are stored in the existing table and remain the source for the public schedule API.
  read("/services", async (_req, res) => {
    const result = await pool.query(`SELECT id,title,description,day_of_week,start_time,location,published,display_order FROM services ORDER BY display_order,id`);
    return res.json({ success: true, services: result.rows });
  });
  const saveService = async (req, res, update) => {
    const title = clean(req.body?.title, 150, true);
    const description = clean(req.body?.description, 3000);
    const day = clean(req.body?.day_of_week, 20, true);
    const time = clean(req.body?.start_time, 20, true);
    const location = clean(req.body?.location, 200);
    const displayOrder = Number(req.body?.display_order || 0);
    if (!WEEKDAYS.has(day) || !/^([01]?\d|2[0-3]):[0-5]\d$/.test(time) || !Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 10000) throw bad("Provide a valid service day, time, and display order.");
    const published = bool(req.body?.published);
    const result = update
      ? await pool.query(`UPDATE services SET title=$1,description=$2,day_of_week=$3,start_time=$4,location=$5,published=$6,display_order=$7 WHERE id=$8 RETURNING id,title,description,day_of_week,start_time,location,published,display_order`, [title,description,day,time,location,published,displayOrder,req.params.id])
      : await pool.query(`INSERT INTO services(title,description,day_of_week,start_time,location,published,display_order) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,title,description,day_of_week,start_time,location,published,display_order`, [title,description,day,time,location,published,displayOrder]);
    if (update && !result.rowCount) return notFound(res, "Service not found.");
    return res.status(update ? 200 : 201).json({ success: true, service: result.rows[0] });
  };
  write("post", "/services", (req, res) => saveService(req, res, false));
  write("put", "/services/:id", (req, res) => {
    if (!idOk(req.params.id)) throw bad("Invalid service ID.");
    return saveService(req, res, true);
  });
  write("delete", "/services/:id", async (req, res) => {
    if (!idOk(req.params.id)) throw bad("Invalid service ID.");
    const result = await pool.query("DELETE FROM services WHERE id=$1 RETURNING id", [req.params.id]);
    if (!result.rowCount) return notFound(res, "Service not found.");
    return res.json({ success: true });
  });

  // Leadership uses the existing table and public /api/leaders allowlist.
  read("/leaders", async (_req, res) => {
    const result = await pool.query(`SELECT id,name,title,biography,photo_url,display_order,published FROM leaders ORDER BY display_order,id`);
    return res.json({ success: true, leaders: result.rows });
  });
  const saveLeader = async (req, res, update) => {
    const name = clean(req.body?.name, 150, true);
    const title = clean(req.body?.title, 150, true);
    const biography = clean(req.body?.biography, 5000);
    const photoUrl = clean(req.body?.photo_url, 2000);
    if (photoUrl && (!/^https:\/\//i.test(photoUrl))) throw bad("Leadership photographs must use an HTTPS URL.");
    const displayOrder = Number(req.body?.display_order || 0);
    if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 10000) throw bad("Provide a valid display order.");
    const published = bool(req.body?.published);
    const result = update
      ? await pool.query(`UPDATE leaders SET name=$1,title=$2,biography=$3,photo_url=$4,display_order=$5,published=$6 WHERE id=$7 RETURNING id,name,title,biography,photo_url,display_order,published`, [name,title,biography,photoUrl,displayOrder,published,req.params.id])
      : await pool.query(`INSERT INTO leaders(name,title,biography,photo_url,display_order,published) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,title,biography,photo_url,display_order,published`, [name,title,biography,photoUrl,displayOrder,published]);
    if (update && !result.rowCount) return notFound(res, "Leadership profile not found.");
    return res.status(update ? 200 : 201).json({ success: true, leader: result.rows[0] });
  };
  write("post", "/leaders", (req, res) => saveLeader(req, res, false));
  write("put", "/leaders/:id", (req, res) => {
    if (!idOk(req.params.id)) throw bad("Invalid leadership record ID.");
    return saveLeader(req, res, true);
  });
  write("delete", "/leaders/:id", async (req, res) => {
    if (!idOk(req.params.id)) throw bad("Invalid leadership record ID.");
    const result = await pool.query("DELETE FROM leaders WHERE id=$1 RETURNING id", [req.params.id]);
    if (!result.rowCount) return notFound(res, "Leadership profile not found.");
    return res.json({ success: true });
  });

  // Sermons are a new additive content table; uploads remain private authenticated Cloudinary assets.
  read("/sermons", async (_req, res) => {
    const result = await pool.query(`SELECT id,title,speaker,scripture_reference,description,preached_at,video_url,audio_url,resource_format,resource_name,(resource_public_id IS NOT NULL) AS has_resource,published,created_at,updated_at FROM church_sermons ORDER BY preached_at DESC NULLS LAST,id DESC LIMIT 300`);
    return res.json({ success: true, sermons: result.rows });
  });
  const saveSermon = async (req, res, update) => {
    const title = clean(req.body?.title, 200, true);
    const speaker = clean(req.body?.speaker, 150);
    const scripture = clean(req.body?.scripture_reference, 200);
    const description = clean(req.body?.description, 5000);
    const date = req.body?.preached_at ? String(req.body.preached_at).slice(0, 10) : null;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw bad("Provide a valid sermon date.");
    const videoUrl = clean(req.body?.video_url, 2000);
    const audioUrl = clean(req.body?.audio_url, 2000);
    if ([videoUrl, audioUrl].some((url) => url && !/^https:\/\//i.test(url))) throw bad("Sermon media links must use HTTPS.");
    const published = bool(req.body?.published);
    const args = [title,speaker,scripture,description,date,videoUrl,audioUrl,published];
    const result = update
      ? await pool.query(`UPDATE church_sermons SET title=$1,speaker=$2,scripture_reference=$3,description=$4,preached_at=$5,video_url=$6,audio_url=$7,published=$8,updated_at=NOW() WHERE id=$9 RETURNING id,title,speaker,scripture_reference,description,preached_at,video_url,audio_url,resource_format,resource_name,(resource_public_id IS NOT NULL) AS has_resource,published,created_at,updated_at`, [...args,req.params.id])
      : await pool.query(`INSERT INTO church_sermons(title,speaker,scripture_reference,description,preached_at,video_url,audio_url,published) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,title,speaker,scripture_reference,description,preached_at,video_url,audio_url,resource_format,resource_name,(resource_public_id IS NOT NULL) AS has_resource,published,created_at,updated_at`, args);
    if (update && !result.rowCount) return notFound(res, "Sermon not found.");
    return res.status(update ? 200 : 201).json({ success: true, sermon: result.rows[0] });
  };
  write("post", "/sermons", (req, res) => saveSermon(req, res, false));
  write("put", "/sermons/:id", (req, res) => {
    if (!idOk(req.params.id)) throw bad("Invalid sermon ID.");
    return saveSermon(req, res, true);
  });
  write("delete", "/sermons/:id", async (req, res) => {
    if (!idOk(req.params.id)) throw bad("Invalid sermon ID.");
    const result = await pool.query("DELETE FROM church_sermons WHERE id=$1 RETURNING resource_public_id,resource_format", [req.params.id]);
    if (!result.rowCount) return notFound(res, "Sermon not found.");
    await deleteResource(result.rows[0].resource_public_id, result.rows[0].resource_format).catch((error) => console.error("Sermon resource cleanup failed:", error.message));
    return res.json({ success: true });
  });
  write("post", "/sermons/:id/resource", async (req, res) => {
    if (!idOk(req.params.id)) throw bad("Invalid sermon ID.");
    const parseUpload = (request, response) => new Promise((resolve, reject) => upload.single("resource")(request, response, (error) => error ? reject(error) : resolve()));
    await parseUpload(req, res);
    if (!req.file) throw bad("Choose a PDF, MP3, M4A, MP4, JPG, PNG, or WebP resource.");
    const mime = req.file.mimetype;
    let format = null;
    if (mime === "application/pdf" && req.file.buffer.subarray(0, 5).toString("ascii") === "%PDF-") format = "pdf";
    else if (mime === "audio/mpeg" && (req.file.buffer.subarray(0, 3).toString("ascii") === "ID3" || (req.file.buffer[0] === 0xff && (req.file.buffer[1] & 0xe0) === 0xe0))) format = "mp3";
    else if (mime === "audio/mp4" && req.file.buffer.includes(Buffer.from("ftyp"))) format = "m4a";
    else if (mime === "video/mp4" && req.file.buffer.includes(Buffer.from("ftyp"))) format = "mp4";
    else if (mime.startsWith("image/")) format = imageSignature(req.file.buffer);
    if (!format || (mime.startsWith("image/") && fileMime(format) !== mime)) throw bad("The uploaded file content does not match an allowed resource type.");
    const existing = await pool.query("SELECT resource_public_id,resource_format FROM church_sermons WHERE id=$1", [req.params.id]);
    if (!existing.rowCount) return notFound(res, "Sermon not found.");
    const uploaded = await uploadResource(req.file.buffer, format, `sermon-${req.params.id}-${Date.now()}`);
    const filename = String(req.file.originalname || `sermon-resource.${format}`).replace(/[\\/\r\n\"\;]/g, "_").slice(0, 180);
    try {
      await pool.query(`UPDATE church_sermons SET resource_public_id=$1,resource_format=$2,resource_name=$3,updated_at=NOW() WHERE id=$4`, [uploaded.public_id,format,filename,req.params.id]);
    } catch (error) {
      await deleteResource(uploaded.public_id, format).catch(() => {});
      throw error;
    }
    await deleteResource(existing.rows[0].resource_public_id, existing.rows[0].resource_format).catch((error) => console.error("Old sermon resource cleanup failed:", error.message));
    return res.status(201).json({ success: true, resource_name: filename, format });
  });
  read("/sermons/:id/resource", async (req, res) => {
    if (!idOk(req.params.id)) return notFound(res, "Sermon resource not found.");
    const result = await pool.query("SELECT resource_public_id,resource_format,resource_name FROM church_sermons WHERE id=$1", [req.params.id]);
    if (!result.rowCount || !result.rows[0].resource_public_id) return notFound(res, "Sermon resource not found.");
    const resource = result.rows[0];
    const upstream = await fetch(privateResourceUrl(resource.resource_public_id, resource.resource_format), { signal: AbortSignal.timeout(20000) });
    if (!upstream.ok) return res.status(502).json({ success: false, message: "Stored resource could not be retrieved." });
    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (bytes.length > 25 * 1024 * 1024) return res.status(502).json({ success: false, message: "Stored resource exceeds the allowed size." });
    res.setHeader("Content-Type", fileMime(resource.resource_format));
    res.setHeader("Content-Disposition", `attachment; filename="${(resource.resource_name || `sermon.${resource.resource_format}`).replace(/[\"\r\n]/g, "_")}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.end(bytes);
  });

  // Settings: real public About content plus private account preferences and password changes.
  // Public gallery media retains the existing URL records and adds Cloudinary uploads.
  read("/gallery", async (_req, res) => {
    const result = await pool.query(`SELECT id,title,description,image_url,published,created_at FROM church_gallery ORDER BY created_at DESC LIMIT 200`);
    return res.json({ success: true, photos: result.rows });
  });
  write("post", "/gallery", async (req, res) => {
    const parseUpload = (request, response) => new Promise((resolve, reject) => upload.single("photo")(request, response, (error) => error ? reject(error) : resolve()));
    await parseUpload(req, res);
    const title = clean(req.body?.title, 200, true);
    const description = clean(req.body?.description, 3000);
    let imageUrl = clean(req.body?.image_url, 2000);
    let publicId = null;
    if (req.file) {
      const format = imageSignature(req.file.buffer);
      const expected = ({ jpg: "image/jpeg", png: "image/png", webp: "image/webp" })[format];
      if (!format || expected !== req.file.mimetype || req.file.size > 5 * 1024 * 1024) throw bad("Choose a valid JPG, PNG, or WebP image up to 5 MB.");
      if (!cloudinaryReady()) throw Object.assign(new Error("Cloudinary image uploads are not configured."), { status: 503 });
      configureCloudinary();
      const uploaded = await new Promise((resolve, reject) => cloudinary.uploader.upload_stream({
        resource_type: "image", folder: "imperishable-church/gallery", type: "upload", secure: true
      }, (error, result) => error ? reject(error) : resolve(result)).end(req.file.buffer));
      imageUrl = uploaded.secure_url;
      publicId = uploaded.public_id;
    }
    if (!imageUrl || !/^https:\/\//i.test(imageUrl)) throw bad("Choose a JPG/PNG/WebP upload or provide a valid HTTPS image URL.");
    try {
      const result = await pool.query(`INSERT INTO church_gallery(title,description,image_url,published,cloudinary_public_id) VALUES($1,$2,$3,$4,$5) RETURNING id,title,description,image_url,published,created_at`, [title,description,imageUrl,bool(req.body?.published),publicId]);
      return res.status(201).json({ success: true, photo: result.rows[0] });
    } catch (error) {
      if (publicId) await cloudinary.uploader.destroy(publicId, { resource_type: "image" }).catch(() => {});
      throw error;
    }
  });
  write("delete", "/gallery/:id", async (req, res) => {
    if (!idOk(req.params.id)) throw bad("Invalid photo ID.");
    const result = await pool.query("DELETE FROM church_gallery WHERE id=$1 RETURNING cloudinary_public_id", [req.params.id]);
    if (!result.rowCount) return notFound(res, "Photo not found.");
    if (result.rows[0].cloudinary_public_id && cloudinaryReady()) {
      configureCloudinary();
      await cloudinary.uploader.destroy(result.rows[0].cloudinary_public_id, { resource_type: "image", type: "upload" }).catch((error) => console.error("Gallery asset cleanup failed:", error.message));
    }
    return res.json({ success: true });
  });

  // Contact messages are private and may be triaged without changing public submission behavior.
  read("/contact-messages", async (_req, res) => {
    const result = await pool.query(`SELECT id,name,email,subject,message,status,created_at FROM contact_messages ORDER BY created_at DESC LIMIT 200`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.json({ success: true, messages: result.rows });
  });
  write("patch", "/contact-messages/:id", async (req, res) => {
    if (!idOk(req.params.id)) throw bad("Invalid message ID.");
    const status = String(req.body?.status || "");
    if (!["new", "in_progress", "resolved", "archived"].includes(status)) throw bad("Choose a valid message status.");
    const result = await pool.query("UPDATE contact_messages SET status=$1 WHERE id=$2 RETURNING id,status", [status,req.params.id]);
    if (!result.rowCount) return notFound(res, "Message not found.");
    return res.json({ success: true, message: result.rows[0] });
  });

  read("/settings/about", async (_req, res) => {
    const result = await pool.query("SELECT title,body,updated_at FROM church_content WHERE content_key='about'");
    return res.json({ success: true, about: result.rows[0] || { title: "About Our Church", body: "" } });
  });
  write("put", "/settings/about", async (req, res) => {
    if (!["owner", "administrator", "content_manager"].includes(req.admin.role)) return res.status(403).json({ success: false, message: "Your role cannot edit public church information." });
    const title = clean(req.body?.title, 200, true);
    const body = clean(req.body?.body, 12000);
    const result = await pool.query(`INSERT INTO church_content(content_key,title,body) VALUES('about',$1,$2) ON CONFLICT(content_key) DO UPDATE SET title=EXCLUDED.title,body=EXCLUDED.body,updated_at=NOW() RETURNING title,body,updated_at`, [title,body]);
    return res.json({ success: true, about: result.rows[0] });
  });
  read("/settings/preferences", async (req, res) => {
    const result = await pool.query("SELECT preferences FROM admin_users WHERE id=$1", [req.admin.userId]);
    return res.json({ success: true, preferences: result.rows[0]?.preferences || {} });
  });
  write("put", "/settings/preferences", async (req, res) => {
    const p = req.body?.preferences || {};
    const preferences = {
      theme: ["system", "light", "dark"].includes(p.theme) ? p.theme : "system",
      dateFormat: ["locale", "dd/mm/yyyy", "yyyy-mm-dd"].includes(p.dateFormat) ? p.dateFormat : "locale",
      compactTables: p.compactTables === true
    };
    const result = await pool.query("UPDATE admin_users SET preferences=$1::jsonb,updated_at=NOW() WHERE id=$2 RETURNING preferences", [JSON.stringify(preferences),req.admin.userId]);
    return res.json({ success: true, preferences: result.rows[0].preferences });
  });
  write("put", "/account/password", async (req, res) => {
    const current = typeof req.body?.current_password === "string" ? req.body.current_password : "";
    const next = typeof req.body?.new_password === "string" ? req.body.new_password : "";
    if (next.length < 12 || next.length > 256 || !/[a-z]/.test(next) || !/[A-Z]/.test(next) || !/\d/.test(next)) throw bad("Use a new password of 12–256 characters with uppercase, lowercase, and numeric characters.");
    const result = await pool.query("SELECT password_hash FROM admin_users WHERE id=$1 AND active=TRUE", [req.admin.userId]);
    if (!result.rowCount || !await verifyAdminPassword(current, result.rows[0].password_hash)) return res.status(400).json({ success: false, message: "Current password is incorrect." });
    await pool.query("UPDATE admin_users SET password_hash=$1,token_version=token_version+1,updated_at=NOW() WHERE id=$2", [await hashAdminPassword(next),req.admin.userId]);
    return res.json({ success: true, message: "Password changed. Sign in again to continue." });
  });

  // Administrator accounts are returned without password hashes or secrets.
  read("/users/roles", async (_req, res) => res.json({ success: true, roles: [
    { id: "owner", label: "Owner", description: "All modules, account and settings administration." },
    { id: "administrator", label: "Administrator", description: "Church operations, excluding administrator-account management." },
    { id: "finance_manager", label: "Finance Manager", description: "Donations and financial records." },
    { id: "content_manager", label: "Content Manager", description: "Events, announcements, sermons, services, leadership, ministries and gallery." },
    { id: "pastoral_care", label: "Pastoral Care", description: "Members, attendance, messages and sponsorship records." }
  ] }));
  read("/users", async (_req, res) => {
    const result = await pool.query(`SELECT id,username,role,active,last_login_at,created_at FROM admin_users ORDER BY username`);
    return res.json({ success: true, users: result.rows });
  });
  write("post", "/users", async (req, res) => {
    const username = clean(req.body?.username, 100, true);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const role = String(req.body?.role || "");
    if (!/^[A-Za-z0-9._-]{3,100}$/.test(username)) throw bad("Usernames must be 3–100 letters, numbers, dots, underscores, or hyphens.");
    if (password.length < 12 || password.length > 256 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) throw bad("Use a password of 12–256 characters with uppercase, lowercase, and numeric characters.");
    if (!ROLES.includes(role)) throw bad("Choose a supported administrator role.");
    const result = await pool.query(`INSERT INTO admin_users(username,password_hash,role) VALUES($1,$2,$3) RETURNING id,username,role,active,created_at`, [username,await hashAdminPassword(password),role]);
    await pool.query("INSERT INTO admin_activity_logs(admin_username,action,details) VALUES($1,$2,$3)", [req.admin.username,"administrator created",`User ${username} created with role ${role}.`]);
    return res.status(201).json({ success: true, user: result.rows[0] });
  });
  write("patch", "/users/:id", async (req, res) => {
    if (!idOk(req.params.id)) throw bad("Invalid administrator ID.");
    const result = await pool.query("SELECT id,username,role,active FROM admin_users WHERE id=$1", [req.params.id]);
    if (!result.rowCount) return notFound(res, "Administrator not found.");
    const target = result.rows[0];
    const role = req.body?.role === undefined ? target.role : String(req.body.role);
    const active = req.body?.active === undefined ? target.active : req.body.active === true;
    if (!ROLES.includes(role)) throw bad("Choose a supported administrator role.");
    if (String(target.id) === String(req.admin.userId) && !active) return res.status(409).json({ success: false, message: "You cannot deactivate your own account." });
    if (target.role === "owner" && (!active || role !== "owner")) {
      const owners = await pool.query("SELECT COUNT(*)::int AS count FROM admin_users WHERE role='owner' AND active=TRUE AND id<>$1", [target.id]);
      if (Number(owners.rows[0].count) < 1) return res.status(409).json({ success: false, message: "At least one active Owner must remain." });
    }
    const updated = await pool.query("UPDATE admin_users SET role=$1,active=$2,token_version=token_version+CASE WHEN $2=FALSE THEN 1 ELSE 0 END,updated_at=NOW() WHERE id=$3 RETURNING id,username,role,active,last_login_at,created_at", [role,active,target.id]);
    await pool.query("INSERT INTO admin_activity_logs(admin_username,action,details) VALUES($1,$2,$3)", [req.admin.username,"administrator updated",`User ${target.username} set to ${role} (${active ? "active" : "inactive"}).`]);
    return res.json({ success: true, user: updated.rows[0] });
  });
  write("put", "/users/:id/password", async (req, res) => {
    if (!idOk(req.params.id)) throw bad("Invalid administrator ID.");
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (password.length < 12 || password.length > 256 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) throw bad("Use a password of 12–256 characters with uppercase, lowercase, and numeric characters.");
    const result = await pool.query("UPDATE admin_users SET password_hash=$1,token_version=token_version+1,updated_at=NOW() WHERE id=$2 AND active=TRUE RETURNING username", [await hashAdminPassword(password),req.params.id]);
    if (!result.rowCount) return notFound(res, "Active administrator not found.");
    await pool.query("INSERT INTO admin_activity_logs(admin_username,action,details) VALUES($1,$2,$3)", [req.admin.username,"administrator password reset",`Password reset for ${result.rows[0].username}.`]);
    return res.json({ success: true, message: "Password updated; that administrator must sign in again." });
  });

  return router;
}

module.exports = { createAdminModulesRouter };
