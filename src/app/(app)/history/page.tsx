"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { StatusPill } from "@/components/Pills";
import { Button, EmptyState, Field, Input, PageHeader } from "@/components/ui";

type EventRow = {
  id: number;
  source: string;
  lockId: string | null;
  lockName: string | null;
  siteName: string | null;
  hardwareId: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  occurredAt: string;
};

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export default function HistoryPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState(todayYmd());
  const [to, setTo] = useState(todayYmd());
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load(range = { from, to }) {
    setLoading(true);
    const params = new URLSearchParams();
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
    const response = await fetch(`/api/history?${params}`);
    const json = (await response.json()) as { events: EventRow[] };
    setEvents(json.events || []);
    setLoading(false);
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setQuery(q);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sync() {
    setSyncing(true);
    setMessage("");
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const response = await fetch(`/api/sera4?${params}`);
    const json = (await response.json()) as {
      error?: string;
      ingested?: { inserted: number };
      recordCount?: number;
    };
    if (!response.ok) setMessage(json.error || "Could not fetch history");
    else {
      setMessage(
        `Fetched ${json.recordCount ?? 0} records between ${from} and ${to}, stored ${json.ingested?.inserted ?? 0} new opens/closes.`,
      );
    }
    await load({ from, to });
    setSyncing(false);
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return events.filter((event) =>
      [event.userName, event.userEmail, event.userId, event.action, event.lockName, event.siteName, event.hardwareId]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [events, query]);

  return (
    <div>
      <PageHeader
        title="Access history"
        description="Pick a from and to date, then fetch only that range from Sera4."
        actions={
          <Button onClick={sync} disabled={syncing || !from || !to}>
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Fetch from Sera4
          </Button>
        }
      />
      {message ? <p className="mb-4 text-sm text-text-2">{message}</p> : null}
      <div className="card mb-4 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="From">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="User">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or email" />
        </Field>
        <div className="flex items-end">
          <Button variant="secondary" type="button" onClick={() => void load({ from, to })} className="w-full">
            Filter saved
          </Button>
        </div>
      </div>
      <div className="table-wrap">
        {loading ? (
          <EmptyState title="Loading records…" />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matching records" description="Try another date range or fetch from Sera4." />
        ) : (
          <table className="table min-w-[720px]">
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
              {filtered.map((event) => (
                <tr key={event.id}>
                  <td className="whitespace-nowrap text-text-2">{new Date(event.occurredAt).toLocaleString()}</td>
                  <td>
                    <p className="font-medium">{event.userName || event.userEmail || event.userId || "Unknown"}</p>
                    <p className="text-xs text-text-2">{event.userEmail || event.userId || "No email"}</p>
                  </td>
                  <td>
                    <p className="font-medium">{event.lockName || event.lockId || "—"}</p>
                    <p className="text-xs text-text-2">
                      {[event.siteName, event.hardwareId ? `HW ${event.hardwareId}` : null, event.lockId ? `ID ${event.lockId}` : null]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </td>
                  <td>
                    <StatusPill open={event.action === "open" ? true : event.action === "close" ? false : null} />
                  </td>
                  <td className="capitalize text-text-2">{event.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
