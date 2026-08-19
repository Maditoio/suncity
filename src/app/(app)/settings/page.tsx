"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CopyField } from "@/components/CopyField";
import { UsersPanel } from "@/components/UsersPanel";
import { Button, Card, Field, Input, PageHeader, Textarea } from "@/components/ui";

type Settings = {
  twsHost: string;
  twsUser: string;
  twsPass: string;
  twsOrgToken: string;
  twsUserToken: string;
  twsMembershipId: string;
  lockId: string;
  accessHistoryPath: string;
  lockStatusPath: string;
  signInPath: string;
  extraHeadersJson: string;
  publicAppUrl: string;
  webhookUrl: string;
  maxUsers: number;
  windowMinutes: number;
  alertOnDaily: boolean;
  timezone: string;
  adminUsername: string;
  autoRevokeOnAlert: boolean;
  whitelistEmails: string;
  hasTwsPass: boolean;
  hasTwsOrgToken: boolean;
  hasTwsUserToken: boolean;
};

const empty: Settings = {
  twsHost: "",
  twsUser: "",
  twsPass: "",
  twsOrgToken: "",
  twsUserToken: "",
  twsMembershipId: "",
  lockId: "",
  accessHistoryPath: "/locks/{lockId}/accesses",
  lockStatusPath: "/locks/{lockId}/status",
  signInPath: "/users/sign_in",
  extraHeadersJson: "{}",
  publicAppUrl: "http://localhost:3000",
  webhookUrl: "",
  maxUsers: 4,
  windowMinutes: 10,
  alertOnDaily: true,
  timezone: "Europe/Berlin",
  adminUsername: "admin",
  autoRevokeOnAlert: false,
  whitelistEmails: "",
  hasTwsPass: false,
  hasTwsOrgToken: false,
  hasTwsUserToken: false,
};

export default function SettingsPage() {
  const router = useRouter();
  const [form, setForm] = useState<Settings>(empty);
  const [adminPassword, setAdminPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [status, setStatus] = useState("");
  const [raw, setRaw] = useState("");

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/settings");
      setForm(asForm((await response.json()) as Settings));
    })();
  }, []);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setStatus("Saving…");
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, adminPassword, currentPassword }),
    });
    const json = (await response.json()) as Settings & { error?: string };
    if (!response.ok) {
      setStatus(json.error || "Could not save");
      return;
    }
    setForm(asForm(json));
    setAdminPassword("");
    setCurrentPassword("");
    setStatus("Saved");
    router.refresh();
  }

  async function testConnection() {
    setStatus("Calling Sera4…");
    setRaw("");
    const response = await fetch("/api/sera4", { method: "POST" });
    const json = await response.json();
    setRaw(JSON.stringify(json, null, 2));
    setStatus(response.ok ? "Sera4 responded" : json.error || "Request failed");
  }

  async function refreshToken() {
    setStatus("Signing in to Sera4…");
    setRaw("");
    const response = await fetch("/api/sera4", { method: "PUT" });
    const json = await response.json();
    setRaw(JSON.stringify(json, null, 2));
    if (json.token) {
      const settings = await fetch("/api/settings");
      setForm(asForm((await settings.json()) as Settings));
      setStatus("Bearer token updated");
    } else {
      setStatus(json.error || "No token returned — check sign-in path or paste TwsUserToken from Postman");
    }
  }

  return (
    <div className="space-y-6">
    <form onSubmit={save} className="space-y-6">
      <PageHeader
        title="Settings"
        description="API credentials, alert rules, and the webhook URL Sera4 should call."
        actions={
          <Button type="submit">
            Save settings
          </Button>
        }
      />
      {status ? <p className="text-sm text-text-2">{status}</p> : null}
    </form>

      <UsersPanel />

      <form onSubmit={save} className="space-y-6">

      <Card
        title="Webhook URL"
        description="Paste this exact URL into Sera4. The secret is in the path so it still works if query strings are stripped."
      >
        <CopyField value={form.webhookUrl} />
      </Card>

      <Card
        title="Revoke key on limit violation"
        description="When true, the user's Sera4 key is deleted as soon as they exceed the open limit. A new key is created automatically at 09:00 GMT+2 the following day. When false, Inclusive Lock Monitor only records an alert."
      >
        <Field label="Automatically revoke Sera4 key">
          <select
            className="input"
            value={form.autoRevokeOnAlert ? "true" : "false"}
            onChange={(e) => set("autoRevokeOnAlert", e.target.value === "true")}
          >
            <option value="false">False — alert only, do not revoke</option>
            <option value="true">True — delete the user's Sera4 key</option>
          </select>
        </Field>
        <p className="mt-3 text-sm text-text-2">
          Save after changing this. Keep TwsUser and TwsPass filled so an expired Bearer token can be refreshed before the key is deleted or reissued. Vercel calls this automatically once a day around 09:00 GMT+2 and reissues a key for every revoked user.
        </p>
      </Card>

      <Card title="Alert rules">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Max users including opener">
            <Input type="number" min={1} value={form.maxUsers} onChange={(e) => set("maxUsers", Number(e.target.value))} />
          </Field>
          <Field label="Burst window (minutes)">
            <Input
              type="number"
              min={1}
              value={form.windowMinutes}
              onChange={(e) => set("windowMinutes", Number(e.target.value))}
            />
          </Field>
          <Field label="Timezone">
            <Input value={form.timezone} onChange={(e) => set("timezone", e.target.value)} />
          </Field>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.alertOnDaily}
            onChange={(e) => set("alertOnDaily", e.target.checked)}
            className="h-4 w-4 rounded border-line"
          />
          Also alert if the same user exceeds this count in a full day
        </label>
      </Card>

      <Card
        title="On-duty whitelist"
        description="These emails can open the lock as many times as needed. They will not trigger occupancy alerts or automatic key revoke."
      >
        <Field label="Whitelisted emails" hint="One email per line. Example: security@site.com">
          <Textarea
            rows={5}
            value={form.whitelistEmails}
            onChange={(e) => set("whitelistEmails", e.target.value)}
            placeholder={"guard@example.com\nnightshift@example.com"}
          />
        </Field>
      </Card>

      <Card
        title="Sera4 API"
        description="Same names as Postman. Webhooks from other locks are ignored; only the Lock ID below is stored and alerted."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="TwsHost" value={form.twsHost} onChange={(v) => set("twsHost", v)} placeholder="https://..." />
          <TextField label="Lock ID" value={form.lockId} onChange={(v) => set("lockId", v)} placeholder="Only this access point is stored" />
          <TextField label="TwsUser" value={form.twsUser} onChange={(v) => set("twsUser", v)} />
          <TextField
            label="TwsPass"
            value={form.twsPass}
            onChange={(v) => set("twsPass", v)}
            type="password"
            placeholder={form.hasTwsPass ? "Saved — leave blank to keep" : ""}
          />
          <TextField
            label="TwsOrgToken"
            value={form.twsOrgToken}
            onChange={(v) => set("twsOrgToken", v)}
            type="password"
            placeholder={form.hasTwsOrgToken ? "Saved — leave blank to keep" : ""}
          />
          <TextField
            label="TwsUserToken (Bearer)"
            value={form.twsUserToken}
            onChange={(v) => set("twsUserToken", v)}
            type="password"
            placeholder={form.hasTwsUserToken ? "Saved — leave blank to keep" : ""}
          />
          <TextField label="TwsMembershipId" value={form.twsMembershipId} onChange={(v) => set("twsMembershipId", v)} />
          <TextField label="Public app URL" value={form.publicAppUrl} onChange={(v) => set("publicAppUrl", v)} />
          <TextField label="Access history path" value={form.accessHistoryPath} onChange={(v) => set("accessHistoryPath", v)} />
          <TextField label="Lock status path" value={form.lockStatusPath} onChange={(v) => set("lockStatusPath", v)} />
          <TextField label="Sign-in path" value={form.signInPath} onChange={(v) => set("signInPath", v)} />
        </div>
        <div className="mt-4">
          <Field label="Extra headers (JSON)">
            <Textarea value={form.extraHeadersJson} onChange={(e) => set("extraHeadersJson", e.target.value)} rows={5} className="font-mono" />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={testConnection}>
            Test lock + history
          </Button>
          <Button type="button" variant="secondary" onClick={refreshToken}>
            Sign in and refresh token
          </Button>
        </div>
      </Card>

      <Card
        title="Admin login"
        description="Stored in PostgreSQL. Enter your current password to change the username or password. Changing the password signs out other sessions."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Username" value={form.adminUsername} onChange={(v) => set("adminUsername", v)} />
          <Field label="Current password" hint="Required only when changing username or password">
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Current password"
            />
          </Field>
          <Field label="New password" hint="Leave blank to keep the current password">
            <Input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
          </Field>
        </div>
      </Card>

      {raw ? (
        <pre className="max-h-80 overflow-auto rounded-[10px] bg-[#12151c] p-4 text-xs text-[#e8ecf2]">{raw}</pre>
      ) : null}
    </form>
    </div>
  );
}

function asForm(json: Settings & { whitelistEmails?: string[] | string }): Settings {
  return {
    ...json,
    whitelistEmails: Array.isArray(json.whitelistEmails) ? json.whitelistEmails.join("\n") : json.whitelistEmails || "",
  };
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <Input
        type={type}
        value={value.includes("•") ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </Field>
  );
}
