import type { Metadata } from "next";
import { Globe } from "lucide-react";

import { AddDomainForm, DomainCard } from "@/components/dashboard/DomainPanel";
import { Card, CardBody, EmptyState } from "@/components/ui";
import { requireActor } from "@/lib/auth/session";
import { listDomains } from "@/lib/domains/service";

export const metadata: Metadata = { title: "Domains" };

export default async function DomainsPage() {
  const actor = await requireActor();
  const domains = await listDomains();

  return (
    <div className="mx-auto max-w-(--bh-dash-w)">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl leading-tight">Domains</h1>
          <p className="text-muted mt-1.5 text-sm">
            Your own web address, instead of the one we gave you.
          </p>
        </div>
        <AddDomainForm />
      </header>

      <Card className="mb-5">
        <CardBody className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Globe className="text-muted size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-text text-sm">Your BuilderHut address</p>
            <p className="text-muted font-mono text-xs break-all">/s/{actor.tenantSlug}</p>
          </div>
          <p className="text-faint max-w-xs text-xs leading-relaxed">
            This keeps working forever, even after you connect your own domain. Old links
            never break.
          </p>
        </CardBody>
      </Card>

      {domains.length === 0 ? (
        <EmptyState
          icon={<Globe />}
          title="No domain connected"
          description="Connect one you already own and we'll show you exactly which DNS records to add."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {domains.map((domain) => (
            <DomainCard key={domain.id} domain={domain} />
          ))}
        </div>
      )}

      {/*
        Honest about the boundary. Verification below is a real DNS lookup, but
        connecting a domain to this deployment and issuing its certificate is a
        step BuilderHut does not yet perform — saying so is better than a
        merchant pointing customers at a domain that will not load.
      */}
      <div className="border-warning/30 bg-warning-soft mt-6 rounded-lg border p-4">
        <p className="text-text text-sm font-medium">Before you point customers at it</p>
        <p className="text-text-secondary mt-1.5 text-sm leading-relaxed">
          BuilderHut checks your DNS records for real, but it does not yet add the domain to
          the hosting platform or issue its certificate — so a verified domain will not serve
          your shop until that last step is done by hand. Buying domains through BuilderHut
          is designed and not yet built.
        </p>
      </div>
    </div>
  );
}
