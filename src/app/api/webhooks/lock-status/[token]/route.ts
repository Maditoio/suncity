import { NextRequest } from "next/server";
import { handleLockWebhook } from "@/lib/webhook";

export const dynamic = "force-dynamic";

async function withPathToken(request: NextRequest, params: Promise<{ token: string }>) {
  const { token } = await params;
  return handleLockWebhook(request, token);
}

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  return withPathToken(request, context.params);
}

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  return withPathToken(request, context.params);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  return withPathToken(request, context.params);
}
