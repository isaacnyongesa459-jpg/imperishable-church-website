"use strict";

const crypto = require("node:crypto");

const CMS_LOCALES = Object.freeze(["en", "fr", "sw", "hi", "ar", "de", "es", "pt", "zh", "ja"]);
const CMS_LOCALE_SET = new Set(CMS_LOCALES);
const PAGE_KEY_PATTERN = /^[a-z0-9-]{1,24}$/;
const SECTION_KEY_PATTERN = /^[a-z0-9_-]{1,40}$/;

function normalizeLocale(value) {
  if (typeof value !== "string") return "en";
  const locale = value.trim().toLowerCase().split(/[-_]/, 1)[0];
  return CMS_LOCALE_SET.has(locale) ? locale : null;
}

function validateCmsEntry(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Content data is required." };
  }

  const pageKey = typeof input.pageKey === "string" ? input.pageKey.trim() : "";
  const sectionKey = typeof input.sectionKey === "string" ? input.sectionKey.trim() : "";
  const locale = normalizeLocale(input.locale);
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const imageUrl = typeof input.imageUrl === "string" ? input.imageUrl.trim() : "";
  const imageAlt = typeof input.imageAlt === "string" ? input.imageAlt.trim() : "";
  const displayOrder = input.displayOrder === undefined ? 0 : input.displayOrder;
  const published = input.published;

  if (!PAGE_KEY_PATTERN.test(pageKey)) {
    return { error: "Choose a valid page key (lowercase letters, numbers, or hyphens)." };
  }
  if (!SECTION_KEY_PATTERN.test(sectionKey)) {
    return { error: "Choose a valid section key (lowercase letters, numbers, hyphens, or underscores)." };
  }
  if (!locale) {
    return { error: "Choose one of the supported content languages." };
  }
  if (title.length > 200 || body.length > 10000) {
    return { error: "Titles are limited to 200 characters and section copy to 10,000 characters." };
  }
  if (!title && !body) {
    return { error: "Add a title or body before saving this section." };
  }
  if (typeof imageUrl !== "string" || imageUrl.length > 2000) {
    return { error: "The image URL is too long." };
  }
  if (imageAlt.length > 250 || (imageUrl && !imageAlt)) {
    return { error: "Provide image alternative text (up to 250 characters) whenever an image URL is set." };
  }
  if (imageUrl) {
    try {
      const parsed = new URL(imageUrl);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
        return { error: "Image URLs must use HTTPS and must not contain credentials." };
      }
    } catch {
      return { error: "Enter a valid HTTPS image URL." };
    }
  }
  if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 10000) {
    return { error: "Display order must be a whole number from 0 to 10,000." };
  }
  if (typeof published !== "boolean") {
    return { error: "Choose whether this section should be published." };
  }

  return {
    value: { pageKey, sectionKey, locale, title, body, imageUrl, imageAlt, displayOrder, published }
  };
}

function makeContentKey({ pageKey, sectionKey, locale }) {
  const digest = crypto
    .createHash("sha256")
    .update(`${pageKey}\u0000${sectionKey}\u0000${locale}`)
    .digest("hex")
    .slice(0, 40);
  return `cms_${digest}`;
}

function createCmsContentRouter({ pool, requirePermission, requireAdminOrigin }) {
  const express = require("express");
  const router = express.Router();

  router.get("/content/:page", async (req, res) => {
    const pageKey = typeof req.params.page === "string" ? req.params.page.trim() : "";
    const requestedLocale = normalizeLocale(req.query.lang || "en");
    if (!PAGE_KEY_PATTERN.test(pageKey) || !requestedLocale) {
      return res.status(400).json({ success: false, message: "A valid page and supported language are required." });
    }

    try {
      const result = await pool.query(
        `SELECT section_key, title, body, image_url, image_alt, display_order, locale
         FROM (
           SELECT DISTINCT ON (section_key)
                  section_key, title, body, image_url, image_alt, display_order, locale
           FROM church_content
           WHERE page_key = $1
             AND published = TRUE
             AND locale IN ($2, 'en')
           ORDER BY section_key,
                    CASE WHEN locale = $2 THEN 0 ELSE 1 END,
                    updated_at DESC
         ) AS selected_sections
         ORDER BY display_order ASC, section_key ASC`,
        [pageKey, requestedLocale]
      );
      res.setHeader("Cache-Control", "public, max-age=60");
      return res.json({ success: true, page: pageKey, locale: requestedLocale, sections: result.rows });
    } catch (error) {
      console.error("Public CMS content error:", error.message);
      return res.status(500).json({ success: false, message: "Unable to load page content." });
    }
  });

  router.get("/admin/content", requirePermission("content:manage"), async (req, res) => {
    const pageKey = req.query.page;
    if (pageKey !== undefined && (typeof pageKey !== "string" || !PAGE_KEY_PATTERN.test(pageKey))) {
      return res.status(400).json({ success: false, message: "Choose a valid page key." });
    }

    try {
      const result = await pool.query(
        `SELECT page_key, section_key, locale, title, body, image_url, image_alt,
                display_order, published, updated_at
         FROM church_content
         WHERE ($1::varchar IS NULL OR page_key = $1)
         ORDER BY page_key ASC, display_order ASC, section_key ASC, locale ASC`,
        [pageKey || null]
      );
      res.setHeader("Cache-Control", "private, no-store");
      return res.json({ success: true, items: result.rows });
    } catch (error) {
      console.error("Administrator CMS list error:", error.message);
      return res.status(500).json({ success: false, message: "Unable to load website content." });
    }
  });

  router.put("/admin/content", requireAdminOrigin, requirePermission("content:manage"), async (req, res) => {
    const validation = validateCmsEntry(req.body);
    if (validation.error) {
      return res.status(400).json({ success: false, message: validation.error });
    }

    const entry = validation.value;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const saved = await client.query(
        `INSERT INTO church_content
           (content_key, page_key, section_key, locale, title, body, image_url, image_alt,
            display_order, published, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
         ON CONFLICT (page_key, section_key, locale)
         DO UPDATE SET title = EXCLUDED.title,
                       body = EXCLUDED.body,
                       image_url = EXCLUDED.image_url,
                       image_alt = EXCLUDED.image_alt,
                       display_order = EXCLUDED.display_order,
                       published = EXCLUDED.published,
                       updated_by = EXCLUDED.updated_by,
                       updated_at = NOW()
         RETURNING page_key, section_key, locale, title, body, image_url, image_alt,
                   display_order, published, updated_at`,
        [
          makeContentKey(entry),
          entry.pageKey,
          entry.sectionKey,
          entry.locale,
          entry.title,
          entry.body,
          entry.imageUrl,
          entry.imageAlt,
          entry.displayOrder,
          entry.published,
          req.admin.id
        ]
      );
      await client.query(
        `INSERT INTO admin_activity_logs (admin_username, action, details)
         VALUES ($1, 'cms.content.saved', $2)`,
        [req.admin.username, JSON.stringify({
          page: entry.pageKey,
          section: entry.sectionKey,
          locale: entry.locale,
          published: entry.published
        })]
      );
      await client.query("COMMIT");
      res.setHeader("Cache-Control", "private, no-store");
      return res.json({ success: true, item: saved.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK");
      if (error.code === "23505") {
        return res.status(409).json({ success: false, message: "That page section already exists with an incompatible legacy key." });
      }
      console.error("Administrator CMS save error:", error.message);
      return res.status(500).json({ success: false, message: "Unable to save website content." });
    } finally {
      client.release();
    }
  });

  return router;
}

module.exports = {
  CMS_LOCALES,
  normalizeLocale,
  validateCmsEntry,
  makeContentKey,
  createCmsContentRouter
};
