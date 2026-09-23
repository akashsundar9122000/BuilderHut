"use client";

import { useActionState, useState } from "react";
import { Check, ChevronDown, Circle, Copy, Globe, Loader2, Plus } from "lucide-react";

import { Badge, Button, Card, CardBody, Field, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  addDomainAction,
  removeDomainAction,
  setPrimaryAction,
  verifyDomainAction,
  type DomainState,
} from "@/app/(dashboard)/app/domains/actions";
import type { DomainView } from "@/lib/domains/service";

/*
 * Blueprint section 29's visible timeline.
 *
 * DNS is the step merchants get stuck on, and the useful thing a screen can do
 * is say exactly which checkpoint they are at and what was actually found —
 * "a CNAME exists but points at somewhere else" is actionable; "verification
 * failed" is not.
 */

const STEPS = ["Added", "DNS pointing here", "Ownership proven", "Serving traffic"] as const;

function reached(domain: DomainView): number {
  if (domain.status === "active") return 4;
  if (domain.status === "verified") return 3;
  if (domain.status === "misconfigured") return 2;
  return 1;
}

export function AddDomainForm() {
  const [state, submit, pending] = useActionState<DomainState, FormData>(addDomainAction, {});
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" />
        Connect a domain
      </Button>
    );
  }

  return (
    <form action={submit} className="border-border bg-raised flex flex-col gap-3 rounded-lg border p-4">
      <Field
        label="Your domain"
        htmlFor="hostname"
        error={state.error}
        hint="Paste it however you have it — we'll tidy up the https:// and any trailing slash."
      >
        <Input id="hostname" name="hostname" placeholder="www.mystore.com" required />
      </Field>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Add domain
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function DomainCard({ domain }: { domain: DomainView }) {
  const [state, verify, checking] = useActionState<DomainState, FormData>(verifyDomainAction, {});
  const [showRecords, setShowRecords] = useState(domain.status !== "active");
  const step = reached(domain);

  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Globe className="text-muted size-4 shrink-0" />
          <span className="text-text font-mono text-sm">{domain.normalizedHostname}</span>
          {domain.isPrimary ? <Badge tone="accent">Main address</Badge> : null}
          <Badge
            tone={
              domain.status === "active"
                ? "success"
                : domain.status === "verified"
                  ? "info"
                  : domain.status === "misconfigured"
                    ? "warning"
                    : "neutral"
            }
          >
            {domain.status === "misconfigured" ? "Needs attention" : domain.status}
          </Badge>

          <div className="ml-auto flex items-center gap-2">
            <form action={verify}>
              <input type="hidden" name="id" value={domain.id} />
              <Button type="submit" size="sm" variant="secondary" disabled={checking}>
                {checking ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {checking ? "Checking DNS" : "Check now"}
              </Button>
            </form>

            {!domain.isPrimary && (domain.status === "verified" || domain.status === "active") ? (
              <form action={setPrimaryAction}>
                <input type="hidden" name="id" value={domain.id} />
                <Button type="submit" size="sm" variant="ghost">
                  Make main
                </Button>
              </form>
            ) : null}

            <form action={removeDomainAction}>
              <input type="hidden" name="id" value={domain.id} />
              <Button type="submit" size="sm" variant="ghost" className="text-muted">
                Disconnect
              </Button>
            </form>
          </div>
        </div>

        {/* The timeline. */}
        <ol className="mt-5 flex flex-col gap-0 sm:flex-row sm:items-center">
          {STEPS.map((label, i) => {
            const done = i < step;
            return (
              <li key={label} className="flex flex-1 items-center gap-2.5 py-1.5">
                {done ? (
                  <span className="bg-success text-on-accent grid size-5 shrink-0 place-items-center rounded-full">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                ) : (
                  <Circle className="text-border-strong size-5 shrink-0" strokeWidth={1.5} />
                )}
                <span className={done ? "text-text text-xs" : "text-muted text-xs"}>{label}</span>
                {i < STEPS.length - 1 ? (
                  <span className="bg-border mx-1 hidden h-px flex-1 sm:block" />
                ) : null}
              </li>
            );
          })}
        </ol>

        {state.detail ?? domain.lastCheckDetail ? (
          <p className="text-muted mt-3 text-xs leading-relaxed">
            {state.detail ?? domain.lastCheckDetail}
            {domain.dnsCheckedAt ? (
              <span className="text-faint">
                {" "}
                Last checked {new Date(domain.dnsCheckedAt).toLocaleTimeString()}.
              </span>
            ) : null}
          </p>
        ) : null}

        <button
          onClick={() => setShowRecords((v) => !v)}
          className="text-muted hover:text-text mt-4 flex items-center gap-1.5 text-xs transition-colors"
        >
          <ChevronDown className={cn("size-3.5 transition-transform", showRecords && "rotate-180")} />
          {showRecords ? "Hide" : "Show"} the records to add
        </button>

        {showRecords ? (
          <div className="mt-3 flex flex-col gap-3">
            {domain.records.map((record) => (
              <div key={record.kind} className="border-border bg-raised rounded-md border p-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Badge>{record.kind}</Badge>
                  <code className="text-text text-xs break-all">{record.name}</code>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <code className="text-text-secondary bg-surface border-border flex-1 rounded border px-2 py-1.5 text-xs break-all">
                    {record.value}
                  </code>
                  <CopyButton value={record.value} />
                </div>
                <p className="text-faint mt-2 text-xs">{record.why}</p>
              </div>
            ))}

            <p className="text-faint text-xs leading-relaxed">
              DNS changes can take anything from a minute to a few hours to spread. Add the
              records, then press &ldquo;Check now&rdquo; — nothing breaks if it isn&rsquo;t ready yet.
            </p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // Clipboard blocked. The value is selectable, so this is a convenience.
        }
      }}
      className="text-muted hover:text-text hover:bg-raised grid size-8 shrink-0 place-items-center rounded-md transition-colors"
    >
      {copied ? <Check className="text-success size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}
