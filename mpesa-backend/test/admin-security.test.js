"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ROLE_PERMISSIONS,
  SUPPORTED_ROLES,
  hashPassword,
  verifyPassword,
  hasPermission,
  hasAdminSectionAccess,
  permissionForAdminApi
} = require("../admin-security");

test("password hashes are salted, verifiable, and not reversible plaintext", async () => {
  const first = await hashPassword("test-only-password");
  const second = await hashPassword("test-only-password");
  assert.notEqual(first, second);
  assert.match(first, /^scrypt\$/);
  assert.equal(await verifyPassword("test-only-password", first), true);
  assert.equal(await verifyPassword("incorrect-password", first), false);
  assert.equal(await verifyPassword("test-only-password", "plaintext"), false);
});

test("the five requested roles exist and permissions are least-privilege by default", () => {
  assert.deepEqual(SUPPORTED_ROLES, [
    "super_admin",
    "pastor",
    "treasurer",
    "media_administrator",
    "prayer_team_member"
  ]);
  assert.equal(hasPermission(ROLE_PERMISSIONS.super_admin, "finance:manage"), true);
  assert.equal(hasPermission(ROLE_PERMISSIONS.treasurer, "finance:manage"), true);
  assert.equal(hasPermission(ROLE_PERMISSIONS.treasurer, "prayer:assigned"), false);
  assert.equal(hasPermission(ROLE_PERMISSIONS.prayer_team_member, "donations:read"), false);
  assert.equal(hasPermission(ROLE_PERMISSIONS.prayer_team_member, "prayer:assigned"), true);
  assert.equal(hasPermission(null, "prayer:assigned"), false);
});

test("existing admin sections expose only features granted to each role", () => {
  const asAdmin = (role) => ({
    roles: [role],
    permissions: ROLE_PERMISSIONS[role]
  });

  assert.equal(hasAdminSectionAccess(asAdmin("pastor"), "announcements"), true);
  assert.equal(hasAdminSectionAccess(asAdmin("pastor"), "events"), true);
  assert.equal(hasAdminSectionAccess(asAdmin("pastor"), "donations"), false);
  assert.equal(hasAdminSectionAccess(asAdmin("treasurer"), "expenses"), true);
  assert.equal(hasAdminSectionAccess(asAdmin("treasurer"), "members"), false);
  assert.equal(hasAdminSectionAccess(asAdmin("media_administrator"), "gallery"), true);
  assert.equal(hasAdminSectionAccess(asAdmin("media_administrator"), "expenses"), false);
  assert.equal(hasAdminSectionAccess(asAdmin("prayer_team_member"), "dashboard"), false);
  assert.equal(hasAdminSectionAccess(asAdmin("super_admin"), "messages"), true);
  assert.equal(hasAdminSectionAccess(asAdmin("pastor"), "unknown"), false);
});

test("existing admin APIs map to least-privilege feature permissions", () => {
  assert.equal(permissionForAdminApi("/api/admin/expenses"), "finance:manage");
  assert.equal(permissionForAdminApi("/api/admin/expenses/stats"), "finance:manage");
  assert.equal(permissionForAdminApi("/api/admin/financial-reports"), "reports:manage");
  assert.equal(permissionForAdminApi("/api/admin/donations"), "donations:read");
  assert.equal(permissionForAdminApi("/api/admin/announcements/12"), "announcements:manage");
  assert.equal(permissionForAdminApi("/api/admin/events"), "content:manage");
  assert.equal(permissionForAdminApi("/api/admin/ministries/3"), "content:manage");
  assert.equal(permissionForAdminApi("/api/admin/gallery/4/publish"), "media:manage");
  assert.equal(permissionForAdminApi("/api/admin/members"), null);
  assert.equal(permissionForAdminApi("/api/admin/contact-messages"), null);
  assert.equal(permissionForAdminApi(null), null);
});
