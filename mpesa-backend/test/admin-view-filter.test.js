"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { retainOnlyAdminSection } = require("../admin-view-filter");
const adminViews = require("../admin-views");

const ids = ["dashboardTop", "membersSection", "announcementsSection"];
const template = [
  '<main class="admin-main">',
  '<section id="dashboardTop"><h1>Overview</h1></section>',
  '<section id="membersSection"><h2>Private member data</h2><section><p>Nested private form</p></section></section>',
  '<section id="announcementsSection"><h2>Public announcements</h2></section>',
  '</main>'
].join("");

test("authorized admin response retains only its section and removes nested restricted markup", () => {
  const rendered = retainOnlyAdminSection(template, "announcementsSection", ids);
  assert.match(rendered, /Public announcements/);
  assert.doesNotMatch(rendered, /Overview|Private member data|Nested private form/);
});

test("admin section filtering rejects a missing or unknown selected section", () => {
  assert.throws(() => retainOnlyAdminSection(template, "financeSection", ids), /required/);
  assert.throws(() => retainOnlyAdminSection(template, "absentSection", ["absentSection"]), /does not contain/);
});

test("legacy dashboard pages sent to scoped roles omit all other registered admin sections", () => {
  const sectionIds = [
    "dashboardTop", "membersSection", "attendanceSection", "expensesSection",
    "financialReportsSection", "ministriesSection", "announcementsSection",
    "eventsSection", "donationsSection", "messagesSection", "gallerySection",
    "churchStatistics"
  ];
  const rendered = retainOnlyAdminSection(
    adminViews.dashboard,
    "announcementsSection",
    sectionIds
  );
  assert.match(rendered, /id="announcementsSection"/);
  assert.doesNotMatch(rendered, /id="totalDonations"/);
  for (const sectionId of sectionIds.filter((id) => id !== "announcementsSection" && id !== "dashboardTop")) {
    assert.doesNotMatch(rendered, new RegExp(`id=["']${sectionId}["']`));
  }
});
