import { NextResponse } from "next/server";
import { getSessionUser, isAdmin, requireApiUser } from "@/lib/auth";
import { listAlerts, todayStats, latestLockSnapshot, listAccessEvents } from "@/lib/store";
import { getSettings, webhookUrl } from "@/lib/settings";
import { isWhitelistedEmail } from "@/lib/format";

export async function GET() {
  const denied = await requireApiUser();
  if (denied) return denied;
  const user = await getSessionUser();
  const admin = isAdmin(user);
  const settings = await getSettings();
  const users = await todayStats();
  const alerts = await listAlerts(20);
  const events = await listAccessEvents(80);
  const snapshot = await latestLockSnapshot();
  const openAlerts = alerts.filter((a) => !a.acknowledgedAt).length;
  return NextResponse.json({
    role: user?.role || "operator",
    settings: {
      lockId: settings.lockId,
      maxUsers: settings.maxUsers,
      windowMinutes: settings.windowMinutes,
      timezone: settings.timezone,
      configured: Boolean(settings.twsHost && settings.lockId && settings.twsUserToken),
      autoRevokeOnAlert: settings.autoRevokeOnAlert,
      whitelistEmails: settings.whitelistEmails,
    },
    webhookUrl: admin ? webhookUrl(settings) : "",
    snapshot,
    today: {
      opens: users.reduce((sum, person) => sum + person.openCount, 0),
      uniqueUsers: users.length,
      overLimit: users.filter(
        (person) => person.openCount > settings.maxUsers && !isWhitelistedEmail(person.userEmail, settings.whitelistEmails),
      ).length,
      users,
    },
    openAlerts,
    alerts,
    events,
  });
}
