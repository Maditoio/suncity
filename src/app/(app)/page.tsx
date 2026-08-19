"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { CopyField } from "@/components/CopyField";
import { Pager, usePager } from "@/components/pagination";
import { AlertKind, StatusPill } from "@/components/Pills";
import { Button, Card, EmptyState, Field, Input, PageHeader, StatCard } from "@/components/ui";

type Dashboard = {
  webhookUrl: string;
  snapshot: { open: boolean; occurredAt: string; lockName: string | null; lockId: string | null } | null;
  settings: {
    lockId: string;
    maxUsers: number;
    windowMinutes: number;
    timezone: string;
    configured: boolean;
    autoRevokeOnAlert: boolean;
    whitelistEmails: string[];
  };
  today: {
    opens: number;
    uniqueUsers: number;
    overLimit: number;
    users: {
      userKey: string;
      userId: string | null;
      userName: string | null;
      userEmail: string | null;
      openCount: number;
      lastOpenAt: string | null;
    }[];
  };
  openAlerts: number;
  alerts: {
    id: number;
    kind: "burst" | "daily";
    message: string;
    occurredAt: string;
    acknowledgedAt: string | null;
    openCount: number;
  }[];
  events: {
    id: number;
    action: string;
    userName: string | null;
    userEmail: string | null;
    userId: string | null;
    lockName: string | null;
    siteName: string | null;
    occurredAt: string;
    source: string;
  }[];
};

function nameOf(user: { userName: string | null; userEmail: string | null; userId: string | null }) {
  return user.userName || user.userEmail || (user.userId ? `User ${user.userId}` : "Unknown user");
}

function isOnDuty(email: string | null, list: string[]) {
  return Boolean(email && list.includes(email.trim().toLowerCase()));
}

export default function OverviewPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  async function load() {
    const response = await fetch("/api/dashboard");
    if (!response.ok) {
      setError("Could not load dashboard");
      return;
    }
    setData((await response.json()) as Dashboard);
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 8000);
    return () => clearInterval(timer);
  }, []);

  async function sync() {
    setSyncing(true);
    setError("");
    const params = new URLSearchParams({ from, to });
    const response = await fetch(`/api/sera4?${params}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to }),
    });
    const json = (await response.json()) as { error?: string };
    if (!response.ok) setError(json.error || "Sera4 request failed");
    await load();
    setSyncing(false);
  }

  if (!data) {
    return <p className="text-sm text-text-2">Loading overview…</p>;
  }

  return (
    <OverviewBody
      data={data}
      error={error}
      syncing={syncing}
      from={from}
      to={to}
      setFrom={setFrom}
      setTo={setTo}
      sync={sync}
    />
  );
}

function OverviewBody({
  data,
  error,
  syncing,
  from,
  to,
  setFrom,
  setTo,
  sync,
}: {
  data: Dashboard;
  error: string;
  syncing: boolean;
  from: string;
  to: string;
  setFrom: (value: string) => void;
  setTo: (value: string) => void;
  sync: () => void;
}) {
  const users = usePager(data.today.users, 6);
  const alerts = usePager(data.alerts, 4);
  const events = usePager(data.events, 8);
  const duty = data.settings.whitelistEmails || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Door occupancy"
        description={`Alert when one person opens the lock more than ${data.settings.maxUsers} times in ${data.settings.windowMinutes} minutes.${data.settings.autoRevokeOnAlert ? " Over-limit keys are revoked automatically." : " Over-limit keys are not revoked until you turn that on in Settings."}${duty.length ? " On-duty emails are excluded." : ""}`}
        actions={
          <>
            <Field label="From">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <Button onClick={sync} disabled={syncing || !from || !to} className="mt-[22px]">
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              Pull this range
            </Button>
          </>
        }
      />

      {error ? <p className="rounded-[8px] bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p> : null}

      {!data.settings.configured ? (
        <div className="card border-warn bg-warn-soft px-5 py-4">
          <p className="font-medium">Connect Sera4 in Settings</p>
          <p className="mt-1 text-sm text-text-2">
            {data.webhookUrl
              ? "Add TwsHost, tokens, and lock ID, then paste the webhook URL into Sera4 for live open/close events."
              : "Ask an admin to connect Sera4 in Settings. Operators cannot change API or webhook settings."}
          </p>
          {data.webhookUrl ? (
            <Link href="/settings" className="mt-3 inline-block text-sm font-semibold text-primary">
              Open settings
            </Link>
          ) : null}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Lock status"
          value={data.snapshot ? (data.snapshot.open ? "Open" : "Closed") : "—"}
          hint={data.snapshot?.lockName || data.settings.lockId || "No lock selected"}
          extra={<StatusPill open={data.snapshot?.open ?? null} />}
        />
        <StatCard label="Opens today" value={data.today.opens} hint={`${data.today.uniqueUsers} people opened the lock`} />
        <StatCard
          label="People over limit"
          value={data.today.overLimit}
          hint={`More than ${data.settings.maxUsers} opens today`}
        />
        <StatCard
          label="Open alerts"
          value={<span className={data.openAlerts ? "text-danger" : ""}>{data.openAlerts}</span>}
          hint={`Burst window ${data.settings.windowMinutes} min`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="Same user, same day" padded={false}>
          {data.today.users.length === 0 ? (
            <EmptyState title="No opens recorded yet today." />
          ) : (
            <>
              <ul>
                {users.slice.map((user) => {
                  const onDuty = isOnDuty(user.userEmail, duty);
                  const over = !onDuty && user.openCount > data.settings.maxUsers;
                  return (
                    <li
                      key={user.userKey}
                      className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{nameOf(user)}</p>
                        <p className="text-xs text-text-2">{user.userEmail || user.userId || "No email"}</p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-right text-sm font-semibold tabular-nums ${
                          onDuty
                            ? "bg-primary-soft text-primary"
                            : over
                              ? "bg-danger-soft text-danger"
                              : "bg-surface-2 text-text"
                        }`}
                      >
                        {onDuty ? `On duty · ${user.openCount}` : `${user.openCount} opens`}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <Pager page={users.page} pages={users.pages} total={users.total} onPage={users.setPage} noun="people" />
            </>
          )}
        </Card>
        <Card title="Latest alerts" padded={false}>
          {data.alerts.length === 0 ? (
            <EmptyState title="No occupancy alerts yet." />
          ) : (
            <>
              <ul className="space-y-3 p-5">
                {alerts.slice.map((alert) => (
                  <li key={alert.id} className="rounded-[8px] bg-surface-2 px-3 py-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <AlertKind kind={alert.kind} />
                      <span className="text-xs text-text-2">{new Date(alert.occurredAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm">{alert.message}</p>
                  </li>
                ))}
              </ul>
              <Pager page={alerts.page} pages={alerts.pages} total={alerts.total} onPage={alerts.setPage} noun="alerts" />
            </>
          )}
        </Card>
      </section>

      {data.webhookUrl ? (
        <Card title="Webhook for lock open/close" description="Paste this exact URL into Sera4, including the token in the path.">
          <CopyField value={data.webhookUrl} />
        </Card>
      ) : null}

      <Card title="Recent activity" padded={false}>
        {data.events.length === 0 ? (
          <EmptyState title="Waiting for webhook events or an API pull." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>User</th>
                    <th>Access point</th>
                    <th>Action</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {events.slice.map((event) => (
                    <tr key={event.id}>
                      <td className="whitespace-nowrap text-text-2">{new Date(event.occurredAt).toLocaleString()}</td>
                      <td>
                        <p className="font-medium">{nameOf(event)}</p>
                        {event.userEmail ? <p className="text-xs text-text-2">{event.userEmail}</p> : null}
                      </td>
                      <td>
                        <p>{event.lockName || "—"}</p>
                        {event.siteName ? <p className="text-xs text-text-2">{event.siteName}</p> : null}
                      </td>
                      <td className="capitalize">{event.action}</td>
                      <td className="capitalize text-text-2">{event.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={events.page} pages={events.pages} total={events.total} onPage={events.setPage} noun="events" />
          </>
        )}
      </Card>
    </div>
  );
}
