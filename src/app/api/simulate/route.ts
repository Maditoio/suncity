import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { evaluateIdentifiedAccess, insertAccessEvent, logWebhook } from "@/lib/store";
import { getSettings } from "@/lib/settings";

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await request.json()) as { userName?: string; action?: "open" | "close" };
  const settings = await getSettings();
  const parsed = {
    lockId: settings.lockId || "demo-lock",
    lockName: "Monitored lock",
    userId: null,
    userName: body.userName?.trim() || "Demo user",
    userEmail: null,
    action: body.action === "close" ? ("close" as const) : ("open" as const),
    occurredAt: new Date().toISOString(),
    externalId: null,
    open: body.action !== "close",
    keyId: null,
    siteName: null,
    hardwareId: null,
  };
  const raw = { simulated: true, ...parsed };
  await insertAccessEvent({
    source: "webhook",
    parsed,
    raw,
  });
  await logWebhook({
    method: "SIMULATE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(raw),
    parsedOk: true,
    note: `${parsed.action} by ${parsed.userName}`,
  });
  const alerts = await evaluateIdentifiedAccess(parsed);
  return NextResponse.json({ ok: true, parsed, alerts });
}

