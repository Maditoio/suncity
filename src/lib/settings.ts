import { ensureDb } from "./db";
import type { Settings } from "./types";

type SettingsRow = {
  tws_host: string;
  tws_user: string;
  tws_pass: string;
  tws_org_token: string;
  tws_user_token: string;
  tws_membership_id: string;
  lock_id: string;
  access_history_path: string;
  lock_status_path: string;
  sign_in_path: string;
  extra_headers_json: string;
  public_app_url: string;
  webhook_token: string;
  max_users: number;
  window_minutes: number;
  alert_on_daily: boolean;
  timezone: string;
  admin_username: string;
  admin_password_hash: string;
  admin_password_salt: string;
  session_secret: string;
};

function mapSettings(row: SettingsRow): Settings {
  return {
    twsHost: row.tws_host,
    twsUser: row.tws_user,
    twsPass: row.tws_pass,
    twsOrgToken: row.tws_org_token,
    twsUserToken: row.tws_user_token,
    twsMembershipId: row.tws_membership_id,
    lockId: row.lock_id,
    accessHistoryPath: row.access_history_path,
    lockStatusPath: row.lock_status_path,
    signInPath: row.sign_in_path,
    extraHeadersJson: row.extra_headers_json,
    publicAppUrl: row.public_app_url,
    webhookToken: row.webhook_token,
    maxUsers: Number(row.max_users),
    windowMinutes: Number(row.window_minutes),
    alertOnDaily: Boolean(row.alert_on_daily),
    timezone: row.timezone,
  };
}

async function settingsRow() {
  const sql = await ensureDb();
  const rows = await sql<SettingsRow[]>`SELECT * FROM settings WHERE id = 1`;
  if (!rows[0]) throw new Error("Settings row is missing");
  return rows[0];
}

export async function getSettings(): Promise<Settings> {
  return mapSettings(await settingsRow());
}

export function webhookUrl(settings: Settings) {
  const vercel = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  const base = (settings.publicAppUrl || process.env.APP_PUBLIC_URL || vercel || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/webhooks/lock-status/${settings.webhookToken}`;
}

export type SettingsPatch = Partial<Settings>;

export async function updateSettings(patch: SettingsPatch) {
  const current = await settingsRow();
  const next = {
    tws_host: patch.twsHost ?? current.tws_host,
    tws_user: patch.twsUser ?? current.tws_user,
    tws_pass: patch.twsPass ?? current.tws_pass,
    tws_org_token: patch.twsOrgToken ?? current.tws_org_token,
    tws_user_token: patch.twsUserToken ?? current.tws_user_token,
    tws_membership_id: patch.twsMembershipId ?? current.tws_membership_id,
    lock_id: patch.lockId ?? current.lock_id,
    access_history_path: patch.accessHistoryPath ?? current.access_history_path,
    lock_status_path: patch.lockStatusPath ?? current.lock_status_path,
    sign_in_path: patch.signInPath ?? current.sign_in_path,
    extra_headers_json: patch.extraHeadersJson ?? current.extra_headers_json,
    public_app_url: patch.publicAppUrl ?? current.public_app_url,
    webhook_token: patch.webhookToken ?? current.webhook_token,
    max_users: patch.maxUsers ?? current.max_users,
    window_minutes: patch.windowMinutes ?? current.window_minutes,
    alert_on_daily: patch.alertOnDaily === undefined ? current.alert_on_daily : patch.alertOnDaily,
    timezone: patch.timezone ?? current.timezone,
  };

  const sql = await ensureDb();
  await sql`
    UPDATE settings SET
      tws_host = ${next.tws_host},
      tws_user = ${next.tws_user},
      tws_pass = ${next.tws_pass},
      tws_org_token = ${next.tws_org_token},
      tws_user_token = ${next.tws_user_token},
      tws_membership_id = ${next.tws_membership_id},
      lock_id = ${next.lock_id},
      access_history_path = ${next.access_history_path},
      lock_status_path = ${next.lock_status_path},
      sign_in_path = ${next.sign_in_path},
      extra_headers_json = ${next.extra_headers_json},
      public_app_url = ${next.public_app_url},
      webhook_token = ${next.webhook_token},
      max_users = ${next.max_users},
      window_minutes = ${next.window_minutes},
      alert_on_daily = ${next.alert_on_daily},
      timezone = ${next.timezone},
      updated_at = ${new Date().toISOString()}
    WHERE id = 1
  `;

  return getSettings();
}

export async function publicSettings() {
  const settings = await getSettings();
  return {
    ...settings,
    twsPass: settings.twsPass ? "••••••••" : "",
    twsOrgToken: settings.twsOrgToken ? "••••••••" : "",
    twsUserToken: settings.twsUserToken ? "••••••••" : "",
    webhookUrl: webhookUrl(settings),
    hasTwsPass: Boolean(settings.twsPass),
    hasTwsOrgToken: Boolean(settings.twsOrgToken),
    hasTwsUserToken: Boolean(settings.twsUserToken),
  };
}
