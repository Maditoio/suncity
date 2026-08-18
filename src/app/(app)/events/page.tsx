"use client";

import { useEffect, useState } from "react";
import { Pager, usePager } from "@/components/pagination";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";

type Log = {
  id: number;
  receivedAt: string;
  method: string;
  body: string;
  parsedOk: boolean;
  note: string | null;
};

export default function EventsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const response = await fetch("/api/events");
    const json = (await response.json()) as { logs: Log[] };
    setLogs(json.logs || []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhook log"
        description="Sera4 calls this app when the lock opens or closes. Each callback is stored, counted per user, and turned into an alert if they exceed the limit."
        actions={
          <Button
            variant="secondary"
            onClick={async () => {
              await fetch("/api/simulate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userName: "Demo user", action: "open" }),
              });
              await load();
            }}
          >
            Simulate a lock open
          </Button>
        }
      />
      <Card title="How the webhook works">
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-text-2">
          <li>Copy the webhook URL from Settings and paste it into Sera4 as the lock open/close callback.</li>
          <li>When someone opens or closes the lock, Sera4 POSTs that event to Inclusive Lock Monitor immediately.</li>
          <li>We record who opened it, then count that user’s opens in the burst window and for the day.</li>
          <li>If they go beyond 4 opens, an alert appears. Pulling access history does the same check for past records.</li>
        </ol>
        <p className="mt-3 text-sm text-text-2">
          Local testing cannot receive Sera4 calls until the public app URL is internet-reachable (for example ngrok).
        </p>
      </Card>
      {loading ? <p className="text-sm text-text-2">Loading…</p> : <WebhookList logs={logs} />}
    </div>
  );
}

function WebhookList({ logs }: { logs: Log[] }) {
  const pager = usePager(logs, 5);
  if (logs.length === 0) {
    return (
      <Card>
        <EmptyState title="No webhook calls yet" description="Simulate an open or wait for Sera4." />
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {pager.slice.map((log) => (
        <article key={log.id} className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p>
              <span className="font-semibold">{log.method}</span>
              <span className="text-text-2"> · {new Date(log.receivedAt).toLocaleString()}</span>
            </p>
            <span className={log.parsedOk ? "text-accent" : "text-warn"}>{log.parsedOk ? "Parsed" : "Raw only"}</span>
          </div>
          {log.note ? <p className="mt-2 text-sm">{log.note}</p> : null}
          <pre className="mt-3 max-h-40 overflow-auto rounded-[8px] bg-[#12151c] px-3 py-3 text-xs text-[#e8ecf2]">
            {pretty(log.body)}
          </pre>
        </article>
      ))}
      <div className="card">
        <Pager page={pager.page} pages={pager.pages} total={pager.total} onPage={pager.setPage} noun="calls" />
      </div>
    </div>
  );
}

function pretty(body: string) {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
