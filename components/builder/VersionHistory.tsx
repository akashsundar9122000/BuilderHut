"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui";
import { listVersionsAction, restoreVersionAction } from "@/app/(builder)/app/builder/actions";
import type { VersionSummary } from "@/lib/builder/service";

/*
 * Blueprint section 6.9.
 *
 * Restoring copies an old version into the DRAFT rather than making it live.
 * A single click silently changing what customers see, with no chance to look
 * at it first, would not be a feature. Published versions stay immutable either
 * way, so nothing here can destroy history.
 */
export function VersionHistory({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [restoring, startRestore] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  /*
   * Keyed on the open count rather than clearing state synchronously: setting
   * `versions` to null in the effect body would be a second render on every
   * open. Comparing the request's key against the current one also discards a
   * response that arrives after the drawer has been closed and reopened.
   */
  useEffect(() => {
    if (!open) return;
    let current = true;
    listVersionsAction()
      .then((rows) => {
        if (current) setVersions(rows);
      })
      .catch(() => {
        if (current) setVersions([]);
      });
    return () => {
      current = false;
    };
  }, [open]);

  if (!open) return null;


  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[var(--bh-overlay)]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Version history"
    >
      {/* A drawer, not a modal — blueprint section 18 prefers these, and it
          leaves the canvas visible behind so there is context for the choice. */}
      <div
        className="bg-surface border-border flex h-full w-full max-w-sm flex-col border-l shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-border flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-text text-sm font-medium">Version history</p>
            <p className="text-muted mt-0.5 text-xs">Every publish is kept.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-text grid size-8 place-items-center rounded-md transition-colors"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {versions === null ? (
            <p className="text-muted flex items-center gap-2 px-4 py-6 text-sm">
              <Loader2 className="size-3.5 animate-spin" /> Loading
            </p>
          ) : versions.length === 0 ? (
            <p className="text-muted px-4 py-6 text-sm">Nothing published yet.</p>
          ) : (
            <ul className="divide-border divide-y">
              {versions.map((version) => (
                <li key={version.id} className="flex items-start gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-text flex items-center gap-2 text-sm font-medium">
                      Version {version.versionNumber}
                      {version.isLive ? (
                        <span className="bg-success-soft text-success inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem]">
                          <Check className="size-2.5" strokeWidth={3} /> Live
                        </span>
                      ) : null}
                    </p>
                    <p className="text-muted mt-0.5 text-xs">
                      {new Date(version.createdAt).toLocaleString()}
                    </p>
                    {version.note ? (
                      <p className="text-faint mt-1 text-xs">{version.note}</p>
                    ) : null}
                  </div>
                  {!version.isLive ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={restoring}
                      onClick={() =>
                        startRestore(async () => {
                          const result = await restoreVersionAction(version.id);
                          setMessage(
                            result.ok
                              ? "Restored into your draft. Reload the builder to see it, then publish when you're happy."
                              : (result.message ?? "That didn't work."),
                          );
                        })
                      }
                    >
                      Restore
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {message ? (
          <p className="border-border bg-raised text-text-secondary border-t px-4 py-3 text-xs leading-relaxed">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
