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
