import { NextResponse } from "next/server";
import { getSessionUser, requireApiUser, updateAdminAccount } from "@/lib/auth";
import { publicSettings, updateSettings } from "@/lib/settings";

export async function GET() {
  const denied = await requireApiUser();
  if (denied) return denied;
  const user = await getSessionUser();
  return NextResponse.json({
    ...(await publicSettings()),
    adminUsername: user?.username || "",
  });
}

export async function POST(request: Request) {
  const denied = await requireApiUser();
  if (denied) return denied;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Record<string, unknown>;
  const keepSecret = (value: unknown) => {
    if (typeof value !== "string") return undefined;
    if (!value || value.includes("•")) return undefined;
    return value;
  };

  try {
    if (body.extraHeadersJson && typeof body.extraHeadersJson === "string" && body.extraHeadersJson.trim()) {
      JSON.parse(body.extraHeadersJson);
    }
  } catch {
    return NextResponse.json({ error: "Extra headers must be valid JSON" }, { status: 400 });
  }

  try {
    if (typeof body.adminUsername === "string" || typeof body.adminPassword === "string") {
      await updateAdminAccount(user.id, {
        username: typeof body.adminUsername === "string" ? body.adminUsername.trim() : undefined,
        password: typeof body.adminPassword === "string" ? body.adminPassword : undefined,
        currentPassword: typeof body.currentPassword === "string" ? body.currentPassword : undefined,
      });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update admin login" }, { status: 400 });
  }

  const settings = await updateSettings({
    twsHost: typeof body.twsHost === "string" ? body.twsHost.trim() : undefined,
    twsUser: typeof body.twsUser === "string" ? body.twsUser.trim() : undefined,
    twsPass: keepSecret(body.twsPass),
    twsOrgToken: keepSecret(body.twsOrgToken),
    twsUserToken: keepSecret(body.twsUserToken),
    twsMembershipId: typeof body.twsMembershipId === "string" ? body.twsMembershipId.trim() : undefined,
    lockId: typeof body.lockId === "string" ? body.lockId.trim() : undefined,
    accessHistoryPath: typeof body.accessHistoryPath === "string" ? body.accessHistoryPath.trim() : undefined,
    lockStatusPath: typeof body.lockStatusPath === "string" ? body.lockStatusPath.trim() : undefined,
    signInPath: typeof body.signInPath === "string" ? body.signInPath.trim() : undefined,
    extraHeadersJson: typeof body.extraHeadersJson === "string" ? body.extraHeadersJson : undefined,
    publicAppUrl: typeof body.publicAppUrl === "string" ? body.publicAppUrl.trim() : undefined,
    maxUsers: typeof body.maxUsers === "number" ? body.maxUsers : undefined,
    windowMinutes: typeof body.windowMinutes === "number" ? body.windowMinutes : undefined,
    alertOnDaily: typeof body.alertOnDaily === "boolean" ? body.alertOnDaily : undefined,
    timezone: typeof body.timezone === "string" ? body.timezone : undefined,
    autoRevokeOnAlert: typeof body.autoRevokeOnAlert === "boolean" ? body.autoRevokeOnAlert : undefined,
  });

  const nextUser = await getSessionUser();
  return NextResponse.json({
    ...(await publicSettings()),
    saved: true,
    maxUsers: settings.maxUsers,
    adminUsername: nextUser?.username || user.username,
  });
}
