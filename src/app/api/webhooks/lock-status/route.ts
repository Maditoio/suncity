import { NextRequest } from "next/server";
import { handleLockWebhook } from "@/lib/webhook";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleLockWebhook(request);
}

export async function POST(request: NextRequest) {
  return handleLockWebhook(request);
}

export async function PUT(request: NextRequest) {
  return handleLockWebhook(request);
}
