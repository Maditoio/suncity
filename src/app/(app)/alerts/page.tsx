"use client";

import { useEffect, useState } from "react";
import { Pager, usePager } from "@/components/pagination";
import { AlertKind } from "@/components/Pills";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";

type AlertRow = {
  id: number;
  userName: string | null;
  userEmail: string | null;
  userId: string | null;
  kind: "burst" | "daily";
  openCount: number;
  windowMinutes: number;
  threshold: number;
  message: string;
  occurredAt: string;
  acknowledgedAt: string | null;
  keyId: string | null;
  revokedAt: string | null;
  revokeError: string | null;
  restoreAfter: string | null;
  restoredAt: string | null;
  restoreError: string | null;
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const response = await fetch("/api/alerts");
    const json = (await response.json()) as { alerts: AlertRow[] };
    setAlerts(json.alerts || []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function revoke(id: number) {
    await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, revoke: true }),
    });
    await load();
  }

  async function ack(id: number) {
    await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  const open = alerts.filter((alert) => !alert.acknowledgedAt);
  const done = alerts.filter((alert) => alert.acknowledgedAt);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description="A burst alert means the same person opened the lock more times than allowed in the short window — typically holding the door for extra people."
      />
      <OpenAlerts loading={loading} alerts={open} ack={ack} revoke={revoke} />
      {done.length ? <DoneAlerts alerts={done} /> : null}
    </div>
  );
}

function OpenAlerts({
  loading,
  alerts,
  ack,
  revoke,
}: {
  loading: boolean;
  alerts: AlertRow[];
  ack: (id: number) => void;
  revoke: (id: number) => void;
}) {
  const pager = usePager(alerts, 4);
  return (
    <section className="space-y-3">
      <h2 className="text-[15px] font-semibold">Needs attention</h2>
      {loading ? <p className="text-sm text-text-2">Loading…</p> : null}
      {!loading && alerts.length === 0 ? (
        <Card>
          <EmptyState title="No open alerts" description="Occupancy is within the configured limit." />
        </Card>
      ) : null}
      {pager.slice.map((alert) => (
        <article key={alert.id} className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <AlertKind kind={alert.kind} />
            <p className="text-sm text-text-2">{new Date(alert.occurredAt).toLocaleString()}</p>
          </div>
          <p className="mt-3 text-[15px] leading-6">{alert.message}</p>
          {alert.userEmail ? <p className="mt-1 text-sm text-text-2">{alert.userEmail}</p> : null}
          {alert.revokedAt ? <p className="mt-1 text-sm text-primary">Sera4 key revoked</p> : null}
          {alert.revokedAt && !alert.restoredAt && alert.restoreAfter ? (
            <p className="mt-1 text-sm text-text-2">
              New key at 09:00 GMT+2 the following day ({new Date(alert.restoreAfter).toLocaleString()})
            </p>
          ) : null}
          {alert.restoredAt ? <p className="mt-1 text-sm text-primary">New Sera4 key issued</p> : null}
          {alert.restoreError ? <p className="mt-1 text-sm text-danger">{alert.restoreError}</p> : null}
          {alert.revokeError ? <p className="mt-1 text-sm text-danger">{alert.revokeError}</p> : null}
          <p className="mt-1 text-right text-sm font-semibold tabular-nums text-text-2">{alert.openCount} opens</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => ack(alert.id)}>Acknowledge</Button>
            {!alert.revokedAt ? (
              <Button variant="danger" onClick={() => revoke(alert.id)}>
                Revoke Sera4 key
              </Button>
            ) : null}
          </div>
        </article>
      ))}
      {alerts.length ? (
        <div className="card">
          <Pager page={pager.page} pages={pager.pages} total={pager.total} onPage={pager.setPage} noun="alerts" />
        </div>
      ) : null}
    </section>
  );
}

function DoneAlerts({ alerts }: { alerts: AlertRow[] }) {
  const pager = usePager(alerts, 4);
  return (
    <section className="space-y-3">
      <h2 className="text-[15px] font-semibold">Acknowledged</h2>
      {pager.slice.map((alert) => (
        <article key={alert.id} className="card p-5 opacity-70">
          <div className="flex items-center justify-between gap-3">
            <AlertKind kind={alert.kind} />
            <p className="text-sm text-text-2">{new Date(alert.occurredAt).toLocaleString()}</p>
          </div>
          <p className="mt-3 text-sm">{alert.message}</p>
        </article>
      ))}
      <div className="card">
        <Pager page={pager.page} pages={pager.pages} total={pager.total} onPage={pager.setPage} noun="alerts" />
      </div>
    </section>
  );
}
