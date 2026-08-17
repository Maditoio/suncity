import { ensureDb } from "./db";
import { dayBounds, userKey } from "./format";
import { parseLockEvent } from "./parse";
import { getSettings } from "./settings";
import type { AccessEvent, AlertRow, ParsedLockEvent, UserDayStat, WebhookLog } from "./types";

type EventRow = {
  id: number;
  source: "webhook" | "api";
  lock_id: string | null;
  lock_name: string | null;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  action: AccessEvent["action"];
  occurred_at: string;
  raw_json: string;
  created_at: string;
  external_id: string | null;
};

function mapEvent(row: EventRow): AccessEvent {
  return {
    id: Number(row.id),
    source: row.source,
    lockId: row.lock_id,
    lockName: row.lock_name,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    action: row.action,
    occurredAt: row.occurred_at,
    rawJson: row.raw_json,
    createdAt: row.created_at,
    externalId: row.external_id,
  };
}

export async function insertAccessEvent(input: {
  source: "webhook" | "api";
  parsed: ParsedLockEvent;
  raw: unknown;
}) {
  const sql = await ensureDb();
  const createdAt = new Date().toISOString();
  try {
    const rows = await sql<{ id: number }[]>`
      INSERT INTO access_events (
        source, lock_id, lock_name, user_id, user_name, user_email,
        action, occurred_at, raw_json, created_at, external_id
      ) VALUES (
        ${input.source},
        ${input.parsed.lockId},
        ${input.parsed.lockName},
        ${input.parsed.userId},
        ${input.parsed.userName},
        ${input.parsed.userEmail},
        ${input.parsed.action},
        ${input.parsed.occurredAt},
        ${JSON.stringify(input.raw)},
        ${createdAt},
        ${input.parsed.externalId}
      )
      RETURNING id
    `;
    return { id: Number(rows[0]?.id || 0), inserted: true };
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    const message = error instanceof Error ? error.message : "";
    if (code === "23505" || message.toLowerCase().includes("unique")) {
      return { id: 0, inserted: false };
    }
    throw error;
  }
}

export async function listAccessEvents(limit = 200, range?: { from?: string; to?: string }) {
  const sql = await ensureDb();
  const rows =
    range?.from && range?.to
      ? await sql<EventRow[]>`
          SELECT * FROM access_events
          WHERE occurred_at >= ${range.from} AND occurred_at < ${range.to}
          ORDER BY occurred_at DESC, id DESC
          LIMIT ${limit}
        `
      : range?.from
        ? await sql<EventRow[]>`
            SELECT * FROM access_events
            WHERE occurred_at >= ${range.from}
            ORDER BY occurred_at DESC, id DESC
            LIMIT ${limit}
          `
        : range?.to
          ? await sql<EventRow[]>`
              SELECT * FROM access_events
              WHERE occurred_at < ${range.to}
              ORDER BY occurred_at DESC, id DESC
              LIMIT ${limit}
            `
          : await sql<EventRow[]>`
              SELECT * FROM access_events
              ORDER BY occurred_at DESC, id DESC
              LIMIT ${limit}
            `;
  return rows.map(mapEvent);
}

export async function todayStats(): Promise<UserDayStat[]> {
  const settings = await getSettings();
  const { start, end } = dayBounds(settings.timezone);
  const sql = await ensureDb();
  const rows = await sql<{
    user_id: string | null;
    user_name: string | null;
    user_email: string | null;
    open_count: number;
    last_open_at: string | null;
  }[]>`
    SELECT user_id, user_name, user_email, COUNT(*)::int as open_count, MAX(occurred_at) as last_open_at
    FROM access_events
    WHERE action = 'open' AND occurred_at >= ${start} AND occurred_at < ${end}
    GROUP BY COALESCE(user_id, ''), COALESCE(user_email, ''), COALESCE(user_name, ''), user_id, user_name, user_email
    ORDER BY open_count DESC, last_open_at DESC
  `;
  return rows.map((row) => ({
    userKey: userKey({ userId: row.user_id, userEmail: row.user_email, userName: row.user_name }),
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    openCount: Number(row.open_count),
    lastOpenAt: row.last_open_at,
  }));
}

export async function latestLockSnapshot() {
  const sql = await ensureDb();
  const rows = await sql<{ action: string; occurred_at: string; lock_name: string | null; lock_id: string | null }[]>`
    SELECT action, occurred_at, lock_name, lock_id FROM access_events
    WHERE action IN ('open', 'close')
    ORDER BY occurred_at DESC, id DESC
    LIMIT 1
  `;
  const row = rows[0];
  return row
    ? {
        open: row.action === "open",
        occurredAt: row.occurred_at,
        lockName: row.lock_name,
        lockId: row.lock_id,
      }
    : null;
}

export async function logWebhook(input: {
  method: string;
  headers: Record<string, string>;
  body: string;
  parsedOk: boolean;
  note?: string;
}) {
  const sql = await ensureDb();
  await sql`
    INSERT INTO webhook_logs (received_at, method, headers, body, parsed_ok, note)
    VALUES (
      ${new Date().toISOString()},
      ${input.method},
      ${JSON.stringify(input.headers)},
      ${input.body},
      ${input.parsedOk},
      ${input.note ?? null}
    )
  `;
}

export async function listWebhookLogs(limit = 50): Promise<WebhookLog[]> {
  const sql = await ensureDb();
  const rows = await sql<{
    id: number;
    received_at: string;
    method: string;
    headers: string;
    body: string;
    parsed_ok: boolean;
    note: string | null;
  }[]>`SELECT * FROM webhook_logs ORDER BY id DESC LIMIT ${limit}`;
  return rows.map((row) => ({
    id: Number(row.id),
    receivedAt: row.received_at,
    method: row.method,
    headers: row.headers,
    body: row.body,
    parsedOk: Boolean(row.parsed_ok),
    note: row.note,
  }));
}

export async function evaluateAlerts(parsed: ParsedLockEvent) {
  if (parsed.action !== "open") return [];
  const settings = await getSettings();
  const sql = await ensureDb();
  const key = userKey(parsed);
  const occurred = new Date(parsed.occurredAt);
  const windowStart = new Date(occurred.getTime() - settings.windowMinutes * 60 * 1000).toISOString();
  const created: AlertRow[] = [];

  const burstRows = await sql<{ n: number }[]>`
    SELECT COUNT(*)::int as n FROM access_events
    WHERE action = 'open'
      AND occurred_at >= ${windowStart} AND occurred_at <= ${parsed.occurredAt}
      AND COALESCE(user_id, user_email, user_name, 'unknown') = ${key}
  `;
  const burstCount = Number(burstRows[0]?.n || 0);

  if (burstCount > settings.maxUsers) {
    const recent = await sql<{ id: number }[]>`
      SELECT id FROM alerts
      WHERE kind = 'burst'
        AND COALESCE(user_id, user_email, user_name, 'unknown') = ${key}
        AND occurred_at >= ${windowStart}
      ORDER BY id DESC LIMIT 1
    `;
    if (!recent[0]) {
      created.push(
        await insertAlert({
          parsed,
          kind: "burst",
          openCount: burstCount,
          windowMinutes: settings.windowMinutes,
          threshold: settings.maxUsers,
          message: `${displayLabel(parsed)} opened the lock ${burstCount} times in ${settings.windowMinutes} minutes (limit ${settings.maxUsers}).`,
        }),
      );
    }
  }

  if (settings.alertOnDaily) {
    const { start } = dayBounds(settings.timezone, occurred);
    const dailyRows = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int as n FROM access_events
      WHERE action = 'open'
        AND occurred_at >= ${start} AND occurred_at <= ${parsed.occurredAt}
        AND COALESCE(user_id, user_email, user_name, 'unknown') = ${key}
    `;
    const dailyCount = Number(dailyRows[0]?.n || 0);
    if (dailyCount > settings.maxUsers) {
      const recent = await sql<{ id: number }[]>`
        SELECT id FROM alerts
        WHERE kind = 'daily'
          AND COALESCE(user_id, user_email, user_name, 'unknown') = ${key}
          AND occurred_at >= ${start}
      `;
      if (!recent[0]) {
        created.push(
          await insertAlert({
            parsed,
            kind: "daily",
            openCount: dailyCount,
            windowMinutes: 24 * 60,
            threshold: settings.maxUsers,
            message: `${displayLabel(parsed)} opened the lock ${dailyCount} times today (limit ${settings.maxUsers}).`,
          }),
        );
      }
    }
  }

  return created;
}

function displayLabel(parsed: ParsedLockEvent) {
  return parsed.userName || parsed.userEmail || (parsed.userId ? `User ${parsed.userId}` : "Unknown user");
}

async function insertAlert(input: {
  parsed: ParsedLockEvent;
  kind: "burst" | "daily";
  openCount: number;
  windowMinutes: number;
  threshold: number;
  message: string;
}): Promise<AlertRow> {
  const sql = await ensureDb();
  const createdAt = new Date().toISOString();
  const rows = await sql<{ id: number }[]>`
    INSERT INTO alerts (
      user_id, user_name, user_email, kind, open_count, window_minutes,
      threshold, message, occurred_at, created_at
    ) VALUES (
      ${input.parsed.userId},
      ${input.parsed.userName},
      ${input.parsed.userEmail},
      ${input.kind},
      ${input.openCount},
      ${input.windowMinutes},
      ${input.threshold},
      ${input.message},
      ${input.parsed.occurredAt},
      ${createdAt}
    )
    RETURNING id
  `;
  return {
    id: Number(rows[0]?.id || 0),
    userId: input.parsed.userId,
    userName: input.parsed.userName,
    userEmail: input.parsed.userEmail,
    kind: input.kind,
    openCount: input.openCount,
    windowMinutes: input.windowMinutes,
    threshold: input.threshold,
    message: input.message,
    occurredAt: input.parsed.occurredAt,
    acknowledgedAt: null,
    createdAt,
  };
}

export async function listAlerts(limit = 100): Promise<AlertRow[]> {
  const sql = await ensureDb();
  const rows = await sql<{
    id: number;
    user_id: string | null;
    user_name: string | null;
    user_email: string | null;
    kind: "burst" | "daily";
    open_count: number;
    window_minutes: number;
    threshold: number;
    message: string;
    occurred_at: string;
    acknowledged_at: string | null;
    created_at: string;
  }[]>`SELECT * FROM alerts ORDER BY occurred_at DESC, id DESC LIMIT ${limit}`;
  return rows.map((row) => ({
    id: Number(row.id),
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    kind: row.kind,
    openCount: Number(row.open_count),
    windowMinutes: Number(row.window_minutes),
    threshold: Number(row.threshold),
    message: row.message,
    occurredAt: row.occurred_at,
    acknowledgedAt: row.acknowledged_at,
    createdAt: row.created_at,
  }));
}

export async function acknowledgeAlert(id: number) {
  const sql = await ensureDb();
  await sql`
    UPDATE alerts SET acknowledged_at = ${new Date().toISOString()}
    WHERE id = ${id} AND acknowledged_at IS NULL
  `;
}

export async function ingestRecords(source: "webhook" | "api", records: unknown[]) {
  let inserted = 0;
  let alerts = 0;
  for (const record of records) {
    const parsed = parseLockEvent(record);
    if (!parsed) continue;
    const result = await insertAccessEvent({ source, parsed, raw: record });
    if (!result.inserted) continue;
    inserted += 1;
    alerts += (await evaluateAlerts(parsed)).length;
  }
  return { inserted, alerts };
}
