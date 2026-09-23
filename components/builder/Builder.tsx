"use client";

import { useCallback, useState } from "react";
import { CheckCircle2, X } from "lucide-react";

import { Canvas } from "./Canvas";
import { Inspector } from "./Inspector";
import { LeftPanel } from "./LeftPanel";
import { TopBar } from "./TopBar";
import { PublishPanel } from "./PublishPanel";
import { VersionHistory } from "./VersionHistory";
import { Button } from "@/components/ui";
import { BuilderProvider, type SaveResult } from "@/lib/builder/store";
import { saveDraftAction } from "@/app/(builder)/app/builder/actions";
import type { ProductCard } from "@/lib/render/context";
import type { SiteDocument } from "@/lib/schema/page";

/*
 * The builder, assembled.
 *
 * Three columns on desktop — library, canvas, inspector — with the canvas given
 * the room. On a phone the side panels become sheets rather than being squeezed
 * into slivers; blueprint section 54 is explicit that the mobile builder needs
 * its own pattern rather than a narrowed desktop one.
 */
export function Builder({
  initialDoc,
  initialRevision,
  storeSlug,
  products,
}: {
  initialDoc: SiteDocument;
  initialRevision: number;
  storeSlug: string;
  products: ProductCard[];
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [published, setPublished] = useState<number | null>(null);

  const save = useCallback(
    async (doc: SiteDocument, expectedRevision: number): Promise<SaveResult> => {
      const result = await saveDraftAction(doc, expectedRevision);
      if (result.ok) return { ok: true, revision: result.revision };
      if (result.conflict) {
        return { ok: false, conflict: true, revision: result.revision, serverDoc: result.serverDoc };
      }
      return { ok: false };
    },
    [],
  );

  return (
    <BuilderProvider initialDoc={initialDoc} initialRevision={initialRevision} save={save}>
      <div className="flex h-dvh flex-col overflow-hidden">
        <TopBar
          storeSlug={storeSlug}
          publishing={false}
          onOpenHistory={() => setHistoryOpen(true)}
          /*
           * Publishing opens a panel rather than firing immediately. A merchant
           * about to make something public deserves to see what is unfinished
           * first — blueprint section 59.
           */
          onPublish={() => setPublishOpen(true)}
        />

        {/*
         * One grid, two arrangements — and crucially each panel is rendered
         * ONCE. Rendering a desktop copy and a mobile copy duplicated every
         * control's DOM id, which silently broke every label's association with
         * its input: clicking a label focused the wrong field, and a screen
         * reader announced the label twice.
         *
         * Below lg the three columns would each be too narrow to use, so the
         * canvas takes the full width and the panels sit beneath it. A properly
         * compact phone inspector is Phase 7; this is usable on a tablet and
         * honest rather than broken.
         */}
        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[16rem_minmax(0,1fr)_20rem] lg:grid-rows-1">
          <div className="col-span-2 row-start-1 flex min-h-0 lg:col-span-1 lg:col-start-2">
            <Canvas products={products} />
          </div>

          <aside className="border-border bg-surface row-start-2 max-h-[42dvh] overflow-y-auto border-t border-r lg:row-start-1 lg:col-start-1 lg:max-h-none lg:border-t-0 lg:border-r">
            <LeftPanel />
          </aside>

          <aside className="border-border bg-surface row-start-2 max-h-[42dvh] overflow-y-auto border-t lg:row-start-1 lg:col-start-3 lg:max-h-none lg:border-t-0 lg:border-l">
            <Inspector />
          </aside>
        </div>
      </div>

      <VersionHistory open={historyOpen} onClose={() => setHistoryOpen(false)} />

      <PublishPanel
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        storeSlug={storeSlug}
        onPublished={(version) => setPublished(version)}
      />

      {published !== null ? (
        <PublishToast
          versionNumber={published}
          storeSlug={storeSlug}
          onClose={() => setPublished(null)}
        />
      ) : null}

    </BuilderProvider>
  );
}

/*
 * Blueprint section 59 asks for publish choreography. This is the honest
 * version of it: the work is a single fast transaction, so inventing a
 * multi-step progress animation would be theatre. What a merchant actually
 * wants at this moment is confirmation and a link.
 */
function PublishToast({
  versionNumber,
  storeSlug,
  onClose,
}: {
  versionNumber: number;
  storeSlug: string;
  onClose: () => void;
}) {
  return (
    <div
      role="status"
      className="border-border bg-surface fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-lg border px-4 py-3 shadow-lg"
      style={{ animation: "bh-rise 320ms cubic-bezier(0.22,1,0.36,1)" }}
    >
      <CheckCircle2 className="text-success size-5 shrink-0" />
      <div>
        <p className="text-text text-sm font-medium">Your store is live</p>
        <p className="text-muted text-xs">Version {versionNumber} published</p>
      </div>
      <Button asChild size="sm" variant="secondary">
        <a href={`/s/${storeSlug}`} target="_blank" rel="noreferrer">
          Visit
        </a>
      </Button>
      <button
        onClick={onClose}
        aria-label="Dismiss"
        className="text-muted hover:text-text transition-colors"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
