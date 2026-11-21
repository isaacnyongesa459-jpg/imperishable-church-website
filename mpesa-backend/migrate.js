"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { hashPassword } = require("./admin-security");

const MIGRATIONS_DIRECTORY = path.join(__dirname, "migrations");
const MIGRATION_LOCK_ID = 731942601;

async function runMigrations(pool) {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationFiles = (await fs.readdir(MIGRATIONS_DIRECTORY))
      .filter((name) => /^\d{3,}_[-_a-z0-9]+\.sql$/i.test(name))
      .sort();

    for (const migrationName of migrationFiles) {
      const alreadyApplied = await client.query(
        "SELECT 1 FROM schema_migrations WHERE migration_name = $1",
        [migrationName]
      );
      if (alreadyApplied.rowCount) continue;

      const sql = await fs.readFile(
        path.join(MIGRATIONS_DIRECTORY, migrationName),
        "utf8"
      );
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (migration_name) VALUES ($1)",
          [migrationName]
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${migrationName} failed: ${error.message}`, {
          cause: error
        });
      }
    }
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]);
    } finally {
      client.release();
    }
  }
}

async function ensureBootstrapSuperAdmin(pool, env = process.env) {
  const username = typeof env.ADMIN_USERNAME === "string"
    ? env.ADMIN_USERNAME.trim()
    : "";
  const password = typeof env.ADMIN_PASSWORD === "string"
    ? env.ADMIN_PASSWORD
    : "";
  if (!username || !password) return false;
  if (username.length > 60 || username.includes("\u0000")) {
    throw new Error("ADMIN_USERNAME must be 1–60 characters.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let account = await client.query(
      "SELECT id FROM admin_users WHERE username = $1 FOR UPDATE",
      [username]
    );
    let created = false;
    if (!account.rowCount) {
      const passwordHash = await hashPassword(password);
      account = await client.query(
        `INSERT INTO admin_users (username, display_name, password_hash, is_bootstrap)
         VALUES ($1, $1, $2, TRUE)
         ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
         RETURNING id`,
        [username, passwordHash]
      );
      created = true;
    }

    const assignedRoles = await client.query(
      "SELECT 1 FROM admin_user_roles WHERE user_id = $1",
      [account.rows[0].id]
    );
    if (!assignedRoles.rowCount) {
      await client.query(
        `INSERT INTO admin_user_roles (user_id, role_id)
         SELECT $1, id FROM admin_roles WHERE role_key = 'super_admin'
         ON CONFLICT DO NOTHING`,
        [account.rows[0].id]
      );
    }
    await client.query("COMMIT");
    return created;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { runMigrations, ensureBootstrapSuperAdmin };
