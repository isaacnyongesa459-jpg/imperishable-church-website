"use strict";

const express = require("express");
const crypto = require("node:crypto");
const { Readable } = require("node:stream");

const API_BIBLE_ROOT = "https://rest.api.bible/v1";
const PUBLIC_ROOT = "https://bible-api.com";
const PUBLIC_KJV_ID = "fallback-kjv";
const API_BIBLE_KEY = process.env.API_BIBLE_KEY || "";
const CACHE_TTL_MS = 25 * 24 * 60 * 60 * 1000;
const CACHE_MAX = 180;
const cache = new Map();
const bookCache = new Map();
const audioResources = new Map();

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value, ttl = CACHE_TTL_MS) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + ttl });
}

async function requestJson(url, headers = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", ...headers },
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error(`Bible provider returned ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function bibleUrl(pathname, params = {}) {
  const url = new URL(`${API_BIBLE_ROOT}${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "")
      url.searchParams.set(key, String(value));
  }
  return url;
}

async function apiBible(pathname, params = {}) {
  if (!API_BIBLE_KEY) {
    const error = new Error(
      "API.Bible access has not been configured for this service.",
    );
    error.code = "BIBLE_PROVIDER_NOT_CONFIGURED";
    throw error;
  }
  return requestJson(bibleUrl(pathname, params), { "api-key": API_BIBLE_KEY });
}

function publicUrl(pathname) {
  return new URL(pathname, PUBLIC_ROOT);
}

function validToken(value, pattern = /^[A-Za-z0-9._-]{1,100}$/) {
  return typeof value === "string" && pattern.test(value);
}

function errorResponse(res, error) {
  if (error.code === "BIBLE_PROVIDER_NOT_CONFIGURED") {
    return res.status(503).json({
      error:
        "Licensed Bible translations and keyword search are not configured. Public-domain KJV reading remains available.",
    });
  }
  if (error.name === "AbortError") {
    return res.status(504).json({
      error: "The Bible provider took too long to respond. Please try again.",
    });
  }
  if (error.status === 404)
    return res
      .status(404)
      .json({ error: "That Bible passage or selection could not be found." });
  console.error("Bible API request failed:", error.message);
  return res.status(502).json({
    error:
      "The Bible provider is temporarily unavailable. Please try again shortly.",
  });
}

async function publicKjv(pathname) {
  return requestJson(publicUrl(pathname));
}

function isPublicKjv(id) {
  return id === PUBLIC_KJV_ID;
}

function selectTranslation(id, translations) {
  if (isPublicKjv(id))
    return {
      id,
      provider: "public-kjv",
      name: "King James Version (KJV)",
      language: "English",
      offlineAllowed: true,
    };
  if (!API_BIBLE_KEY) return null;
  return translations.find((item) => item.id === id) || null;
}

async function availableTranslations() {
  const key = "translations";
  const cached = cacheGet(key);
  if (cached) return cached;
  const results = [
    {
      id: PUBLIC_KJV_ID,
      name: "King James Version (KJV)",
      abbreviation: "KJV",
      language: "English",
      provider: "Public-domain KJV fallback",
      offlineAllowed: true,
    },
  ];
  if (API_BIBLE_KEY) {
    const [english, swahili] = await Promise.all([
      apiBible("/bibles", { language: "eng", "include-full-details": true }),
      apiBible("/bibles", { language: "swh", "include-full-details": true }),
    ]);
    const catalog = [...(english.data || []), ...(swahili.data || [])];
    const unique = new Map();
    for (const bible of catalog) {
      const language = bible.language?.id === "swh" ? "Kiswahili" : "English";
      if (!bible.id || !bible.name) continue;
      unique.set(bible.id, {
        id: bible.id,
        name: bible.name,
        abbreviation: bible.abbreviation || "",
        language,
        provider: "API.Bible",
        copyright: bible.copyright || "",
        offlineAllowed: false,
        audioAvailable:
          Array.isArray(bible.audioBibles) &&
          bible.audioBibles.some((audio) => audio.id),
        audioBibles: (bible.audioBibles || [])
          .filter((audio) => audio.id)
          .map((audio) => ({
            id: audio.id,
            name: audio.name || audio.nameLocal || "Audio Bible",
          })),
      });
    }
    results.push(...unique.values());
  }
  cacheSet(key, results, 60 * 60 * 1000);
  return results;
}

function routerFactory() {
  const router = express.Router();

  router.get("/api/bible/daily", async (_req, res) => {
    try {
      const key = `daily:${new Date().toISOString().slice(0, 10)}`;
      let data = cacheGet(key);
      if (!data) {
        data = await publicKjv("/data/kjv/random");
        cacheSet(key, data, 24 * 60 * 60 * 1000);
      }
      const verse = data.random_verse;
      if (!verse?.text || !verse?.book || !verse?.chapter || !verse?.verse)
        throw new Error("Daily verse unavailable");
      return res.json({
        verse: {
          text: verse.text,
          reference: `${verse.book} ${verse.chapter}:${verse.verse}`,
          translation: "King James Version (KJV)",
          copyright: "King James Version — public domain.",
        },
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get("/api/bible/translations", async (_req, res) => {
    try {
      res.set("Cache-Control", "public, max-age=300");
      return res.json({
        translations: await availableTranslations(),
        providerConfigured: Boolean(API_BIBLE_KEY),
      });
    } catch (error) {
      const fallback = [
        {
          id: PUBLIC_KJV_ID,
          name: "King James Version (KJV)",
          abbreviation: "KJV",
          language: "English",
          provider: "Public-domain KJV fallback",
          offlineAllowed: true,
        },
      ];
      return res.status(200).json({
        translations: fallback,
        providerConfigured: false,
        warning: "Additional Bible translations are temporarily unavailable.",
      });
    }
  });

  router.get("/api/bible/books", async (req, res) => {
    const translationId = req.query.translation;
    if (!validToken(translationId))
      return res
        .status(400)
        .json({ error: "Choose a valid Bible translation." });
    try {
      if (isPublicKjv(translationId)) {
        const key = "public-kjv-books";
        let data = bookCache.get(key);
        if (!data) {
          data = await publicKjv("/data/kjv");
          bookCache.set(key, data);
        }
        return res.json({
          books: (data.books || data.data?.books || []).map((book) => ({
            id: book.id,
            name: book.name,
            chapters: (book.chapters || []).length,
          })),
        });
      }
      const allowed = await availableTranslations();
      if (!selectTranslation(translationId, allowed))
        return res.status(400).json({
          error:
            "That translation is not available to this Bible API application.",
        });
      const key = `books:${translationId}`;
      let data = cacheGet(key);
      if (!data) {
        data = await apiBible(
          `/bibles/${encodeURIComponent(translationId)}/books`,
        );
        cacheSet(key, data, CACHE_TTL_MS);
      }
      return res.json({
        books: (data.data || []).map((book) => ({
          id: book.id,
          name: book.name,
          chapters: null,
        })),
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get("/api/bible/chapters", async (req, res) => {
    const { translation, book } = req.query;
    if (!validToken(translation) || !validToken(book))
      return res
        .status(400)
        .json({ error: "Choose a valid translation and book." });
    try {
      if (isPublicKjv(translation)) {
        const data = await publicKjv(`/data/kjv/${encodeURIComponent(book)}`);
        return res.json({
          chapters: (data.chapters || data.data?.chapters || []).map(
            (chapter) => ({
              id: String(chapter.chapter || chapter),
              number: Number(chapter.chapter || chapter),
            }),
          ),
        });
      }
      const allowed = await availableTranslations();
      if (!selectTranslation(translation, allowed))
        return res.status(400).json({
          error:
            "That translation is not available to this Bible API application.",
        });
      const key = `chapters:${translation}:${book}`;
      let data = cacheGet(key);
      if (!data) {
        data = await apiBible(
          `/bibles/${encodeURIComponent(translation)}/books/${encodeURIComponent(book)}/chapters`,
        );
        cacheSet(key, data);
      }
      return res.json({
        chapters: (data.data || [])
          .filter(
            (chapter) => !String(chapter.id).toLowerCase().endsWith(".intro"),
          )
          .map((chapter) => ({
            id: chapter.id,
            number:
              Number(String(chapter.number).replace(/[^0-9]/g, "")) || null,
            reference: chapter.reference,
          })),
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get("/api/bible/chapter", async (req, res) => {
    const { translation, book, chapter } = req.query;
    if (
      !validToken(translation) ||
      !validToken(book) ||
      !/^\d{1,3}$/.test(String(chapter || ""))
    )
      return res
        .status(400)
        .json({ error: "Choose a valid translation, book and chapter." });
    try {
      if (isPublicKjv(translation)) {
        const data = await publicKjv(
          `/data/kjv/${encodeURIComponent(book)}/${encodeURIComponent(chapter)}`,
        );
        return res.json({
          provider: "bible-api.com",
          translation: "King James Version (KJV)",
          book: data.verses?.[0]?.book_name || book,
          chapter: Number(chapter),
          reference: data.reference || `${book} ${chapter}`,
          verses: data.verses || [],
          copyright: "King James Version — public domain.",
          offlineAllowed: true,
        });
      }
      const allowed = await availableTranslations();
      const selected = selectTranslation(translation, allowed);
      if (!selected)
        return res.status(400).json({
          error:
            "That translation is not available to this Bible API application.",
        });
      const chapters = await apiBible(
        `/bibles/${encodeURIComponent(translation)}/books/${encodeURIComponent(book)}/chapters`,
      );
      const entry = (chapters.data || []).find(
        (item) =>
          Number(String(item.number).replace(/[^0-9]/g, "")) ===
          Number(chapter),
      );
      if (!entry)
        return res.status(404).json({
          error: "That chapter could not be found in this translation.",
        });
      const key = `chapter:${translation}:${entry.id}`;
      let data = cacheGet(key);
      if (!data) {
        data = await apiBible(
          `/bibles/${encodeURIComponent(translation)}/passages/${encodeURIComponent(entry.id)}`,
          {
            "content-type": "html",
            "include-titles": true,
            "include-verse-numbers": true,
            "include-verse-spans": true,
            "fums-version": 3,
          },
        );
        cacheSet(key, data);
      }
      return res.json({
        provider: "API.Bible",
        translation: selected.name,
        book: entry.reference?.replace(/\s+\d+$/, "") || entry.reference,
        chapter: Number(chapter),
        reference: data.data?.reference || entry.reference,
        content: data.data?.content || "",
        copyright: data.data?.copyright || selected.copyright || "",
        fumsToken: data.meta?.fumsToken || null,
        offlineAllowed: false,
      });
    } catch (error) {
      if (error.code === "BIBLE_PROVIDER_NOT_CONFIGURED")
        return errorResponse(res, error);
      return errorResponse(res, error);
    }
  });

  router.get("/api/bible/verse", async (req, res) => {
    const translation = req.query.translation || PUBLIC_KJV_ID;
    const reference = String(req.query.reference || "").trim();
    if (
      reference.length < 3 ||
      reference.length > 100 ||
      /[<>]/.test(reference)
    )
      return res
        .status(400)
        .json({ error: "Enter a Bible verse or passage reference." });
    try {
      if (isPublicKjv(translation)) {
        const data = await publicKjv(
          `/${encodeURIComponent(reference)}?translation=kjv`,
        );
        return res.json({
          provider: "bible-api.com",
          translation: "King James Version (KJV)",
          reference: data.reference,
          verses: data.verses || [],
          copyright: "King James Version — public domain.",
          offlineAllowed: true,
        });
      }
      return res.status(400).json({
        error:
          "Use chapter navigation for this translation. Reference search currently supports the public-domain KJV.",
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get("/api/bible/audio", async (req, res) => {
    const { translation, book, chapter } = req.query;
    if (
      !validToken(translation) ||
      !validToken(book) ||
      !/^\d{1,3}$/.test(String(chapter || ""))
    )
      return res.status(400).json({
        error: "Choose a valid translation, book and chapter for audio.",
      });
    try {
      const allowed = await availableTranslations();
      const selected = selectTranslation(translation, allowed);
      const audioBible = selected?.audioBibles?.[0];
      if (!audioBible)
        return res.status(404).json({
          error: "No audio edition licensed for this translation is available.",
        });
      const chapters = await apiBible(
        `/audio-bibles/${encodeURIComponent(audioBible.id)}/books/${encodeURIComponent(book)}/chapters`,
      );
      const chapterData = (chapters.data || []).find(
        (item) => Number(item.number) === Number(chapter),
      );
      if (!chapterData)
        return res
          .status(404)
          .json({ error: "Audio is not available for this chapter." });
      const result = await apiBible(
        `/audio-bibles/${encodeURIComponent(audioBible.id)}/chapters/${encodeURIComponent(chapterData.id)}`,
        { "fums-version": 3 },
      );
      const resourceUrl = result.data?.resourceUrl;
      if (!resourceUrl || !resourceUrl.startsWith("https://"))
        throw new Error("Audio resource unavailable");
      const token = crypto.randomBytes(24).toString("base64url");
      let providerExpiry = Number(result.data?.expiresAt);
      if (providerExpiry > 0 && providerExpiry < 1e12) providerExpiry *= 1000;
      const expiresAt = Math.min(
        providerExpiry || Date.now() + 10 * 60 * 1000,
        Date.now() + 10 * 60 * 1000,
      );
      audioResources.set(token, { resourceUrl, expiresAt });
      while (audioResources.size > 1000)
        audioResources.delete(audioResources.keys().next().value);
      for (const [key, value] of audioResources)
        if (value.expiresAt <= Date.now()) audioResources.delete(key);
      return res.json({
        streamUrl: `/api/bible/audio-stream?token=${encodeURIComponent(token)}`,
        reference: result.data?.reference || chapterData.reference,
        copyright: result.data?.copyright || "",
        fumsToken: result.meta?.fumsToken || null,
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get("/api/bible/audio-stream", async (req, res) => {
    const token = String(req.query.token || "");
    const resource = audioResources.get(token);
    if (!resource || resource.expiresAt <= Date.now())
      return res.status(404).json({
        error: "This audio link has expired. Load the chapter audio again.",
      });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const upstream = await fetch(resource.resourceUrl, {
        headers: req.get("range") ? { Range: req.get("range") } : {},
        signal: controller.signal,
      });
      if (!upstream.ok && upstream.status !== 206)
        return res
          .status(502)
          .json({ error: "The audio provider is temporarily unavailable." });
      res
        .status(upstream.status)
        .set(
          "Content-Type",
          upstream.headers.get("content-type") || "audio/mpeg",
        )
        .set("Cache-Control", "private, no-store");
      const length = upstream.headers.get("content-length");
      if (length) res.set("Content-Length", length);
      const range = upstream.headers.get("content-range");
      if (range) res.set("Content-Range", range);
      const acceptRanges = upstream.headers.get("accept-ranges");
      if (acceptRanges) res.set("Accept-Ranges", acceptRanges);
      if (!upstream.body) return res.end();
      Readable.fromWeb(upstream.body).pipe(res);
    } catch (error) {
      return errorResponse(res, error);
    } finally {
      clearTimeout(timer);
    }
  });

  router.get("/api/bible/search", async (req, res) => {
    const translation = String(req.query.translation || "");
    const query = String(req.query.q || "").trim();
    if (query.length < 2 || query.length > 100 || /[<>]/.test(query))
      return res
        .status(400)
        .json({ error: "Enter a search term between 2 and 100 characters." });
    if (isPublicKjv(translation))
      return res.status(503).json({
        error:
          "Keyword search requires the configured API.Bible provider. You can still search for a passage reference.",
      });
    try {
      const allowed = await availableTranslations();
      if (!selectTranslation(translation, allowed))
        return res
          .status(400)
          .json({ error: "Choose an available translation to search." });
      const data = await apiBible(
        `/bibles/${encodeURIComponent(translation)}/search`,
        { query, limit: 20, offset: 0, sort: "relevance", "fums-version": 3 },
      );
      return res.json({
        results: (data.data?.verses || []).map((verse) => ({
          reference: verse.reference,
          text: verse.text,
          id: verse.id,
          fumsToken: data.meta?.fumsToken || null,
        })),
        passages: (data.data?.passages || []).map((passage) => ({
          reference: passage.reference,
          content: passage.content,
          id: passage.id,
          fumsToken: data.meta?.fumsToken || null,
        })),
        total: data.data?.total || data.data?.verseCount || 0,
        query: data.data?.query || query,
        copyright: (data.data?.passages || [])[0]?.copyright || "",
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  return router;
}

module.exports = { createBibleApiRouter: routerFactory };
