import type { Metadata } from "next";

import { Badge, Card } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/platform/guard";
import { loadDomains, type DomainRow } from "@/lib/platform/queries";

export const metadata: Metadata = { title: "Domains" };

/*
 * Every custom domain on the platform.
 *
 * Sorted by who needs help rather than by date: `misconfigured` and `pending`
 * are merchants stuck partway through a DNS change, and they are the only
 * reason this screen is worth opening. Verified and active rows sort to the
 * bottom because nobody has to do anything about them.
 */

const TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "accent"> = {
  active: "success",
  verified: "accent",
  pending: "warning",
  misconfigured: "danger",
  disabled: "neutral",
};

/** What the operator should understand from each state, in plain words. */
const MEANS: Record<string, string> = {
  active: "Serving traffic.",
  verified: "DNS is right and ownership is proven; not yet serving.",
  pending: "Added, nothing checked yet.",
  misconfigured: "A DNS record exists but does not point here.",
  disabled: "Taken out of service.",
};

export default async function AdminDomainsPage() {
  const actor = await requirePlatformAdmin();
  const domains = await loadDomains(actor.userId);

  const needsAttention = domains.filter(
    (d) => d.status === "pending" || d.status === "misconfigured",
  ).length;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl leading-tight">Domains</h1>
        <p className="text-muted mt-1.5 text-sm">
          {domains.length === 0
            ? "No merchant has connected a domain yet."
            : `${domains.length} connected. ${
                needsAttention === 0
                  ? "None are waiting on anything."
                  : `${needsAttention} waiting on DNS.`
              }`}
        </p>
      </header>

      {domains.length === 0 ? (
        <Card className="px-5 py-10 text-center">
          <p className="text-text">Nothing to show</p>
          <p className="text-muted mx-auto mt-1.5 max-w-sm text-sm">
            Every shop is reachable at its BuilderHut address from the moment it is
            published. This screen fills up once merchants start bringing addresses
            of their own.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-border divide-y">
            {domains.map((domain) => (
              <DomainLine key={domain.id} domain={domain} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function DomainLine({ domain }: { domain: DomainRow }) {
  const checked = domain.dnsCheckedAt ? new Date(domain.dnsCheckedAt) : null;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-text truncate font-medium">{domain.hostname}</span>
          {domain.isPrimary ? <Badge tone="neutral">Primary</Badge> : null}
        </div>
        <p className="text-muted mt-0.5 truncate text-xs">
          {domain.tenantName ?? "Store deleted"}
          {domain.tenantSlug ? ` · /${domain.tenantSlug}` : ""}
        </p>
        {/*
         * The reason, when there is one. A merchant who cannot get a domain
         * working is going to ask, and "misconfigured" on its own does not
         * answer them — what the last check actually saw does.
         */}
        {domain.lastCheckDetail ? (
          <p className="text-faint mt-1 text-xs">{domain.lastCheckDetail}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge tone={TONE[domain.status] ?? "neutral"}>{domain.status}</Badge>
        <span className="text-faint text-xs">
          {checked ? `checked ${checked.toLocaleDateString()}` : "never checked"}
        </span>
      </div>

      <p className="text-muted basis-full text-xs sm:basis-auto sm:text-right">
        {MEANS[domain.status] ?? ""}
      </p>
    </li>
  );
}
