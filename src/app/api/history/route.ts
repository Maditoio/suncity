import { NextRequest, NextResponse } from "next/server";
import { listAccessEvents } from "@/lib/store";
import { getSettings } from "@/lib/settings";
import { requireApiUser } from "@/lib/auth";
import { rangeFromDates } from "@/lib/format";

export async function GET(request: NextRequest) {
  const denied = await requireApiUser();
  if (denied) return denied;
  const settings = await getSettings();
  const from = request.nextUrl.searchParams.get("from") || undefined;
  const to = request.nextUrl.searchParams.get("to") || undefined;
  const range = rangeFromDates(settings.timezone, from, to);
  return NextResponse.json({
    timezone: settings.timezone,
    events: await listAccessEvents(500, range),
  });
}
