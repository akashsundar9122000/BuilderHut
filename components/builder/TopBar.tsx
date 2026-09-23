"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Cloud,
  CloudOff,
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
  const { undo, redo, canUndo, canRedo, saveState, device, setDevice, dirty } = useBuilder();

  return (
    <header className="border-border bg-surface flex h-14 shrink-0 items-center gap-2 border-b px-3">
      <Button asChild variant="ghost" size="sm" className="shrink-0">
        <Link href="/app">
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Dashboard</span>
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
        <Button asChild variant="secondary" size="sm" className="hidden sm:inline-flex">
          <a href={`/s/${storeSlug}`} target="_blank" rel="noreferrer">
            Preview
          </a>
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
  return (
    <span className={cn("ml-2 hidden items-center gap-1.5 text-xs sm:flex", tones[tone])}>
      {icon}
      {children}
    </span>
  );
}
