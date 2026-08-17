export function StatusPill({ open }: { open: boolean | null }) {
  if (open == null) {
    return (
      <span className="inline-flex rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-text-2">Unknown</span>
    );
  }
  return open ? (
    <span className="inline-flex rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-medium text-warn">Open</span>
  ) : (
    <span className="inline-flex rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">Closed</span>
  );
}

export function AlertKind({ kind }: { kind: string }) {
  return kind === "burst" ? (
    <span className="inline-flex rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-medium text-danger">Burst</span>
  ) : (
    <span className="inline-flex rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-medium text-warn">Daily</span>
  );
}
