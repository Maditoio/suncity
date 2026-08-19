import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAdmin, requireApiUser } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { extractHistoryRecords } from "@/lib/parse";
import { fetchAccessHistory, fetchLockStatus, signInForToken } from "@/lib/sera4";
import { ingestRecords } from "@/lib/store";
import { getSettings, updateSettings } from "@/lib/settings";
import { dayBounds, rangeFromDates } from "@/lib/format";

async function historyQuery(request: NextRequest, body?: { from?: string; to?: string; page?: string; page_size?: string }) {
  const settings = await getSettings();
  const today = dayBounds(settings.timezone).ymd;
  const fromYmd = body?.from || request.nextUrl.searchParams.get("from") || today;
  const toYmd = body?.to || request.nextUrl.searchParams.get("to") || fromYmd;
  const range = rangeFromDates(settings.timezone, fromYmd, toYmd);
  if (!range.start_date || !range.end_date) {
    throw new Error("Choose a from and to date before pulling access history");
  }
  return {
    from: fromYmd,
    to: toYmd,
    start_date: range.start_date,
    end_date: range.end_date,
    page: body?.page || request.nextUrl.searchParams.get("page") || undefined,
    page_size: body?.page_size || request.nextUrl.searchParams.get("page_size") || "50",
  };
}

export async function POST(request: NextRequest) {
  const denied = await requireApiUser();
  if (denied) return denied;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      from?: string;
      to?: string;
      page?: string;
      page_size?: string;
    };
    const query = await historyQuery(request, body);
    const [status, history] = await Promise.all([fetchLockStatus(), fetchAccessHistory(query)]);
    const records = extractHistoryRecords(history.json);
    const ingested = await ingestRecords("api", records);
    const user = await getSessionUser();
    if (user) {
      await logAction({
        actorId: user.id,
        actorUsername: user.username,
        actorRole: user.role,
        action: "pulled_history",
        detail: `${query.from} to ${query.to}`,
      });
    }
    return NextResponse.json({
      ok: status.ok && history.ok,
      status,
      history: {
        ...history,
        recordCount: records.length,
      },
      ingested,
      query,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed" }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const denied = await requireApiUser();
  if (denied) return denied;
  try {
    const query = await historyQuery(request);
    const history = await fetchAccessHistory(query);
    const records = extractHistoryRecords(history.json);
    const ingested = history.ok ? await ingestRecords("api", records) : { inserted: 0, alerts: 0 };
    const user = await getSessionUser();
    if (user && history.ok) {
      await logAction({
        actorId: user.id,
        actorUsername: user.username,
        actorRole: user.role,
        action: "pulled_history",
        detail: `${query.from} to ${query.to}`,
      });
    }
    return NextResponse.json({
      ok: history.ok,
      url: history.url,
      status: history.status,
      recordCount: records.length,
      ingested,
      query,
      json: history.json,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed" }, { status: 400 });
  }
}

export async function PUT() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const result = await signInForToken();
    if (result.token) {
      await updateSettings({ twsUserToken: result.token });
    }
    const user = await getSessionUser();
    if (user) {
      await logAction({
        actorId: user.id,
        actorUsername: user.username,
        actorRole: user.role,
        action: "refreshed_token",
      });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sign-in failed" }, { status: 400 });
  }
}
