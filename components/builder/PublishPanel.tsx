"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Check, CheckCircle2, Info, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { publishAction, readinessAction } from "@/app/(builder)/app/builder/actions";
import type { Readiness, Severity } from "@/lib/builder/readiness";

/*
 * Blueprint section 59's publication panel.
 *
 * It shows what is wrong before asking a merchant to commit, and it
 * distinguishes the three kinds of wrong — because a shop with no products is
 * publishable and a shop with no delivery option is not. Treating those the
 * same either blocks people needlessly or lets them ship something broken.
 *
 * What it deliberately does not do is perform a fake multi-step progress
 * animation. Publishing is one fast transaction; inventing "Building
 * snapshot… Updating routing…" would be theatre, and the merchant would learn
 * to distrust the next progress bar they see.
 */

const TONE: Record<Severity, { icon: typeof Info; className: string; label: string }> = {
  blocker: { icon: AlertTriangle, className: "text-danger", label: "Needs fixing first" },
  warning: { icon: AlertTriangle, className: "text-warning", label: "Worth doing" },
  suggestion: { icon: Info, className: "text-muted", label: "When you get a chance" },
};

export function PublishPanel({
  open,
  onClose,
  storeSlug,
  onPublished,
}: {
  open: boolean;
  onClose: () => void;
  storeSlug: string;
  onPublished: (version: number) => void;
}) {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [publishing, startPublish] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let current = true;
    readinessAction()
      .then((r) => current && setReadiness(r))
      .catch(() => current && setReadiness({ items: [], blockers: [], canPublish: true }));
    return () => {
      current = false;
    };
  }, [open]);

  if (!open) return null;

  const grouped: Severity[] = ["blocker", "warning", "suggestion"];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[var(--bh-overlay)]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Publish your shop"
    >
      <div
        className="bg-surface border-border flex h-full w-full max-w-md flex-col border-l shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-border flex items-start justify-between border-b px-5 py-4">
          <div>
            <p className="font-display text-lg">Publish your shop</p>
            <p className="text-muted mt-0.5 text-xs">
              Everything you&rsquo;ve changed becomes live at /s/{storeSlug}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-text grid size-8 shrink-0 place-items-center rounded-md transition-colors"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {readiness === null ? (
            <p className="text-muted flex items-center gap-2 text-sm">
              <Loader2 className="size-3.5 animate-spin" />
              Checking your shop
            </p>
          ) : readiness.items.length === 0 ? (
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="text-success size-5" />
              <p className="text-text text-sm">Everything looks ready.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {grouped.map((severity) => {
                const group = readiness.items.filter((i) => i.severity === severity);
                if (group.length === 0) return null;
                const { icon: Icon, className, label } = TONE[severity];
                return (
                  <section key={severity}>
                    <p className="text-faint mb-2.5 text-[0.65rem] font-medium tracking-[0.14em] uppercase">
                      {label}
                    </p>
                    <ul className="flex flex-col gap-3">
                      {group.map((item) => (
                        <li key={item.id} className="flex gap-2.5">
                          <Icon className={cn("mt-0.5 size-4 shrink-0", className)} />
                          <div className="min-w-0">
                            <p className="text-text text-sm">{item.label}</p>
                            <p className="text-muted mt-0.5 text-xs leading-relaxed">
                              {item.detail}
                            </p>
                            {item.href ? (
                              <a
                                href={item.href}
                                className="text-accent hover:text-accent-hover mt-1 inline-block text-xs underline underline-offset-4"
                              >
                                Fix now
                              </a>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <footer className="border-border border-t px-5 py-4">
          {error ? (
            <p role="alert" className="text-danger mb-3 text-sm">
              {error}
            </p>
          ) : null}

          <Button
            size="lg"
            className="w-full"
            disabled={publishing || readiness === null || !readiness.canPublish}
            onClick={() =>
              startPublish(async () => {
                setError(null);
                const result = await publishAction();
                if (result.ok) {
                  onPublished(result.versionNumber ?? 0);
                  onClose();
                } else {
                  setError(result.message ?? "Publishing didn't work.");
                }
              })
            }
          >
            {publishing ? <Loader2 className="size-4 animate-spin" /> : null}
            {publishing ? "Publishing" : "Publish my shop"}
          </Button>

          {readiness && !readiness.canPublish ? (
            <p className="text-muted mt-2.5 text-center text-xs">
              Fix the item{readiness.blockers.length === 1 ? "" : "s"} above first.
            </p>
          ) : (
            <p className="text-faint mt-2.5 text-center text-xs">
              You can publish again any time. Every version is kept.
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}

/** The small tick shown beside a satisfied check. Kept here so the panel owns its vocabulary. */
export function ReadyTick() {
  return (
    <span className="bg-success text-on-accent grid size-4 place-items-center rounded-full">
      <Check className="size-2.5" strokeWidth={3} />
    </span>
  );
}
