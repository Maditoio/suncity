import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listAuditLogs } from "@/lib/audit";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ logs: await listAuditLogs(300) });
}
