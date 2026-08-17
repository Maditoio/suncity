import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { listAlerts, todayStats, latestLockSnapshot, listAccessEvents } from "@/lib/store";
import { getSettings, webhookUrl } from "@/lib/settings";

export async function GET() {
  const denied = await requireApiUser();
  if (denied) return denied;
  const settings = await getSettings();
  const users = await todayStats();
  const alerts = await listAlerts(20);
  const events = await listAccessEvents(12);
  const snapshot = await latestLockSnapshot();
  const openAlerts = alerts.filter((a) => !a.acknowledgedAt).length;
  return NextResponse.json({
    settings: {
      lockId: settings.lockId,
      maxUsers: settings.maxUsers,
      windowMinutes: settings.windowMinutes,
      timezone: settings.timezone,
      configured: Boolean(settings.twsHost && settings.lockId && settings.twsUserToken),
      autoRevokeOnAlert: settings.autoRevokeOnAlert,
    },
    webhookUrl: webhookUrl(settings),
    snapshot,
    today: {
      opens: users.reduce((sum, user) => sum + user.openCount, 0),
      uniqueUsers: users.length,
      overLimit: users.filter((user) => user.openCount > settings.maxUsers).length,
      users,
    },
    openAlerts,
    alerts,
    events,
  });
}
