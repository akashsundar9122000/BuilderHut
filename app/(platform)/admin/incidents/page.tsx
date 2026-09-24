import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Badge, Button, Card } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/platform/guard";
import { loadIncidents, loadIncidentSummary, type IncidentRow } from "@/lib/platform/incidents";
import { resolveIncidentAction } from "./actions";

export const metadata: Metadata = { title: "Incidents" };

/*
 * Things that went wrong, where somebody will see them.
 *
 * Until platform_incidents existed, every one of these was a console.error in
 * the hosting provider's log stream: searchable by whoever remembered to look,
 * gone after the retention window, and invisible to the person whose job is to
 * notice. A payment taken while the order stayed unpaid is the case that
 * matters — nothing else in the product surfaces it.
 */

const TONE: Record<string, "neutral" | "warning" | "danger"> = {
  info: "neutral",
  warning: "warning",
  error: "danger",
};

export default async function AdminIncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const actor = await requirePlatformAdmin();
  const { all } = await searchParams;
  const includeResolved = all === "1";

  const [incidents, summary] = await Promise.all([
    loadIncidents(actor.userId, { includeResolved }),
    loadIncidentSummary(actor.userId),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl leading-tight">Incidents</h1>
          <p className="text-muted mt-1.5 text-sm">
            {summary.outstanding === 0
              ? "Nothing outstanding."
              : `${summary.outstanding} outstanding, ${summary.errors24h} error${
                  summary.errors24h === 1 ? "" : "s"
                } in the last 24 hours.`}
          </p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href={includeResolved ? "/admin/incidents" : "/admin/incidents?all=1"}>
            {includeResolved ? "Outstanding only" : "Include resolved"}
          </Link>
        </Button>
      </header>

      {summary.topKinds.length > 0 ? (
        <Card className="mb-5 px-4 py-3">
          <p className="text-muted mb-2 text-xs tracking-[0.12em] uppercase">
            Most frequent this week
          </p>
          <div className="flex flex-wrap gap-2">
            {summary.topKinds.map((k) => (
              <span key={k.kind} className="bg-raised text-text-secondary rounded-full px-2.5 py-1 text-xs">
                {k.kind} · {k.count}
              </span>
            ))}
          </div>
        </Card>
      ) : null}

      {incidents.length === 0 ? (
        <Card className="px-5 py-10 text-center">
          <CheckCircle2 className="text-success mx-auto size-6" aria-hidden="true" />
          <p className="text-text mt-3">Nothing has gone wrong</p>
          <p className="text-muted mx-auto mt-1.5 max-w-sm text-sm">
            Failed emails, rejected payment webhooks and cron runs that threw are
            recorded here as they happen. An empty list is the good outcome, not a
            missing feature.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-border divide-y">
            {incidents.map((incident) => (
              <IncidentLine key={incident.id} incident={incident} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function IncidentLine({ incident }: { incident: IncidentRow }) {
  const when = new Date(incident.createdAt);
  const resolved = incident.resolvedAt !== null;

  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3.5">
      <span className="text-faint w-32 shrink-0 pt-0.5 text-xs tabular-nums">
        {when.toLocaleString(undefined, {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={TONE[incident.severity] ?? "neutral"}>{incident.severity}</Badge>
          <span className="text-muted font-mono text-xs">{incident.kind}</span>
          {resolved ? <Badge tone="success">resolved</Badge> : null}
        </div>

        <p className="text-text mt-1.5 text-sm">{incident.summary}</p>

        {incident.tenantName ? (
          <p className="text-muted mt-0.5 text-xs">
            {incident.tenantName}
            {incident.tenantSlug ? ` · /${incident.tenantSlug}` : ""}
          </p>
        ) : (
          <p className="text-faint mt-0.5 text-xs">Platform-wide — no single store</p>
        )}

        {/*
         * Collapsed by default. The detail is what an operator needs the
         * moment they are investigating and noise every other moment, and a
         * <details> costs no JavaScript to do that.
         */}
        {incident.detail ? (
          <details className="mt-2">
            <summary className="text-muted hover:text-text cursor-pointer text-xs">
              Detail
            </summary>
            <pre className="bg-sunken text-text-secondary mt-2 overflow-x-auto rounded-md p-3 text-xs">
              {JSON.stringify(incident.detail, null, 2)}
            </pre>
          </details>
        ) : null}
      </div>

      {!resolved ? (
        <form action={resolveIncidentAction} className="shrink-0">
          <input type="hidden" name="id" value={incident.id} />
          <Button type="submit" variant="ghost" size="sm">
            Mark done
          </Button>
        </form>
      ) : null}
    </li>
  );
}
