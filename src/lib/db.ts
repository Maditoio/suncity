import { randomBytes, scryptSync } from "node:crypto";
import postgres from "postgres";

let sql: postgres.Sql | null = null;
let ready: Promise<void> | null = null;

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 32).toString("hex");
}

export function getSql() {
  if (sql) return sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Add a PostgreSQL connection string for Vercel or local use.");
  }
  const local = url.includes("localhost") || url.includes("127.0.0.1") || url.includes("sslmode=disable");
  sql = postgres(url, {
    ssl: local ? false : "require",
    max: 1,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
  });
  return sql;
}

export async function ensureDb() {
  if (!ready) {
    ready = migrate();
  }
  await ready;
  return getSql();
}

async function migrate() {
  const db = getSql();
  await db`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      tws_host TEXT NOT NULL DEFAULT '',
      tws_user TEXT NOT NULL DEFAULT '',
      tws_pass TEXT NOT NULL DEFAULT '',
      tws_org_token TEXT NOT NULL DEFAULT '',
      tws_user_token TEXT NOT NULL DEFAULT '',
      tws_membership_id TEXT NOT NULL DEFAULT '',
      lock_id TEXT NOT NULL DEFAULT '',
      access_history_path TEXT NOT NULL DEFAULT '/locks/{lockId}/access_history',
      lock_status_path TEXT NOT NULL DEFAULT '/locks/{lockId}/status',
      sign_in_path TEXT NOT NULL DEFAULT '/users/sign_in',
      extra_headers_json TEXT NOT NULL DEFAULT '{}',
      public_app_url TEXT NOT NULL DEFAULT '',
      webhook_token TEXT NOT NULL DEFAULT '',
      max_users INTEGER NOT NULL DEFAULT 4,
      window_minutes INTEGER NOT NULL DEFAULT 10,
      alert_on_daily BOOLEAN NOT NULL DEFAULT TRUE,
      timezone TEXT NOT NULL DEFAULT 'Europe/Berlin',
      admin_username TEXT NOT NULL DEFAULT 'admin',
      admin_password_hash TEXT NOT NULL DEFAULT '',
      admin_password_salt TEXT NOT NULL DEFAULT '',
      session_secret TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      username_key TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS idx_sessions_admin ON sessions(admin_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`;
  await db`
    CREATE TABLE IF NOT EXISTS access_events (
      id SERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      lock_id TEXT,
      lock_name TEXT,
      user_id TEXT,
      user_name TEXT,
      user_email TEXT,
      action TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      raw_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      external_id TEXT
    )
  `;
  await db`CREATE UNIQUE INDEX IF NOT EXISTS idx_access_external ON access_events(source, external_id) WHERE external_id IS NOT NULL`;
  await db`CREATE INDEX IF NOT EXISTS idx_access_occurred ON access_events(occurred_at)`;
  await db`CREATE INDEX IF NOT EXISTS idx_access_user ON access_events(user_id, user_email, user_name)`;
  await db`
    CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      user_email TEXT,
      kind TEXT NOT NULL,
      open_count INTEGER NOT NULL,
      window_minutes INTEGER NOT NULL,
      threshold INTEGER NOT NULL,
      message TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      acknowledged_at TEXT,
      created_at TEXT NOT NULL
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id SERIAL PRIMARY KEY,
      received_at TEXT NOT NULL,
      method TEXT NOT NULL,
      headers TEXT NOT NULL,
      body TEXT NOT NULL,
      parsed_ok BOOLEAN NOT NULL,
      note TEXT
    )
  `;

  const existing = await db`SELECT id FROM settings WHERE id = 1`;
  if (existing.length === 0) {
    await db`
      INSERT INTO settings (
        id, public_app_url, webhook_token, updated_at
      ) VALUES (
        1,
        ${process.env.APP_PUBLIC_URL || "http://localhost:3000"},
        ${randomBytes(18).toString("hex")},
        ${new Date().toISOString()}
      )
    `;
  }

  await seedAdmin(db);
}

async function seedAdmin(db: postgres.Sql) {
  const existing = await db`SELECT id FROM admins LIMIT 1`;
  if (existing.length > 0) return;

  const fromSettings = await db<{
    admin_username: string;
    admin_password_hash: string;
    admin_password_salt: string;
  }[]>`
    SELECT admin_username, admin_password_hash, admin_password_salt
    FROM settings WHERE id = 1
  `;
  const inherited = fromSettings[0];
  const now = new Date().toISOString();

  if (inherited?.admin_password_hash && inherited.admin_password_salt) {
    const username = inherited.admin_username || "admin";
    await db`
      INSERT INTO admins (username, username_key, password_hash, password_salt, created_at, updated_at)
      VALUES (
        ${username},
        ${username.trim().toLowerCase()},
        ${inherited.admin_password_hash},
        ${inherited.admin_password_salt},
        ${now},
        ${now}
      )
    `;
    return;
  }

  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "lockwatch";
  const salt = randomBytes(16).toString("hex");
  await db`
    INSERT INTO admins (username, username_key, password_hash, password_salt, created_at, updated_at)
    VALUES (
      ${username},
      ${username.trim().toLowerCase()},
      ${hashPassword(password, salt)},
      ${salt},
      ${now},
      ${now}
    )
  `;
}

export function hashAdminPassword(password: string, salt: string) {
  return hashPassword(password, salt);
}

export function newSalt() {
  return randomBytes(16).toString("hex");
}
