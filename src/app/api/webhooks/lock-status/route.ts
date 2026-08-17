import { NextRequest, NextResponse } from "next/server";
import { extractHistoryRecords, parseLockEvent } from "@/lib/parse";
import { getSettings } from "@/lib/settings";
import { evaluateAlerts, insertAccessEvent, logWebhook } from "@/lib/store";

export const dynamic = "force-dynamic";

function headersObject(request: NextRequest) {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (key.toLowerCase() === "authorization") {
      headers[key] = "[redacted]";
      return;
    }
    headers[key] = value;
  });
  return headers;
}

async function tokenOk(request: NextRequest) {
  const expected = (await getSettings()).webhookToken;
  const provided = request.nextUrl.searchParams.get("token") || request.headers.get("x-webhook-token");
  return Boolean(expected) && provided === expected;
}

async function handle(request: NextRequest) {
  if (!(await tokenOk(request))) {
    return NextResponse.json({ error: "Invalid webhook token" }, { status: 401 });
  }

  const raw = await request.text();
  let payload: unknown = {};
  if (raw.trim()) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { raw };
    }
  }

  const records = extractHistoryRecords(payload);
  const parsedEvents = (records.length ? records : [payload])
    .map((record) => ({ record, parsed: parseLockEvent(record) }))
    .filter((item): item is { record: unknown; parsed: NonNullable<ReturnType<typeof parseLockEvent>> } => Boolean(item.parsed));

  await logWebhook({
    method: request.method,
    headers: headersObject(request),
    body: raw || "{}",
    parsedOk: parsedEvents.length > 0,
    note: parsedEvents.length
      ? parsedEvents
          .slice(0, 3)
          .map((item) => `${item.parsed.action} by ${item.parsed.userName || item.parsed.userEmail || item.parsed.userId || "unknown"}`)
          .join("; ")
      : "Could not parse lock event",
  });

  if (request.method === "GET") {
    return NextResponse.json({
      ok: true,
      message: "Sera4 lock status webhook is live. Send POST events to this URL.",
    });
  }

  let inserted = 0;
  let alerts = 0;
  for (const item of parsedEvents) {
    const result = await insertAccessEvent({ source: "webhook", parsed: item.parsed, raw: item.record });
    if (!result.inserted) continue;
    inserted += 1;
    alerts += (await evaluateAlerts(item.parsed)).length;
  }

  if (parsedEvents.length) {
    return NextResponse.json({
      ok: true,
      received: parsedEvents.map((item) => item.parsed),
      inserted,
      alerts,
    });
  }

  return NextResponse.json({ ok: true, stored: true, parsed: false });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

export async function PUT(request: NextRequest) {
  return handle(request);
}
