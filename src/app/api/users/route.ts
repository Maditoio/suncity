import { NextResponse } from "next/server";
import { createAppUser, deleteAppUser, getSessionUser, listAppUsers, requireAdmin } from "@/lib/auth";
import { logAction } from "@/lib/audit";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ users: await listAppUsers() });
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json()) as { username?: string; password?: string; role?: string };
  try {
    const created = await createAppUser({
      username: body.username || "",
      password: body.password || "",
      role: body.role === "admin" ? "admin" : "operator",
    });
    await logAction({
      actorId: actor.id,
      actorUsername: actor.username,
      actorRole: actor.role,
      action: "created_user",
      detail: `${created.username} (${created.role})`,
    });
    return NextResponse.json({ ok: true, user: created, users: await listAppUsers() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create user" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json()) as { id?: number };
  if (!body.id) return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  try {
    const removed = await deleteAppUser(body.id, actor.id);
    await logAction({
      actorId: actor.id,
      actorUsername: actor.username,
      actorRole: actor.role,
      action: "deleted_user",
      detail: `${removed.username} (${removed.role})`,
    });
    return NextResponse.json({ ok: true, users: await listAppUsers() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete user" }, { status: 400 });
  }
}
