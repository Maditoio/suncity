import { NextResponse } from "next/server";
import { listWebhookLogs } from "@/lib/store";
import { requireApiUser } from "@/lib/auth";

export async function GET() {
  const denied = await requireApiUser();
  if (denied) return denied;
  return NextResponse.json({ logs: await listWebhookLogs(80) });
}
