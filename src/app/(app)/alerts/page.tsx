"use client";

import { useEffect, useState } from "react";
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
      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold">Needs attention</h2>
        {loading ? <p className="text-sm text-text-2">Loading…</p> : null}
        {!loading && open.length === 0 ? (
          <Card>
            <EmptyState title="No open alerts" description="Occupancy is within the configured limit." />
          </Card>
        ) : null}
        {open.map((alert) => (
          <article key={alert.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <AlertKind kind={alert.kind} />
              <p className="text-sm text-text-2">{new Date(alert.occurredAt).toLocaleString()}</p>
            </div>
            <p className="mt-3 text-[15px] leading-6">{alert.message}</p>
            <p className="mt-1 text-right text-sm font-semibold tabular-nums text-text-2">{alert.openCount} opens</p>
            <Button onClick={() => ack(alert.id)} className="mt-4">
              Acknowledge
            </Button>
          </article>
        ))}
      </section>
      {done.length ? (
        <section className="space-y-3">
          <h2 className="text-[15px] font-semibold">Acknowledged</h2>
          {done.map((alert) => (
            <article key={alert.id} className="card p-5 opacity-70">
              <div className="flex items-center justify-between gap-3">
                <AlertKind kind={alert.kind} />
                <p className="text-sm text-text-2">{new Date(alert.occurredAt).toLocaleString()}</p>
              </div>
              <p className="mt-3 text-sm">{alert.message}</p>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
