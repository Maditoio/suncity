"use client";

import { useEffect, useState } from "react";
import { Pager, usePager } from "@/components/pagination";
import { Card, EmptyState, PageHeader } from "@/components/ui";

type Log = {
  id: number;
  actorUsername: string;
  actorRole: string;
  action: string;
  detail: string | null;
  createdAt: string;
};

const labels: Record<string, string> = {
  signed_in: "Signed in",
  signed_out: "Signed out",
  login_failed: "Failed sign-in",
  updated_settings: "Updated settings",
  created_user: "Created user",
  deleted_user: "Deleted user",
  pulled_history: "Pulled access history",
  refreshed_token: "Refreshed Sera4 token",
  acknowledged_alert: "Acknowledged alert",
  revoked_key: "Revoked Sera4 key",
  denied_admin: "Denied admin page",
};

export default function ActivityPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/audit");
      const json = (await response.json()) as { logs?: Log[] };
      setLogs(json.logs || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity log"
        description="Every admin and operator action is recorded here, including sign-in, settings changes, and occupancy actions."
      />
      {loading ? <p className="text-sm text-text-2">Loading…</p> : <ActivityList logs={logs} />}
    </div>
  );
}

function ActivityList({ logs }: { logs: Log[] }) {
  const pager = usePager(logs, 10);
  if (logs.length === 0) {
    return (
      <Card>
        <EmptyState title="No actions yet" description="Sign-ins and changes will appear here." />
      </Card>
    );
  }
  return (
    <div className="card overflow-hidden">
      <table className="table">
        <thead>
          <tr>
            <th>When</th>
            <th>User</th>
            <th>Role</th>
            <th>Action</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {pager.slice.map((log) => (
            <tr key={log.id}>
              <td className="whitespace-nowrap text-text-2">{new Date(log.createdAt).toLocaleString()}</td>
              <td className="font-medium">{log.actorUsername}</td>
              <td className="capitalize text-text-2">{log.actorRole}</td>
              <td>{labels[log.action] || log.action}</td>
              <td className="text-text-2">{log.detail || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager page={pager.page} pages={pager.pages} total={pager.total} onPage={pager.setPage} noun="actions" />
    </div>
  );
}
