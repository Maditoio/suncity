import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { ensureDb, hashAdminPassword, newSalt } from "./db";

const COOKIE = "lockwatch_session";
const MAX_AGE = 60 * 60 * 24 * 14;
const MIN_PASSWORD_LENGTH = 8;
const DUMMY_SALT = "0".repeat(32);
const DUMMY_HASH = hashAdminPassword("lockwatch-dummy-password", DUMMY_SALT);

export type AdminSession = {
  id: number;
  username: string;
};

type AdminRow = {
  id: number;
  username: string;
  username_key: string;
  password_hash: string;
  password_salt: string;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function usernameKey(username: string) {
  return username.trim().toLowerCase();
}

export function verifyPassword(password: string, hash: string, salt: string) {
  try {
    const next = scryptSync(password, salt, 32);
    const prev = Buffer.from(hash, "hex");
    if (next.length !== prev.length) return false;
    return timingSafeEqual(next, prev);
  } catch {
    return false;
  }
}

async function findAdminByUsername(username: string) {
  const sql = await ensureDb();
  const rows = await sql<AdminRow[]>`
    SELECT id, username, username_key, password_hash, password_salt
    FROM admins
    WHERE username_key = ${usernameKey(username)}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function authenticateAdmin(username: string, password: string) {
  const admin = await findAdminByUsername(username);
  const hash = admin?.password_hash || DUMMY_HASH;
  const salt = admin?.password_salt || DUMMY_SALT;
  const passwordOk = verifyPassword(password, hash, salt);
  if (!admin || !passwordOk) return null;
  return { id: Number(admin.id), username: admin.username };
}

export async function createSession(admin: { id: number; username: string }) {
  const sql = await ensureDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + MAX_AGE * 1000).toISOString();
  await sql`DELETE FROM sessions WHERE expires_at < ${new Date().toISOString()}`;
  await sql`
    INSERT INTO sessions (admin_id, token_hash, expires_at, created_at)
    VALUES (${admin.id}, ${hashToken(token)}, ${expiresAt}, ${new Date().toISOString()})
  `;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (token) {
    const sql = await ensureDb();
    await sql`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
  }
  (await cookies()).delete(COOKIE);
}

export async function getSessionUser(): Promise<AdminSession | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const sql = await ensureDb();
  const now = new Date().toISOString();
  const rows = await sql<{ id: number; username: string }[]>`
    SELECT admins.id, admins.username
    FROM sessions
    JOIN admins ON admins.id = sessions.admin_id
    WHERE sessions.token_hash = ${hashToken(token)}
      AND sessions.expires_at > ${now}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return { id: Number(row.id), username: row.username };
}

export async function requireApiUser() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function updateAdminAccount(
  adminId: number,
  patch: { username?: string; password?: string; currentPassword?: string },
) {
  const sql = await ensureDb();
  const rows = await sql<AdminRow[]>`
    SELECT id, username, username_key, password_hash, password_salt
    FROM admins WHERE id = ${adminId} LIMIT 1
  `;
  const admin = rows[0];
  if (!admin) throw new Error("Admin account not found");

  const nextUsername = patch.username?.trim();
  const nextPassword = patch.password?.trim();
  const changingLogin = Boolean(nextUsername && nextUsername !== admin.username) || Boolean(nextPassword);
  if (!changingLogin) return { id: Number(admin.id), username: admin.username };

  if (!patch.currentPassword) {
    throw new Error("Enter your current password to change the admin login");
  }
  if (!verifyPassword(patch.currentPassword, admin.password_hash, admin.password_salt)) {
    throw new Error("Current password is incorrect");
  }

  let username = admin.username;
  let username_key = admin.username_key;
  let password_hash = admin.password_hash;
  let password_salt = admin.password_salt;

  if (nextUsername && nextUsername !== admin.username) {
    if (nextUsername.length < 3) throw new Error("Username must be at least 3 characters");
    const taken = await sql<{ id: number }[]>`
      SELECT id FROM admins WHERE username_key = ${usernameKey(nextUsername)} AND id <> ${adminId} LIMIT 1
    `;
    if (taken[0]) throw new Error("That username is already in use");
    username = nextUsername;
    username_key = usernameKey(nextUsername);
  }

  if (nextPassword) {
    if (nextPassword.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    password_salt = newSalt();
    password_hash = hashAdminPassword(nextPassword, password_salt);
  }

  await sql`
    UPDATE admins SET
      username = ${username},
      username_key = ${username_key},
      password_hash = ${password_hash},
      password_salt = ${password_salt},
      updated_at = ${new Date().toISOString()}
    WHERE id = ${adminId}
  `;

  if (nextPassword) {
    const token = (await cookies()).get(COOKIE)?.value;
    if (token) {
      await sql`
        DELETE FROM sessions
        WHERE admin_id = ${adminId} AND token_hash <> ${hashToken(token)}
      `;
    } else {
      await sql`DELETE FROM sessions WHERE admin_id = ${adminId}`;
    }
  }

  return { id: adminId, username };
}
