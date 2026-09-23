"use client";

import { useCallback, useState } from "react";
import { CheckCircle2, Layers, SlidersHorizontal, X } from "lucide-react";

import { Canvas } from "./Canvas";
import { Inspector } from "./Inspector";
import { LeftPanel } from "./LeftPanel";
import { TopBar } from "./TopBar";
import { PublishPanel } from "./PublishPanel";
import { VersionHistory } from "./VersionHistory";
import { PanelSheet } from "./PanelSheet";
import { Button } from "@/components/ui";
import { BuilderProvider, useBuilder, type SaveResult } from "@/lib/builder/store";
import { useIsPhone } from "@/lib/use-media-query";
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
         * Two layouts, and crucially each panel is rendered ONCE in each of
         * them. Rendering a desktop copy and a mobile copy duplicated every
         * control's DOM id, which silently broke every label's association with
         * its input: clicking a label focused the wrong field, and a screen
         * reader announced the label twice.
         *
         * On a phone the panels become sheets over a full-screen canvas — at
         * 375px two side-by-side columns are 180px each, which is the desktop
         * layout losing rather than a mobile layout. From `sm` up they sit
         * beneath the canvas, and from `lg` beside it.
         */}
        <BuilderBody products={products} />
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
 * The canvas and its two panels, arranged for the screen they are on.
 *
 * Split out of Builder so it can use `useBuilder` — the selection is what
 * decides whether the phone's settings sheet opens, and that lives inside the
 * provider Builder itself renders.
 */
function BuilderBody({ products }: { products: ProductCard[] }) {
  const phone = useIsPhone();
  const { selectedId } = useBuilder();
  const [sheet, setSheet] = useState<"sections" | "settings" | null>(null);
  const [lastSelected, setLastSelected] = useState(selectedId);

  /*
   * Tapping a section on a phone opens its settings. Without this the canvas
   * shows a selected outline and nothing else happens, which reads as the tap
   * not having worked.
   *
   * Adjusted during render rather than in an effect: an effect would paint the
   * canvas, then paint it again with the sheet over it, and React re-renders
   * this component before the browser sees either frame.
   */
  let open = sheet;
  if (selectedId !== lastSelected) {
    setLastSelected(selectedId);
    if (phone && selectedId) {
      setSheet("settings");
      open = "settings";
    }
  }

  // A sheet only exists on a phone, so widening the window closes it by
  // construction rather than by cleaning up after itself.
  if (!phone) open = null;

  if (phone) {
    return (
      <>
        <div className="flex min-h-0 flex-1">
          <Canvas products={products} />
        </div>

        <div className="border-border bg-surface flex shrink-0 gap-2 border-t p-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => setSheet("sections")}
          >
            <Layers className="size-4" />
            Sections
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => setSheet("settings")}
          >
            <SlidersHorizontal className="size-4" />
            Settings
          </Button>
        </div>

        <PanelSheet
          open={open === "sections"}
          title="Sections"
          /*
           * The panel inside carries its own tabs — Add, Layers, Pages,
           * Assist — so a fixed "Sections" heading above them would be wrong
           * the moment the merchant moves off the first tab.
           */
          showTitle={false}
          onClose={() => setSheet(null)}
        >
          <LeftPanel />
        </PanelSheet>

        <PanelSheet
          open={open === "settings"}
          title="Settings"
          onClose={() => setSheet(null)}
        >
          <Inspector />
        </PanelSheet>
      </>
    );
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[16rem_minmax(0,1fr)_20rem] lg:grid-rows-1">
      <div className="col-span-2 row-start-1 flex min-h-0 lg:col-span-1 lg:col-start-2">
        <Canvas products={products} />
      </div>

      {/*
        * Hidden below `sm`, even though this branch is not what a phone ends
        * up with. The server cannot know the viewport, so it renders this one
        * and the phone layout appears on hydration — without these, a phone
        * showed a flash of two squeezed columns first. The CSS suppresses that
        * frame; the panels below `sm` are the sheets, rendered by the branch
        * above once the client knows where it is.
        */}
      <aside className="border-border bg-surface row-start-2 max-h-[42dvh] overflow-y-auto border-t border-r max-sm:hidden lg:row-start-1 lg:col-start-1 lg:max-h-none lg:border-t-0 lg:border-r">
        <LeftPanel />
      </aside>

      <aside className="border-border bg-surface row-start-2 max-h-[42dvh] overflow-y-auto border-t max-sm:hidden lg:row-start-1 lg:col-start-3 lg:max-h-none lg:border-t-0 lg:border-l">
        <Inspector />
      </aside>
    </div>
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
