"use strict";

const crypto = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(crypto.scrypt);
const PASSWORD_HASH_PREFIX = "scrypt";
const PASSWORD_HASH_BYTES = 64;
const PASSWORD_SALT_BYTES = 16;

const ROLE_PERMISSIONS = Object.freeze({
  super_admin: Object.freeze(["*"]),
  pastor: Object.freeze([
    "content:read",
    "content:manage",
    "announcements:manage",
    "sermons:manage",
    "prayer:assigned"
  ]),
  treasurer: Object.freeze([
    "donations:read",
    "finance:manage",
    "reports:manage"
  ]),
  media_administrator: Object.freeze([
    "media:manage",
    "sermons:manage"
  ]),
  prayer_team_member: Object.freeze(["prayer:assigned"])
});

const SUPPORTED_ROLES = Object.freeze(Object.keys(ROLE_PERMISSIONS));

const ADMIN_SECTION_PERMISSIONS = Object.freeze({
  dashboard: null,
  members: null,
  attendance: null,
  expenses: "finance:manage",
  reports: "reports:manage",
  ministries: "content:manage",
  announcements: "announcements:manage",
  events: "content:manage",
  donations: "donations:read",
  messages: null,
  gallery: "media:manage"
});

const ADMIN_API_PERMISSION_RULES = Object.freeze([
  { pattern: /^\/api\/admin\/gallery(?:\/|$)/, permission: "media:manage" },
  { pattern: /^\/api\/admin\/expenses(?:\/|$)/, permission: "finance:manage" },
  { pattern: /^\/api\/admin\/financial-reports\/?$/, permission: "reports:manage" },
  { pattern: /^\/api\/admin\/ministries(?:\/|$)/, permission: "content:manage" },
  { pattern: /^\/api\/admin\/donations\/?$/, permission: "donations:read" },
  { pattern: /^\/api\/admin\/announcements(?:\/|$)/, permission: "announcements:manage" },
  { pattern: /^\/api\/admin\/events(?:\/|$)/, permission: "content:manage" }
]);

async function hashPassword(password) {
  if (typeof password !== "string" || password.length === 0) {
    throw new TypeError("Password must be a non-empty string.");
  }

  const salt = crypto.randomBytes(PASSWORD_SALT_BYTES);
  const derivedKey = await scrypt(password, salt, PASSWORD_HASH_BYTES, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024
  });

  return [
    PASSWORD_HASH_PREFIX,
    salt.toString("base64url"),
    Buffer.from(derivedKey).toString("base64url")
  ].join("$");
}

async function verifyPassword(password, encodedHash) {
  if (typeof password !== "string" || typeof encodedHash !== "string") {
    return false;
  }

  const [prefix, encodedSalt, encodedKey, extra] = encodedHash.split("$");
  if (prefix !== PASSWORD_HASH_PREFIX || !encodedSalt || !encodedKey || extra) {
    return false;
  }

  let salt;
  let expected;
  try {
    salt = Buffer.from(encodedSalt, "base64url");
    expected = Buffer.from(encodedKey, "base64url");
  } catch {
    return false;
  }
  if (salt.length !== PASSWORD_SALT_BYTES || expected.length !== PASSWORD_HASH_BYTES) {
    return false;
  }

  const actual = Buffer.from(await scrypt(password, salt, PASSWORD_HASH_BYTES, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024
  }));
  return crypto.timingSafeEqual(actual, expected);
}

function hasPermission(permissions, requestedPermission) {
  if (!Array.isArray(permissions) || typeof requestedPermission !== "string") {
    return false;
  }
  return permissions.includes("*") || permissions.includes(requestedPermission);
}

function hasAdminSectionAccess(admin, section) {
  if (!Object.prototype.hasOwnProperty.call(ADMIN_SECTION_PERMISSIONS, section)) {
    return false;
  }
  const permission = ADMIN_SECTION_PERMISSIONS[section];
  if (permission === null) {
    return Array.isArray(admin?.roles) && admin.roles.includes("super_admin");
  }
  return hasPermission(admin?.permissions, permission);
}

function permissionForAdminApi(pathname) {
  if (typeof pathname !== "string") return null;
  return ADMIN_API_PERMISSION_RULES.find(({ pattern }) => pattern.test(pathname))?.permission || null;
}

module.exports = {
  ROLE_PERMISSIONS,
  SUPPORTED_ROLES,
  ADMIN_SECTION_PERMISSIONS,
  ADMIN_API_PERMISSION_RULES,
  hashPassword,
  verifyPassword,
  hasPermission,
  hasAdminSectionAccess,
  permissionForAdminApi
};
