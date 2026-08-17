import type { AccessAction, ParsedLockEvent } from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function str(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function pick(obj: Record<string, unknown> | null, keys: string[]): unknown {
  if (!obj) return undefined;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key];
  }
  return undefined;
}

function iso(value: unknown) {
  const raw = str(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function nestedUser(source: Record<string, unknown> | null) {
  const direct = asRecord(pick(source, ["user", "accessed_by", "accessedBy", "actor", "member", "person"]));
  const nestedData = asRecord(source?.data);
  const nestedObject = asRecord(source?.object);
  const open = asRecord(source?.open);
  return (
    direct ||
    asRecord(open?.user) ||
    asRecord(nestedObject?.user) ||
    asRecord(pick(nestedData, ["user", "accessed_by", "accessedBy", "actor"]))
  );
}

function nestedLock(source: Record<string, unknown> | null) {
  const direct = asRecord(pick(source, ["lock", "access_point", "accessPoint"]));
  const nestedData = asRecord(source?.data);
  const nestedObject = asRecord(source?.object);
  if (direct) return direct;
  if (nestedObject && (nestedObject.name || nestedObject.hardware_id || nestedObject.lock_type_id != null)) {
    return nestedObject;
  }
  return asRecord(pick(nestedData, ["lock", "access_point", "accessPoint"]));
}

function sera4EventObject(root: Record<string, unknown> | null) {
  if (!root) return null;
  const object = asRecord(root.object);
  if (!object) return null;
  if (typeof root.action === "string") return object;
  if (object.user || object.lock_event_id != null || object.hardware_id != null || object.key) return object;
  return null;
}

function inferEnvelopeAction(source: Record<string, unknown> | null): AccessAction {
  const raw = str(source?.action)?.toLowerCase() || "";
  if (!raw || raw.includes("lock_event")) return "unknown";
  if (raw.includes(".close") || raw.endsWith("close")) return "close";
  if (raw.includes(".open") || raw.endsWith("open")) return "open";
  return "unknown";
}

export function inferAction(source: Record<string, unknown> | null): AccessAction {
  if (!source) return "unknown";
  if (source.opened_via != null && source.opened_via !== "") return "open";
  if (source.event === 0 || source.event === "0") return "open";
  if (source.event === 1 || source.event === "1") return "close";
  const openFlag = pick(source, ["opened", "is_open", "isOpen", "unlocked"]);
  if (openFlag === true) return "open";
  if (openFlag === false) return "close";
  if (typeof source.open === "boolean") return source.open ? "open" : "close";
  const envelope = inferEnvelopeAction(source);
  if (envelope !== "unknown") return envelope;
  const raw = str(pick(source, ["action", "event_type", "eventType", "type", "status", "state", "kind"]))?.toLowerCase();
  if (!raw || raw.includes("lock_event")) return "unknown";
  if (/\b(open|unlock|enter|access_granted|opened)\b/.test(raw)) return "open";
  if (/\b(close|closed|locked|secured)\b/.test(raw)) return "close";
  return "unknown";
}

/** Split Sera4 access_history rows into separate open and close events. */
export function flattenAccessRecord(record: unknown): unknown[] {
  const root = asRecord(record);
  if (!root) return [];
  const open = asRecord(root.open);
  const closed = asRecord(root.closed);
  const nestedOpen = Boolean(open && (open.timestamp || open.user));
  const nestedClose = Boolean(closed && closed.timestamp);
  if (!nestedOpen && !nestedClose) return [record];

  const lock = asRecord(root.lock);
  const user = asRecord(open?.user);
  const lockId = root.lock_id ?? lock?.id;
  const events: unknown[] = [];

  if (nestedOpen) {
    events.push({
      action: "open",
      occurred_at: open?.timestamp,
      timestamp: open?.timestamp,
      user,
      lock,
      lock_id: lockId,
      opened_via: open?.opened_via,
      key: open?.key,
      duration: root.duration,
    });
  }
  if (nestedClose) {
    events.push({
      action: "close",
      occurred_at: closed?.timestamp,
      timestamp: closed?.timestamp,
      user,
      lock,
      lock_id: lockId,
      rts_info: closed?.rts_info,
    });
  }
  return events;
}

export function parseLockEvent(payload: unknown): ParsedLockEvent | null {
  const root = asRecord(payload);
  if (!root) return null;
  const eventObject = sera4EventObject(root);
  const data = eventObject || asRecord(root.data) || root;
  const user = nestedUser(data) || nestedUser(root);
  const lock = nestedLock(data) || nestedLock(root);
  const open = asRecord(data.open) || asRecord(root.open);
  const closed = asRecord(data.closed) || asRecord(root.closed);

  let action = inferAction(data);
  if (action === "unknown") action = inferAction(root);
  if (action === "unknown") action = inferEnvelopeAction(root);
  if (action === "unknown" && open?.timestamp) action = "open";
  if (action === "unknown" && closed?.timestamp && !open?.timestamp) action = "close";

  const occurredAt =
    iso(
      pick(data, [
        "occurred_at",
        "occurredAt",
        "accessed_at",
        "accessedAt",
        "event_time",
        "eventTime",
        "timestamp",
        "created_at",
        "createdAt",
        "last_reported_at",
        "lastReportedAt",
        "time",
      ]),
    ) ||
    iso(pick(root, ["occurred_at", "occurredAt", "accessed_at", "timestamp", "created_at", "time"])) ||
    (action === "close" ? iso(closed?.timestamp) : iso(open?.timestamp)) ||
    new Date().toISOString();

  const lockId =
    str(pick(lock, ["id", "lock_id", "lockId"])) ||
    str(pick(data, ["lock_id", "lockId", "id"])) ||
    str(pick(root, ["lock_id", "lockId"]));
  const userId =
    str(pick(user, ["membership_id", "membershipId", "id", "user_id", "userId", "uuid"])) ||
    str(pick(data, ["user_id", "userId", "membership_id"]));
  const userName =
    str(pick(user, ["name", "full_name", "fullName", "display_name", "displayName"])) ||
    [str(pick(user, ["first_name", "firstName"])), str(pick(user, ["last_name", "lastName"]))]
      .filter(Boolean)
      .join(" ") ||
    str(pick(user, ["username"])) ||
    null;
  const userEmail = str(pick(user, ["email"]));
  const key = asRecord(pick(data, ["key"])) || asRecord(pick(root, ["key"]));
  const site = asRecord(pick(data, ["site"])) || asRecord(pick(lock, ["site"])) || asRecord(pick(root, ["site"]));
  const hardwareId =
    str(pick(data, ["hardware_id", "hardwareId"])) ||
    str(pick(lock, ["hardware_id", "hardwareId"])) ||
    str(pick(root, ["hardware_id", "hardwareId"]));
  const keyId =
    str(pick(key, ["id", "key_id", "keyId"])) ||
    str(pick(data, ["key_id", "keyId"])) ||
    str(pick(root, ["key_id", "keyId"]));
  const siteName = str(pick(site, ["name", "label"])) || null;

  return {
    lockId,
    lockName:
      str(pick(lock, ["name", "label", "description"])) ||
      str(pick(data, ["name"])) ||
      str(pick(root, ["name"])) ||
      hardwareId,
    userId,
    userName,
    userEmail,
    action,
    occurredAt,
    externalId:
      str(pick(data, ["lock_event_id", "lockEventId", "event_id", "eventId", "access_id", "accessId", "uuid"])) ||
      str(pick(root, ["event_id", "eventId", "uuid"])) ||
      (lockId && action !== "unknown" ? `${lockId}:${action}:${occurredAt}:${userId || userEmail || "unknown"}` : null),
    open: action === "open" ? true : action === "close" ? false : null,
    keyId,
    siteName,
    hardwareId,
  };
}

export function extractHistoryRecords(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload.flatMap(flattenAccessRecord);
  const root = asRecord(payload);
  if (!root) return [];
  const eventObject = sera4EventObject(root);
  if (eventObject) return [eventObject];
  const candidates = [
    root.data,
    root.accesses,
    root.access_histories,
    root.accessHistories,
    root.records,
    root.results,
    root.items,
    root.events,
    asRecord(root.data)?.accesses,
    asRecord(root.data)?.records,
    asRecord(root.data)?.items,
    asRecord(root.data)?.data,
  ];
  for (const value of candidates) {
    if (Array.isArray(value)) return value.flatMap(flattenAccessRecord);
  }
  if (asRecord(root.open) || asRecord(root.closed) || root.lock_id) {
    return flattenAccessRecord(root);
  }
  if (root.id || root.user || root.accessed_at || root.action) return [root];
  return [];
}
