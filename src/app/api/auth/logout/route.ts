import { NextResponse } from "next/server";
import { clearSession, getSessionUser } from "@/lib/auth";
import { logAction } from "@/lib/audit";

export async function POST() {
  const user = await getSessionUser();
  if (user) {
    await logAction({
      actorId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      action: "signed_out",
    });
  }
  await clearSession();
  return NextResponse.json({ ok: true });
}
