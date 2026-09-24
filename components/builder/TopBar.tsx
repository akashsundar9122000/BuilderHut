"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Cloud,
  CloudOff,
  ExternalLink,
  History,
  Loader2,
  Monitor,
  Redo2,
  Smartphone,
  Tablet,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useBuilder, type Device } from "@/lib/builder/store";

/*
 * Compact on purpose — blueprint section 89 asks for the canvas to dominate.
 * Everything here is either state the merchant needs to trust (is my work
 * saved?) or an action they reach for constantly.
 */

export function TopBar({
  storeSlug,
  onPublish,
  publishing,
  onOpenHistory,
}: {
  storeSlug: string;
  onPublish: () => void;
  publishing: boolean;
  onOpenHistory: () => void;
}) {
  const { undo, redo, canUndo, canRedo, saveState, device, setDevice, dirty, saveNow } =
    useBuilder();
  const router = useRouter();

  /*
   * Preview shows the DRAFT, which is the only thing a merchant mid-edit
   * wants to see. It used to open /s/<slug> — the published store — so
   * someone who had just spent ten minutes redesigning a page opened it and
   * found none of their work there. The published store is still one click
   * away, next to it, and labelled as what it is.
   *
   * The tab is opened before the save rather than after it, because a window
   * opened from inside an await is no longer attributable to the click and
   * every browser blocks it as a popup. It sits blank for as long as the save
   * takes, which is why the draft is saved first at all: the preview renders
   * what is stored, so opening it before the save would show the document
   * from before the last thing typed.
   */
  async function openPreview() {
    /*
     * No "noopener" here, deliberately: with it, window.open returns null by
     * specification, and the handle is the entire point — there would be
     * nothing left to point at the preview once the save came back. The tab is
     * same-origin and goes to a route this app owns, so the opener reference
     * it keeps is not a window onto anything it could not already reach.
     */
    const tab = window.open("", "_blank");
    try {
      await saveNow();
    } finally {
      // Even a failed save opens the preview: it then shows the last thing
      // that did save, which is more use than a tab left blank.
      // A blocked popup still gets the merchant to the preview, in this tab.
      // The draft is saved, so Back returns them to the editor intact.
      if (tab) tab.location.href = "/app/builder/preview";
      else router.push("/app/builder/preview");
    }
  }

  return (
    <header className="border-border bg-surface flex h-14 shrink-0 items-center gap-2 border-b px-3">
      <Button asChild variant="ghost" size="sm" className="shrink-0">
        <Link href="/app">
          <ArrowLeft className="size-4" />
          {/*
           * The word is hidden below `sm`, which left the link with an icon and
           * no accessible name at all — a screen reader announced "link". The
           * label is now always present and only visually hidden, so the arrow
           * still has something to say for itself on a phone.
           */}
          <span className="sr-only sm:not-sr-only">Dashboard</span>
        </Link>
      </Button>

      <div className="border-border mx-1 hidden h-6 border-l sm:block" />

      <div className="flex shrink-0 items-center gap-0.5">
        <IconButton label="Undo" shortcut="⌘Z" disabled={!canUndo} onClick={undo}>
          <Undo2 className="size-4" />
        </IconButton>
        <IconButton label="Redo" shortcut="⇧⌘Z" disabled={!canRedo} onClick={redo}>
          <Redo2 className="size-4" />
        </IconButton>
      </div>

      <SaveIndicator state={saveState} dirty={dirty} />

      <div className="bg-sunken mx-auto hidden items-center gap-0.5 rounded-md p-0.5 md:flex">
        {(
          [
            ["desktop", Monitor, "Desktop"],
            ["tablet", Tablet, "Tablet"],
            ["mobile", Smartphone, "Phone"],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            onClick={() => setDevice(id as Device)}
            aria-label={label}
            aria-pressed={device === id}
            title={label}
            className={cn(
              "grid size-8 place-items-center rounded transition-colors",
              device === id ? "bg-surface text-text shadow-xs" : "text-muted hover:text-text",
            )}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <IconButton label="Version history" onClick={onOpenHistory}>
          <History className="size-4" />
        </IconButton>
        {/*
          * The live store, kept as its own link rather than folded into
          * Preview. They answer different questions — "how does this look?"
          * and "what can my customers see right now?" — and a merchant
          * checking whether an edit went out needs the second one.
          */}
        <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
          <a href={`/s/${storeSlug}`} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" />
            Live store
          </a>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="hidden sm:inline-flex"
          onClick={openPreview}
        >
          Preview
        </Button>
        <Button size="sm" onClick={onPublish} disabled={publishing}>
          {publishing ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {publishing ? "Publishing" : "Publish"}
        </Button>
      </div>
    </header>
  );
}

function IconButton({
  label,
  shortcut,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      disabled={disabled}
      onClick={onClick}
      className="text-muted hover:text-text hover:bg-raised grid size-8 place-items-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  );
}

/*
 * The autosave indicator.
 *
 * Blueprint section 6.8: never silently lose changes. Each state says something
 * different and true — "saving" is reassurance, "conflict" is a warning that
 * the editor reloaded onto someone else's version, and "error" has to look like
 * a problem rather than fade away.
 */
function SaveIndicator({ state, dirty }: { state: string; dirty: boolean }) {
  if (state === "saving") {
    return (
      <Status icon={<Loader2 className="size-3 animate-spin" />} tone="muted">
        Saving
      </Status>
    );
  }
  if (state === "saved" && !dirty) {
    return (
      <Status icon={<Check className="size-3" />} tone="success">
        Saved
      </Status>
    );
  }
  if (state === "conflict") {
    return (
      <Status icon={<AlertTriangle className="size-3" />} tone="warning">
        Reloaded — someone else had saved
      </Status>
    );
  }
  if (state === "error") {
    return (
      <Status icon={<CloudOff className="size-3" />} tone="danger">
        Not saved — retrying
      </Status>
    );
  }
  if (dirty) {
    return (
      <Status icon={<Cloud className="size-3" />} tone="muted">
        Unsaved changes
      </Status>
    );
  }
  return null;
}

function Status({
  icon,
  tone,
  children,
}: {
  icon: React.ReactNode;
  tone: "muted" | "success" | "warning" | "danger";
  children: React.ReactNode;
}) {
  const tones = {
    muted: "text-muted",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  };
  /*
   * Announced, and visible on a phone.
   *
   * The whole indicator used to be hidden below `sm`, which meant the one piece
   * of reassurance a merchant needs most — is my work saved? — disappeared on
   * the device most likely to lose its connection. The icon now always shows,
   * the words appear when there is room, and `role="status"` means a screen
   * reader hears the change either way.
   */
  return (
    <span
      role="status"
      className={cn("ml-2 flex shrink-0 items-center gap-1.5 text-xs", tones[tone])}
    >
      {icon}
      <span className="sr-only sm:not-sr-only">{children}</span>
    </span>
  );
}
