"use client";

import { FormEvent, useEffect, useState } from "react";
import { CopyField } from "@/components/CopyField";
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
  hasTwsPass: false,
  hasTwsOrgToken: false,
  hasTwsUserToken: false,
};

export default function SettingsPage() {
  const [form, setForm] = useState<Settings>(empty);
  const [adminPassword, setAdminPassword] = useState("");
  const [status, setStatus] = useState("");
  const [raw, setRaw] = useState("");

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/settings");
      setForm((await response.json()) as Settings);
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
      body: JSON.stringify({ ...form, adminPassword }),
    });
    const json = (await response.json()) as Settings & { error?: string };
    if (!response.ok) {
      setStatus(json.error || "Could not save");
      return;
    }
    setForm(json);
    setAdminPassword("");
    setStatus("Saved");
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
      setForm((await settings.json()) as Settings);
      setStatus("Bearer token updated");
    } else {
      setStatus(json.error || "No token returned — check sign-in path or paste TwsUserToken from Postman");
    }
  }

  return (
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

      <Card title="Webhook URL" description="Give this URL to Sera4 for lock open/close updates. Set a public app URL first if you are local.">
        <CopyField value={form.webhookUrl} />
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
        title="Sera4 API"
        description="Same names as Postman. Requests already send Authorization, tws-organization-token, and tws-membershipId. Extra headers can stay {}."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="TwsHost" value={form.twsHost} onChange={(v) => set("twsHost", v)} placeholder="https://..." />
          <TextField label="Lock ID" value={form.lockId} onChange={(v) => set("lockId", v)} />
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

      <Card title="Admin login">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Username" value={form.adminUsername} onChange={(v) => set("adminUsername", v)} />
          <Field label="New password" hint="Leave blank to keep the current password">
            <Input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Leave blank to keep current"
            />
          </Field>
        </div>
      </Card>

      {raw ? (
        <pre className="max-h-80 overflow-auto rounded-[10px] bg-[#12151c] p-4 text-xs text-[#e8ecf2]">{raw}</pre>
      ) : null}
    </form>
  );
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
