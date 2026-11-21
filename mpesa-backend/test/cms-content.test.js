"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeLocale, validateCmsEntry, makeContentKey } = require("../cms-content");

const validEntry = {
  pageKey: "home",
  sectionKey: "hero",
  locale: "en",
  title: "A place to grow",
  body: "Join the church family.",
  imageUrl: "",
  imageAlt: "",
  displayOrder: 0,
  published: true
};

test("CMS locales normalize regional variants and reject unsupported languages", () => {
  assert.equal(normalizeLocale("SW-KE"), "sw");
  assert.equal(normalizeLocale("ar"), "ar");
  assert.equal(normalizeLocale("xx"), null);
  assert.equal(normalizeLocale(42), "en");
});

test("CMS accepts supported plain-text sections and stable content keys", () => {
  const result = validateCmsEntry({ ...validEntry, locale: "fr-FR", body: "<script>alert(1)</script>" });
  assert.equal(result.error, undefined);
  assert.equal(result.value.locale, "fr");
  assert.match(makeContentKey(result.value), /^cms_[a-f0-9]{40}$/);
  assert.equal(makeContentKey(result.value), makeContentKey(result.value));
});

test("CMS rejects invalid identifiers, unsupported locale, and empty content", () => {
  assert.match(validateCmsEntry({ ...validEntry, pageKey: "../admin" }).error, /page key/i);
  assert.match(validateCmsEntry({ ...validEntry, sectionKey: "no spaces" }).error, /section key/i);
  assert.match(validateCmsEntry({ ...validEntry, locale: "xx" }).error, /languages/i);
  assert.match(validateCmsEntry({ ...validEntry, title: " ", body: " " }).error, /title or body/i);
});

test("CMS rejects unsafe image URLs and out-of-range display order", () => {
  assert.match(validateCmsEntry({ ...validEntry, imageUrl: "javascript:alert(1)", imageAlt: "Unsafe image" }).error, /HTTPS/i);
  assert.match(validateCmsEntry({ ...validEntry, imageUrl: "https://user:pass@example.com/a.jpg", imageAlt: "Image with credentials" }).error, /credentials/i);
  assert.match(validateCmsEntry({ ...validEntry, displayOrder: -1 }).error, /display order/i);
  assert.match(validateCmsEntry({ ...validEntry, displayOrder: 1.5 }).error, /display order/i);
});

test("CMS requires descriptive alternative text for HTTPS images", () => {
  assert.match(validateCmsEntry({ ...validEntry, imageUrl: "https://example.org/church.jpg" }).error, /alternative text/i);
  const withAlt = validateCmsEntry({
    ...validEntry,
    imageUrl: "https://example.org/church.jpg",
    imageAlt: "Church members gathering outdoors"
  });
  assert.equal(withAlt.error, undefined);
  assert.equal(withAlt.value.imageAlt, "Church members gathering outdoors");
  assert.match(validateCmsEntry({
    ...validEntry,
    imageUrl: "https://example.org/church.jpg",
    imageAlt: "x".repeat(251)
  }).error, /alternative text/i);
});

test("CMS enforces copy and image size limits and explicit publication state", () => {
  assert.match(validateCmsEntry({ ...validEntry, body: "x".repeat(10001) }).error, /10,000/i);
  assert.match(validateCmsEntry({ ...validEntry, imageUrl: `https://example.com/${"x".repeat(2000)}`, imageAlt: "An intentionally oversized URL" }).error, /too long/i);
  assert.match(validateCmsEntry({ ...validEntry, published: "true" }).error, /publish/i);
});
