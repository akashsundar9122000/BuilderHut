"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, ImageUp, Loader2, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui";
import { messageFor } from "@/lib/media/upload-error";
import { uploadForm } from "@/lib/media/downscale";
import { uploadMediaAction } from "@/lib/media/actions";

/*
 * A product's pictures, in order.
 *
 * Order is the whole feature: the first image is what the shop grid shows, so
 * "make this the main one" has to be a single obvious action rather than
 * something a merchant achieves by deleting and re-uploading in sequence.
 *
 * Arrows rather than drag-and-drop. Dragging is nicer with a mouse and worse
 * with everything else — on a phone it fights the page scroll, and with a
 * keyboard it does not exist at all. There are at most eight of these.
 */

const MAX_IMAGES = 8;
export function ProductImages({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const room = MAX_IMAGES - value.length;

  function upload(files: FileList | File[]) {
    setError(null);
    const chosen = Array.from(files).slice(0, Math.max(0, room));
    if (chosen.length === 0) return;

    start(async () => {
      const added: string[] = [];
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
            added.push(result.asset.url);
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-text-secondary text-sm font-medium">Pictures</span>
        <span className="text-faint text-xs">
          {value.length === 0
            ? "The first one is what your shop page shows"
            : `${value.length} of ${MAX_IMAGES}`}
        </span>
      </div>

      {value.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {value.map((url, index) => (
            <li key={`${url}-${index}`} className="flex flex-col gap-1.5">
              <div className="border-border bg-raised relative aspect-square overflow-hidden rounded-lg border">
                {/* A merchant's own upload or a URL they pasted. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="size-full object-cover" />
                {index === 0 ? (
                  <span className="bg-surface/90 text-text absolute top-1.5 left-1.5 flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.625rem] font-medium backdrop-blur">
                    <Star className="size-2.5" aria-hidden />
                    Main
                  </span>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-1">
                <div className="flex gap-0.5">
                  <IconButton label={`Move picture ${index + 1} earlier`} disabled={index === 0} onClick={() => move(index, index - 1)}>
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
          className="border-border hover:border-accent flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors"
        >
          {pending ? (
            <Loader2 className="text-muted size-5 animate-spin" />
          ) : (
            <ImageUp className="text-faint size-5" />
          )}
          <p className="text-muted text-xs">
            {pending ? "Uploading…" : "Drop pictures here, or"}
          </p>
          {!pending ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              Choose files
            </Button>
          ) : null}
          <p className="text-faint text-[0.6875rem]">
            They&rsquo;re resized before sending, so a photo straight off your phone is fine.
          </p>
        </div>
      ) : (
        <p className="text-muted text-xs">
          That&rsquo;s the maximum. Remove one to add another.
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="sr-only"
        onChange={(event) => {
          if (event.target.files) upload(event.target.files);
          event.target.value = "";
        }}
      />

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
      className="text-muted hover:text-text hover:bg-raised grid size-7 place-items-center rounded transition-colors disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
