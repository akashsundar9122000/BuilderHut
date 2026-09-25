"use client";

import { useId, useRef, useState, useTransition } from "react";
import { ImageUp, Loader2, Trash2, X } from "lucide-react";

import { Button } from "./Button";
import { Input } from "./Input";
import { cn } from "@/lib/cn";
import { messageFor } from "@/lib/media/upload-error";
import { uploadForm } from "@/lib/media/downscale";
import { listMediaAction, uploadMediaAction, type SerialisableAsset } from "@/lib/media/actions";

/*
 * One picture, chosen.
 *
 * Three ways in, because merchants arrive with the picture in three different
 * places: a file on the device, something already uploaded to this shop, or a
 * URL from somewhere else. The third was previously the only one, with "uploads
 * arrive with the media library" written underneath it.
 *
 * The browser resizes before sending; see lib/media/downscale.ts for why.
 */

export function ImagePicker({
  value,
  onChange,
  label = "Image",
  className,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  className?: string;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [library, setLibrary] = useState<SerialisableAsset[] | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);

  function upload(file: File) {
    setError(null);
    start(async () => {
      try {
        const result = await uploadMediaAction(await uploadForm(file));
        if (result.ok) {
          onChange(result.asset.url);
          // The library is stale the moment something is added to it.
          setLibrary(null);
        } else {
          setError(result.message);
        }
      } catch (cause) {
        /*
         * Every failure ends here, including the ones that are not the
         * server's answer. An oversized body makes a Server Action throw in
         * its transport rather than return — and an uncaught throw inside a
         * transition takes down the whole React tree, which in the builder
         * means every edit since the last autosave. That is how a real draft
         * was lost on 2026-09-25.
         */
        setError(messageFor(cause));
      }
    });
  }

  function openLibrary() {
    setShowLibrary(true);
    if (library) return;
    start(async () => setLibrary(await listMediaAction()));
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="text-text-secondary text-sm font-medium">{label}</span>

      {value ? (
        <div className="border-border relative overflow-hidden rounded-lg border">
          {/* A merchant's own upload, or a URL they pasted. next/image would
              need every possible remote host allow-listed up front. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="bg-raised block max-h-44 w-full object-contain" />
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remove image"
            className="bg-surface/90 border-border text-muted hover:text-danger absolute top-2 right-2 grid size-7 place-items-center rounded-md border backdrop-blur transition-colors"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files[0];
            if (file) upload(file);
          }}
          className="border-border hover:border-accent flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors"
        >
          {pending ? (
            <Loader2 className="text-muted size-5 animate-spin" />
          ) : (
            <ImageUp className="text-faint size-5" />
          )}
          <p className="text-muted text-xs">
            {pending ? "Uploading…" : "Drop a picture here, or"}
          </p>
          {!pending && (
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                Choose a file
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={openLibrary}>
                Already uploaded
              </Button>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload(file);
          // Reset, so choosing the same file twice in a row still fires.
          event.target.value = "";
        }}
      />

      {/* The escape hatch stays: some merchants host their photography already. */}
      <Input
        aria-label={`${label} address`}
        value={value ?? ""}
        placeholder="…or paste an image address"
        onChange={(event) => onChange(event.target.value || null)}
      />

      {error ? (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      ) : null}

      {showLibrary ? (
        <div className="border-border rounded-lg border p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-text text-xs font-medium">Your pictures</p>
            <button
              type="button"
              onClick={() => setShowLibrary(false)}
              aria-label="Close the picture library"
              className="text-muted hover:text-text"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {library === null ? (
            <p className="text-muted text-xs">Loading…</p>
          ) : library.length === 0 ? (
            <p className="text-muted text-xs">
              Nothing uploaded yet. The first picture you add will appear here.
            </p>
          ) : (
            <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto">
              {library.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => {
                    onChange(asset.url);
                    setShowLibrary(false);
                  }}
                  className="border-border hover:border-accent aspect-square overflow-hidden rounded-md border transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- as above */}
                  <img
                    src={asset.url}
                    alt={asset.filename ?? ""}
                    className="size-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
