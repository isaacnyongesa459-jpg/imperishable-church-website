"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { runMigrations } = require("../migrate");

class FakeClient {
  constructor() {
    this.applied = new Set();
    this.roleSeedRuns = 0;
    this.commits = 0;
    this.rollbacks = 0;
    this.releases = 0;
  }

  async query(sql, values = []) {
    const text = String(sql).trim();
    if (text.startsWith("SELECT 1 FROM schema_migrations")) {
      return { rowCount: this.applied.has(values[0]) ? 1 : 0, rows: [] };
    }
    if (text.startsWith("INSERT INTO schema_migrations")) {
      this.applied.add(values[0]);
      return { rowCount: 1, rows: [] };
    }
    if (text === "COMMIT") this.commits += 1;
    if (text === "ROLLBACK") this.rollbacks += 1;
    if (text.includes("INSERT INTO admin_roles")) this.roleSeedRuns += 1;
    return { rowCount: 0, rows: [] };
  }

  release() { this.releases += 1; }
}

test("migration runner discovers and applies each checked-in migration once", async () => {
  const client = new FakeClient();
  const pool = { connect: async () => client };
  await runMigrations(pool);
  await runMigrations(pool);
  assert.deepEqual([...client.applied], ["001_admin_role_access.sql"]);
  assert.equal(client.roleSeedRuns, 1);
  assert.equal(client.commits, 1);
  assert.equal(client.rollbacks, 0);
  assert.equal(client.releases, 2);
});
