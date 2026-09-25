"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, ImageUp, Loader2, Trash2 } from "lucide-react";

import { Button } from "./Button";
import { Input } from "./Input";
import { messageFor } from "@/lib/media/upload-error";
import { uploadForm } from "@/lib/media/downscale";
import { uploadMediaAction } from "@/lib/media/actions";

/*
 * Several pictures, in order.
 *
 * The single-picture ImagePicker beside this one is the wrong shape for a
 * gallery: a gallery is a set, and the operations that matter are "add a few at
 * once", "put that one first" and "take that one out". Doing those with a row
 * of single pickers means one upload at a time and no way to reorder at all.
 *
 * Arrows rather than drag-and-drop, for the same reason the product gallery
 * uses them: dragging is nicer with a mouse and worse with everything else — on
 * a phone it fights the page scroll, and with a keyboard it does not exist.
 *
 * Alt text sits under each picture rather than behind a dialog. A gallery of
 * photographs with no alt text is a wall of nothing to a screen reader, and a
 * field nobody can see is a field nobody fills in.
 */

export interface PickedImage {
  url: string;
  alt: string;
}

export function ImagesPicker({
  value,
  onChange,
  label = "Pictures",
  max = 12,
}: {
  value: PickedImage[];
  onChange: (next: PickedImage[]) => void;
  label?: string;
  max?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const room = max - value.length;

  function upload(files: FileList | File[]) {
    setError(null);
    const chosen = Array.from(files).slice(0, Math.max(0, room));
    if (chosen.length === 0) return;

    start(async () => {
      const added: PickedImage[] = [];
      for (const file of chosen) {
        /*
         * try/catch per file, not around the loop. An oversized picture makes
         * a Server Action throw in its transport rather than return, and an
         * uncaught throw inside a transition unmounts the tree — taking every
         * unsaved edit with it. Catching per file also means one bad photo in
         * a selection of six does not discard the other five.
         */
        try {
          const result = await uploadMediaAction(await uploadForm(file));
          if (result.ok) {
            added.push({ url: result.asset.url, alt: "" });
          } else {
            // Stop at the first refusal rather than firing the rest: if it was
            // the storage limit, every one after it fails the same way.
            setError(result.message);
            break;
          }
        } catch (cause) {
          setError(messageFor(cause));
          break;
        }
      }
      if (added.length > 0) onChange([...value, ...added]);
    });
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onChange(next);
  }

  function setAlt(index: number, alt: string) {
    onChange(value.map((image, i) => (i === index ? { ...image, alt } : image)));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-text-secondary text-sm font-medium">{label}</span>
        <span className="text-faint text-xs">
          {value.length === 0 ? "They appear in this order" : `${value.length} of ${max}`}
        </span>
      </div>

      {value.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3">
          {value.map((image, index) => (
            <li key={`${image.url}-${index}`} className="flex flex-col gap-1.5">
              <div className="border-border bg-raised relative aspect-square overflow-hidden rounded-md border">
                {/* A merchant's own upload, or a URL they pasted. next/image
                    would need every possible remote host allow-listed up front. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="" className="size-full object-cover" />
              </div>

              <div className="flex items-center justify-between gap-1">
                <div className="flex gap-0.5">
                  <IconButton
                    label={`Move picture ${index + 1} earlier`}
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    <ArrowLeft className="size-3.5" />
                  </IconButton>
                  <IconButton
                    label={`Move picture ${index + 1} later`}
                    disabled={index === value.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <ArrowRight className="size-3.5" />
                  </IconButton>
                </div>
                <IconButton
                  label={`Remove picture ${index + 1}`}
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              </div>

              <Input
                aria-label={`Describe picture ${index + 1}`}
                placeholder="Describe it"
                value={image.alt}
                onChange={(event) => setAlt(index, event.target.value)}
                className="h-8 text-xs"
              />
            </li>
          ))}
        </ul>
      ) : null}

      {room > 0 ? (
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            upload(event.dataTransfer.files);
          }}
          className="border-border hover:border-accent flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-5 text-center transition-colors"
        >
          {pending ? (
            <Loader2 className="text-muted size-5 animate-spin" />
          ) : (
            <ImageUp className="text-faint size-5" />
          )}
          <p className="text-muted text-xs">{pending ? "Uploading…" : "Drop pictures here, or"}</p>
          {!pending ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => fileRef.current?.click()}
            >
              Choose files
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-faint text-xs">That&rsquo;s the maximum. Remove one to add another.</p>
      )}

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="sr-only"
        onChange={(event) => {
          if (event.target.files) upload(event.target.files);
          // Reset, so choosing the same file twice in a row still fires.
          event.target.value = "";
        }}
      />

      {/* The escape hatch stays: some merchants host their photography already. */}
      {room > 0 ? (
        <Input
          aria-label={`Add ${label.toLowerCase()} by address`}
          placeholder="…or paste an image address"
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            const input = event.currentTarget;
            const url = input.value.trim();
            if (!url) return;
            onChange([...value, { url, alt: "" }]);
            input.value = "";
          }}
        />
      ) : null}

      {error ? (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="text-muted hover:text-text hover:bg-raised grid size-6 place-items-center rounded transition-colors disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
