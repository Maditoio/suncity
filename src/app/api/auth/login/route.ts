import { NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/lib/auth";
import { getAuthSecrets } from "@/lib/settings";

export async function POST(request: Request) {
  const body = (await request.json()) as { username?: string; password?: string };
  const username = body.username?.trim() || "";
  const password = body.password || "";
  const secrets = await getAuthSecrets();
  const userOk = username === secrets.admin_username;
  const passOk = verifyPassword(password, secrets.admin_password_hash, secrets.admin_password_salt);
  if (!userOk || !passOk) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }
  await createSession(secrets.admin_username);
  return NextResponse.json({ ok: true });
}
