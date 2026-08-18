import { getSettings } from "./settings";
import type { Settings } from "./types";

function fillPath(template: string, lockId: string) {
  return template.replaceAll("{lockId}", encodeURIComponent(lockId)).replaceAll(":id", encodeURIComponent(lockId));
}

function parseExtraHeaders(json: string) {
  if (!json.trim()) return {};
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value == null || value === "") continue;
      headers[key] = String(value);
    }
    return headers;
  } catch {
    return {};
  }
}

export function sera4Headers(settings: Settings, overrides?: Record<string, string>) {
  const headers: Record<string, string> = {
    Accept: "*/*",
  };
  if (settings.twsUserToken) {
    headers.Authorization = `Bearer ${settings.twsUserToken}`;
  }
  if (settings.twsOrgToken) {
    headers["tws-organization-token"] = settings.twsOrgToken;
  }
  if (settings.twsMembershipId) {
    headers["tws-membershipId"] = settings.twsMembershipId;
  }
  Object.assign(headers, parseExtraHeaders(settings.extraHeadersJson), overrides);
  return headers;
}

export function sera4Url(settings: Settings, path: string) {
  const host = settings.twsHost.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${host}${suffix}`;
}

export async function sera4Get(path: string, query?: Record<string, string | undefined>) {
  const settings = await getSettings();
  if (!settings.twsHost) {
    throw new Error("TwsHost is not set");
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value) params.set(key, value);
  }
  const suffix = params.toString() ? `${path}?${params.toString()}` : path;
  const url = sera4Url(settings, suffix);
  const response = await fetch(url, { method: "GET", headers: sera4Headers(settings), cache: "no-store" });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: response.ok, status: response.status, url, json, text };
}

export async function sera4Send(method: string, path: string, body?: unknown) {
  const settings = await getSettings();
  if (!settings.twsHost) {
    throw new Error("TwsHost is not set");
  }
  const url = sera4Url(settings, path);
  const response = await fetch(url, {
    method,
    headers: sera4Headers(settings, body === undefined ? undefined : { "Content-Type": "application/json" }),
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: response.ok, status: response.status, url, json, text };
}

type Sera4Result = Awaited<ReturnType<typeof sera4Send>>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function numericOrString(value: string) {
  return /^\d+$/.test(value) ? Number(value) : value;
}

async function withSera4AuthRetry(run: () => Promise<Sera4Result>) {
  let result = await run();
  if (result.status !== 401) return result;
  try {
    const signed = await signInForToken();
    if (signed.token) {
      const { updateSettings } = await import("./settings");
      await updateSettings({ twsUserToken: signed.token });
      result = await run();
    }
  } catch {
    // Keep the original 401 so the caller can record why Sera4 rejected the request.
  }
  return result;
}

export async function revokeKey(keyId: string) {
  if (!keyId) throw new Error("Key id is missing");
  const path = `/keys/${encodeURIComponent(keyId)}`;
  return withSera4AuthRetry(() => sera4Send("DELETE", path));
}

export async function fetchKey(keyId: string) {
  if (!keyId) throw new Error("Key id is missing");
  return withSera4AuthRetry(() => sera4Get(`/keys/${encodeURIComponent(keyId)}`));
}

export function buildKeyCreateBody(
  fetched: unknown,
  fallback: { lockId: string; membershipId: string },
) {
  const root = asRecord(fetched);
  const nested = asRecord(root?.data) || asRecord(root?.key) || asRecord(root?.object) || root;
  const omit = new Set([
    "id",
    "created_at",
    "updated_at",
    "deleted",
    "deleted_at",
    "revoked",
    "revoked_at",
    "lock",
    "user",
    "site",
    "organization",
  ]);
  const key: Record<string, unknown> = {};
  if (nested) {
    for (const [name, value] of Object.entries(nested)) {
      if (omit.has(name) || value == null || typeof value === "object") continue;
      key[name] = value;
    }
  }
  if (!key.lock_id && !key.lockId && fallback.lockId) key.lock_id = numericOrString(fallback.lockId);
  if (!key.membership_id && !key.membershipId && fallback.membershipId) key.membership_id = fallback.membershipId;
  return { key };
}

export async function createKey(body: unknown) {
  const attempts: { path: string; body: unknown }[] = [{ path: "/keys", body }];
  const record = asRecord(body);
  const inner = asRecord(record?.key) || record;
  const lockId = inner ? String(inner.lock_id ?? inner.lockId ?? "") : "";
  const membershipId = inner ? String(inner.membership_id ?? inner.membershipId ?? "") : "";
  if (lockId && membershipId) {
    attempts.push({
      path: "/keys",
      body: { lock_id: numericOrString(lockId), membership_id: membershipId },
    });
    attempts.push({
      path: `/locks/${encodeURIComponent(lockId)}/keys`,
      body: { key: { membership_id: membershipId } },
    });
  }
  let last = await withSera4AuthRetry(() => sera4Send("POST", attempts[0].path, attempts[0].body));
  if (last.ok || last.status === 201 || last.status === 409) return last;
  for (const attempt of attempts.slice(1)) {
    last = await withSera4AuthRetry(() => sera4Send("POST", attempt.path, attempt.body));
    if (last.ok || last.status === 201 || last.status === 409) return last;
  }
  return last;
}

export function createdKeyId(json: unknown) {
  const root = asRecord(json);
  const nested = asRecord(root?.data) || asRecord(root?.key) || root;
  const id = nested?.id;
  return id == null ? null : String(id);
}

export async function fetchLockStatus() {
  const settings = await getSettings();
  if (!settings.lockId) throw new Error("Lock ID is not set");
  return sera4Get(fillPath(settings.lockStatusPath, settings.lockId));
}

export type HistoryQuery = {
  start_date?: string;
  end_date?: string;
  page?: string;
  page_size?: string;
};

export async function fetchAccessHistory(query: HistoryQuery = {}) {
  const settings = await getSettings();
  if (!settings.lockId) throw new Error("Lock ID is not set");
  if (!query.start_date || !query.end_date) {
    throw new Error("Choose a from and to date before pulling access history");
  }
  return sera4Get(fillPath(settings.accessHistoryPath, settings.lockId), {
    start_date: query.start_date,
    end_date: query.end_date,
    page: query.page,
    page_size: query.page_size,
  });
}

export async function signInForToken() {
  const settings = await getSettings();
  if (!settings.twsHost || !settings.twsUser || !settings.twsPass) {
    throw new Error("TwsHost, TwsUser and TwsPass are required to sign in");
  }
  const url = sera4Url(settings, settings.signInPath);
  const body = JSON.stringify({
    user: { email: settings.twsUser, password: settings.twsPass },
    email: settings.twsUser,
    password: settings.twsPass,
  });
  const response = await fetch(url, {
    method: "POST",
    headers: sera4Headers(settings, { "Content-Type": "application/json", Accept: "application/json" }),
    body,
    cache: "no-store",
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  const authHeader = response.headers.get("authorization") || response.headers.get("Authorization");
  const tokenFromHeader = authHeader?.replace(/^Bearer\s+/i, "").replace(/^Token\s+token=/i, "") || null;
  const record = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
  const nested = record?.data && typeof record.data === "object" ? (record.data as Record<string, unknown>) : null;
  const tokenFromBody =
    (typeof record?.token === "string" && record.token) ||
    (typeof record?.jwt === "string" && record.jwt) ||
    (typeof nested?.token === "string" && nested.token) ||
    null;
  return {
    ok: response.ok,
    status: response.status,
    url,
    json,
    token: tokenFromHeader || tokenFromBody,
  };
}
