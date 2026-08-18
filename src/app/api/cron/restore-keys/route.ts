import { NextRequest, NextResponse } from "next/server";
import { restoreDueKeys } from "@/lib/store";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

function isVercelCron(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") || "";
  return userAgent.includes("vercel-cron") || Boolean(request.headers.get("x-vercel-cron-schedule"));
}

async function authorized(request: NextRequest) {
  if (isVercelCron(request)) return true;
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) return true;
  const settings = await getSettings();
  return Boolean(settings.webhookToken && token === settings.webhookToken);
}

async function run(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await restoreDueKeys();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
