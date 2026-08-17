import { NextResponse } from "next/server";
import { authenticateAdmin, createSession } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { username?: string; password?: string };
  const username = body.username?.trim() || "";
  const password = body.password || "";
  if (!username || !password) {
    return NextResponse.json({ error: "Enter a username and password" }, { status: 400 });
  }
  const admin = await authenticateAdmin(username, password);
  if (!admin) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }
  await createSession(admin);
  return NextResponse.json({ ok: true, username: admin.username });
}
