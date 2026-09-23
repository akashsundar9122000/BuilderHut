"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { applyCommand, coalesceKey, describeCommand, type Command } from "./commands";
import type { Page, SiteDocument } from "@/lib/schema/page";

/*
 * The builder's state.
 *
 * One reducer holds the document, the selection and the history. Everything the
 * editor does goes through `run(command)`, which is what makes undo, autosave
 * and (later) AI edits share one path rather than three.
 *
 * History is a stack of documents produced by commands, with coalescing: edits
 * to the same field within a short window collapse into one entry, so typing a
 * heading is one undo rather than forty. Structural changes never coalesce —
 * merging two drags would make the first unrecoverable.
 */

const HISTORY_LIMIT = 80;
const COALESCE_WINDOW_MS = 700;

export type SaveState = "idle" | "saving" | "saved" | "conflict" | "error";

interface HistoryEntry {
  doc: SiteDocument;
  label: string;
  key: string | null;
  at: number;
}

interface State {
  doc: SiteDocument;
  pageId: string;
  selectedId: string | null;
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** Server revision this document is based on. Sent with every save. */
  revision: number;
  dirty: boolean;
}

type Action =
  | { type: "run"; command: Command }
  | { type: "runBatch"; commands: Command[]; label: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "select"; id: string | null }
  | { type: "setPage"; pageId: string }
  | { type: "saved"; revision: number }
  | { type: "replace"; doc: SiteDocument; revision: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "run": {
      const next = applyCommand(state.doc, action.command);
      // A command that changed nothing — a drag that landed where it started,
      // a guarded delete — must not consume an undo step.
      if (next === state.doc) return state;

      const key = coalesceKey(action.command);
      const now = Date.now();
      const previous = state.past[state.past.length - 1];
      const merge =
        key !== null && previous?.key === key && now - previous.at < COALESCE_WINDOW_MS;

      const entry: HistoryEntry = {
        doc: state.doc,
        label: describeCommand(action.command),
        key,
        at: now,
      };
      const past = merge
        ? [...state.past.slice(0, -1), { ...previous!, at: now }]
        : [...state.past, entry].slice(-HISTORY_LIMIT);

      return { ...state, doc: next, past, future: [], dirty: true };
    }

    /*
     * Several commands, one undo step.
     *
     * The assistant proposes a set of changes that the merchant accepts as a
     * set, so undoing has to take them back as a set. Doing this by dispatching
     * `run` in a loop would leave them pressing Cmd+Z six times to get back to
     * where they were, which reads as the editor losing track.
     */
    case "runBatch": {
      const next = action.commands.reduce(applyCommand, state.doc);
      if (next === state.doc) return state;
      const entry: HistoryEntry = { doc: state.doc, label: action.label, key: null, at: Date.now() };
      return {
        ...state,
        doc: next,
        past: [...state.past, entry].slice(-HISTORY_LIMIT),
        future: [],
        dirty: true,
      };
    }

    case "undo": {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        ...state,
        doc: previous.doc,
        past: state.past.slice(0, -1),
        future: [{ ...previous, doc: state.doc }, ...state.future].slice(0, HISTORY_LIMIT),
        dirty: true,
      };
    }

    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...state,
        doc: next.doc,
        past: [...state.past, { ...next, doc: state.doc }].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
        dirty: true,
      };
    }

    case "select":
      return { ...state, selectedId: action.id };

    case "setPage":
      return { ...state, pageId: action.pageId, selectedId: null };

    case "saved":
      return { ...state, revision: action.revision, dirty: false };

    case "replace":
      // Used to resolve a conflict: the server's version wins and history is
      // dropped, because undoing onto a document that no longer exists upstream
      // would silently reintroduce the change that was just rejected.
      return {
        ...state,
        doc: action.doc,
        revision: action.revision,
        past: [],
        future: [],
        dirty: false,
        selectedId: null,
      };
  }
}

interface BuilderContextValue extends State {
  page: Page;
  run: (command: Command) => void;
  runBatch: (commands: Command[], label: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  select: (id: string | null) => void;
  setPage: (pageId: string) => void;
  saveState: SaveState;
  saveNow: () => void;
  device: Device;
  setDevice: (device: Device) => void;
}

export type Device = "desktop" | "tablet" | "mobile";

const BuilderContext = createContext<BuilderContextValue | null>(null);

export interface SaveResult {
  ok: boolean;
  revision?: number;
  conflict?: boolean;
  serverDoc?: SiteDocument;
}

export function BuilderProvider({
  initialDoc,
  initialRevision,
  save,
  children,
}: {
  initialDoc: SiteDocument;
  initialRevision: number;
  save: (doc: SiteDocument, expectedRevision: number) => Promise<SaveResult>;
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, {
    doc: initialDoc,
    pageId: initialDoc.pages.find((p) => p.system === "home")?.id ?? initialDoc.pages[0]!.id,
    selectedId: null,
    past: [],
    future: [],
    revision: initialRevision,
    dirty: false,
  });

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [device, setDevice] = useState<Device>("desktop");

  /*
   * The autosave timer and the Cmd+S handler both need the CURRENT document,
   * but neither should be torn down and rebuilt on every keystroke. A ref holds
   * it — written in an effect rather than during render, because a render can
   * be thrown away under concurrent rendering and a mutation made during one
   * would survive it.
   */
  const latest = useRef({ doc: state.doc, revision: state.revision, dirty: state.dirty });
  useEffect(() => {
    latest.current = { doc: state.doc, revision: state.revision, dirty: state.dirty };
  });

  const inFlight = useRef(false);

  const persist = useCallback(async () => {
    if (inFlight.current || !latest.current.dirty) return;
    inFlight.current = true;
    setSaveState("saving");
    try {
      const result = await save(latest.current.doc, latest.current.revision);
      if (result.ok && result.revision !== undefined) {
        dispatch({ type: "saved", revision: result.revision });
        setSaveState("saved");
      } else if (result.conflict && result.serverDoc) {
        // Someone else saved first. Their version is authoritative; the editor
        // reloads onto it rather than overwriting work it never saw.
        dispatch({ type: "replace", doc: result.serverDoc, revision: result.revision ?? 0 });
        setSaveState("conflict");
      } else {
        setSaveState("error");
      }
    } catch {
      setSaveState("error");
    } finally {
      inFlight.current = false;
    }
  }, [save]);

  // Debounced autosave. 1.2s is long enough that a sentence is one save and
  // short enough that closing the tab rarely loses anything.
  useEffect(() => {
    if (!state.dirty) return;
    const timer = setTimeout(() => void persist(), 1200);
    return () => clearTimeout(timer);
  }, [state.dirty, state.doc, persist]);

  // Never lose work to a closed tab without warning.
  useEffect(() => {
    if (!state.dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.dirty]);

  const run = useCallback((command: Command) => dispatch({ type: "run", command }), []);
  const runBatch = useCallback(
    (commands: Command[], label: string) => dispatch({ type: "runBatch", commands, label }),
    [],
  );
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  const select = useCallback((id: string | null) => dispatch({ type: "select", id }), []);
  const setPage = useCallback((pageId: string) => dispatch({ type: "setPage", pageId }), []);

  // Keyboard shortcuts. A design tool that cannot undo from the keyboard is not
  // a design tool.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      if (event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        dispatch({ type: "undo" });
      } else if ((event.key === "z" && event.shiftKey) || event.key === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
      } else if (event.key === "s") {
        // Cmd+S is muscle memory. Intercept it so the browser does not offer to
        // save the page to disk, and save the draft instead.
        event.preventDefault();
        void persist();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [persist]);

  const page = useMemo(
    () => state.doc.pages.find((p) => p.id === state.pageId) ?? state.doc.pages[0]!,
    [state.doc, state.pageId],
  );

  const value = useMemo<BuilderContextValue>(
    () => ({
      ...state,
      page,
      run,
      runBatch,
      undo,
      redo,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      select,
      setPage,
      saveState: state.dirty && saveState === "saved" ? "idle" : saveState,
      saveNow: () => void persist(),
      device,
      setDevice,
    }),
    [state, page, run, runBatch, undo, redo, select, setPage, saveState, persist, device],
  );

  return <BuilderContext value={value}>{children}</BuilderContext>;
}

export function useBuilder() {
  const ctx = useContext(BuilderContext);
  if (!ctx) throw new Error("useBuilder must be used inside <BuilderProvider>");
  return ctx;
}

/** The currently selected section, if any. */
export function useSelectedSection() {
  const { page, selectedId } = useBuilder();
  return useMemo(
    () => page.sections.find((s) => s.id === selectedId) ?? null,
    [page, selectedId],
  );
}
