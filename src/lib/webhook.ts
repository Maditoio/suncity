import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { extractHistoryRecords, isMonitoredLock, parseLockEvent } from "@/lib/parse";
import { getSettings } from "@/lib/settings";
import { evaluateIdentifiedAccess, insertAccessEvent, logWebhook } from "@/lib/store";

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

function providedToken(request: NextRequest, pathToken?: string) {
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return (
    pathToken ||
    request.nextUrl.searchParams.get("token") ||
    request.headers.get("x-webhook-token") ||
    bearer ||
    ""
  );
}

function tokenMatches(expected: string, provided: string) {
  if (!expected || !provided) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function handleLockWebhook(request: NextRequest, pathToken?: string) {
  const raw = await request.text();
  const settings = await getSettings();
  const expected = settings.webhookToken;
  const provided = providedToken(request, pathToken);

  if (!tokenMatches(expected, provided)) {
    await logWebhook({
      method: request.method,
      headers: headersObject(request),
      body: raw || "{}",
      parsedOk: false,
      note: provided ? "Rejected: webhook token did not match" : "Rejected: webhook token missing from URL",
    });
    return NextResponse.json({ error: "Invalid webhook token" }, { status: 401 });
  }

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
  const monitored = parsedEvents.filter((item) => isMonitoredLock(item.parsed, settings.lockId));
  const ignored = parsedEvents.length - monitored.length;

  await logWebhook({
    method: request.method,
    headers: headersObject(request),
    body: raw || "{}",
    parsedOk: parsedEvents.length > 0,
    note: !settings.lockId
      ? "Ignored: set Lock ID in Settings so only that access point is stored"
      : ignored && !monitored.length
        ? `Ignored: event is for lock ${parsedEvents[0]?.parsed.lockId || parsedEvents[0]?.parsed.hardwareId || "unknown"}, monitoring ${settings.lockId}`
        : monitored.length
          ? monitored
              .slice(0, 3)
              .map((item) => `${item.parsed.action} by ${item.parsed.userName || item.parsed.userEmail || item.parsed.userId || "unknown"} on ${item.parsed.lockName || item.parsed.lockId}`)
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
  for (const item of monitored) {
    const result = await insertAccessEvent({ source: "webhook", parsed: item.parsed, raw: item.record });
    if (!result.inserted) continue;
    inserted += 1;
    alerts += (await evaluateIdentifiedAccess(item.parsed)).length;
  }

  if (parsedEvents.length) {
    return NextResponse.json({
      ok: true,
      received: parsedEvents.map((item) => item.parsed),
      monitored: monitored.map((item) => item.parsed),
      ignored,
      inserted,
      alerts,
    });
  }

  return NextResponse.json({ ok: true, stored: true, parsed: false });
}
