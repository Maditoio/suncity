import { NextResponse } from "next/server";
import { acknowledgeAlert, listAlerts, revokeAlertKey } from "@/lib/store";
import { requireApiUser } from "@/lib/auth";

export async function GET() {
  const denied = await requireApiUser();
  if (denied) return denied;
  return NextResponse.json({ alerts: await listAlerts(200) });
}

export async function POST(request: Request) {
  const denied = await requireApiUser();
  if (denied) return denied;
  const body = (await request.json()) as { id?: number; revoke?: boolean };
  if (!body.id) return NextResponse.json({ error: "Missing alert id" }, { status: 400 });
  if (body.revoke) {
    try {
      const result = await revokeAlertKey(body.id);
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Could not revoke key" }, { status: 400 });
    }
  }
  await acknowledgeAlert(body.id);
  return NextResponse.json({ ok: true });
}
