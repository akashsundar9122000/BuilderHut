"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, Sparkles, Undo2 } from "lucide-react";

import { Button, Textarea } from "@/components/ui";
import { assistantAction } from "@/app/(builder)/app/builder/actions";
import { useBuilder } from "@/lib/builder/store";
import type { Command } from "@/lib/builder/commands";

/*
 * The assistant, as a panel rather than a chat.
 *
 * Blueprint section 26 asks for an assistant; it does not ask for a chatbot,
 * and a conversation is the wrong shape for this. What a merchant wants is to
 * say one thing, see exactly what would change, and decide. So: one box, one
 * proposal, a list of named changes, accept or discard.
 *
 * Nothing is applied until Apply is pressed, and applying goes through the
 * editor's own history as a single step — so the safety net for a suggestion
 * that looked better in the abstract is the Cmd+Z they already know.
 */

interface Proposal {
  summary: string;
  changes: { label: string; command: Command }[];
  rejected: { reason: string }[];
  source: "nvidia" | "offline";
  note?: string;
}

const EXAMPLES = [
  "Make the buttons deep green",
  "Add an FAQ section",
  "Round the corners and open up the spacing",
  "Use bigger type",
];

export function AssistPanel() {
  const { doc, page, runBatch } = useBuilder();
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [pending, startTransition] = useTransition();

  function ask(text: string) {
    if (!text.trim() || pending) return;
    setError(null);
    setApplied(false);
    startTransition(async () => {
      const result = await assistantAction(doc, page.id, text);
      if (!result.ok) {
        setProposal(null);
        setError(result.message);
        return;
      }
      setProposal({
        summary: result.summary,
        changes: result.changes,
        rejected: result.rejected,
        source: result.source,
        note: result.note,
      });
    });
  }

  function apply() {
    if (!proposal || proposal.changes.length === 0) return;
    runBatch(
      proposal.changes.map((c) => c.command),
      proposal.changes.length === 1 ? proposal.changes[0]!.label : "Assistant changes",
    );
    setApplied(true);
    setProposal(null);
    setInstruction("");
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h2 className="text-text flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="text-accent size-3.5" aria-hidden />
          Assistant
        </h2>
        <p className="text-muted mt-1 text-xs leading-relaxed">
          Describe a change to this page. You&rsquo;ll see exactly what it would do before anything
          happens.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          ask(instruction);
        }}
        className="flex flex-col gap-2"
      >
        <label htmlFor="assist-instruction" className="sr-only">
          What would you like changed?
        </label>
        <Textarea
          id="assist-instruction"
          rows={3}
          maxLength={500}
          value={instruction}
          placeholder="Make the buttons deep green and round the corners"
          onChange={(event) => setInstruction(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter writes a new line. Same as every other
            // box of this shape the merchant has ever typed into.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              ask(instruction);
            }
          }}
        />
        <Button type="submit" size="sm" disabled={pending || !instruction.trim()}>
          {pending ? "Thinking…" : "Suggest changes"}
        </Button>
      </form>

      {!proposal && !pending && !error && (
        <div className="flex flex-col gap-1.5">
          <p className="text-muted text-[0.6875rem] font-medium tracking-wide uppercase">Try</p>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setInstruction(example);
                ask(example);
              }}
              className="border-border text-muted hover:border-accent hover:text-text rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {applied && !proposal && (
        <p className="text-text bg-raised flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-xs">
          <Check className="text-accent-2 mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            Applied. <Undo2 className="inline size-3 align-[-0.1em]" aria-hidden /> Cmd+Z undoes the
            whole thing.
          </span>
        </p>
      )}

      {error && (
        <p role="alert" className="text-danger bg-danger-soft rounded-lg px-2.5 py-2 text-xs">
          {error}
        </p>
      )}

      {proposal && (
        <div className="border-border flex flex-col gap-3 rounded-lg border p-3">
          <p className="text-text text-xs leading-relaxed">{proposal.summary}</p>

          {proposal.note && <p className="text-muted text-[0.6875rem]">{proposal.note}</p>}

          {proposal.changes.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {proposal.changes.map((change, index) => (
                <li key={index} className="text-muted flex items-start gap-1.5 text-xs">
                  <Check className="text-accent-2 mt-0.5 size-3 shrink-0" aria-hidden />
                  {change.label}
                </li>
              ))}
            </ul>
          )}

          {/*
           * What was refused, and why, in the merchant's words. Silently
           * dropping part of a suggestion would leave them believing something
           * happened that did not.
           */}
          {proposal.rejected.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {proposal.rejected.map((item, index) => (
                <li key={index} className="text-muted flex items-start gap-1.5 text-xs">
                  <AlertTriangle className="text-warning mt-0.5 size-3 shrink-0" aria-hidden />
                  {item.reason}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={apply} disabled={proposal.changes.length === 0}>
              Apply {proposal.changes.length > 1 ? `${proposal.changes.length} changes` : "change"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setProposal(null)}>
              Discard
            </Button>
          </div>

          <p className="text-muted text-[0.625rem]">
            {proposal.source === "nvidia" ? "Suggested by NVIDIA NIM" : "Worked out on our servers"}
            {" · "}
            checked against this page before it was offered
          </p>
        </div>
      )}
    </div>
  );
}
