import type { Metadata } from "next";

import { Badge, Card } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/platform/guard";
import { loadAuditLog } from "@/lib/platform/queries";

export const metadata: Metadata = { title: "Audit log" };

const TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "accent"> = {
  "store.created": "success",
  "store.published": "accent",
  "store.suspended": "danger",
  "store.restored": "success",
  "order.placed": "neutral",
  "order.paid": "success",
  "order.refunded": "warning",
  "order.status_changed": "neutral",
  "domain.added": "accent",
};

export default async function AdminAuditPage() {
  const actor = await requirePlatformAdmin();
  const entries = await loadAuditLog(actor.userId, 150);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl leading-tight">Audit log</h1>
        <p className="text-muted mt-1.5 text-sm">
          Append-only. Every entry is written in the same transaction as the thing it
          describes, so an action cannot succeed while its record of happening fails.
        </p>
      </header>

      <Card className="overflow-hidden">
        <ul className="divide-border divide-y">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <span className="text-faint w-36 shrink-0 text-xs tabular-nums">
                {new Date(entry.createdAt).toLocaleString(undefined, {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <Badge tone={TONE[entry.action] ?? "neutral"}>{entry.action}</Badge>
              <span className="text-text min-w-0 flex-1 truncate text-sm">
                {entry.tenantName ?? "—"}
              </span>
              <span className="text-muted truncate text-xs">{entry.actorEmail ?? "system"}</span>
            </li>
          ))}
          {entries.length === 0 ? (
            <li className="text-muted px-4 py-10 text-center text-sm">Nothing recorded yet.</li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
