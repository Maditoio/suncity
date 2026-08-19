import { ensureDb } from "./db";

export type AuditEntry = {
  id: number;
  actorId: number | null;
  actorUsername: string;
  actorRole: string;
  action: string;
  detail: string | null;
  createdAt: string;
};

export async function logAction(input: {
  actorId?: number | null;
  actorUsername: string;
  actorRole?: string | null;
  action: string;
  detail?: string | null;
}) {
  try {
    const sql = await ensureDb();
    await sql`
      INSERT INTO audit_logs (actor_id, actor_username, actor_role, action, detail, created_at)
      VALUES (
        ${input.actorId ?? null},
        ${input.actorUsername},
        ${input.actorRole || "unknown"},
        ${input.action},
        ${input.detail || null},
        ${new Date().toISOString()}
      )
    `;
  } catch (error) {
    console.error("Could not write audit log", error);
  }
}

export async function listAuditLogs(limit = 200): Promise<AuditEntry[]> {
  const sql = await ensureDb();
  const rows = await sql<
    {
      id: number;
      actor_id: number | null;
      actor_username: string;
      actor_role: string;
      action: string;
      detail: string | null;
      created_at: string;
    }[]
  >`
    SELECT * FROM audit_logs ORDER BY id DESC LIMIT ${limit}
  `;
  return rows.map((row) => ({
    id: Number(row.id),
    actorId: row.actor_id == null ? null : Number(row.actor_id),
    actorUsername: row.actor_username,
    actorRole: row.actor_role,
    action: row.action,
    detail: row.detail,
    createdAt: row.created_at,
  }));
}
