import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getAuthSecrets } from "./settings";

const COOKIE = "lockwatch_session";
const MAX_AGE = 60 * 60 * 24 * 14;

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function verifyPassword(password: string, hash: string, salt: string) {
  const next = scryptSync(password, salt, 32);
  const prev = Buffer.from(hash, "hex");
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

export async function createSession(username: string) {
  const { session_secret } = await getAuthSecrets();
  const payload = Buffer.from(
    JSON.stringify({ u: username, e: Date.now() + MAX_AGE * 1000, n: randomBytes(8).toString("hex") }),
  ).toString("base64url");
  const token = `${payload}.${sign(payload, session_secret)}`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function getSessionUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const { session_secret, admin_username } = await getAuthSecrets();
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload, session_secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { u: string; e: number };
    if (data.e < Date.now() || data.u !== admin_username) return null;
    return data.u;
  } catch {
    return null;
  }
}

export async function requireApiUser() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
