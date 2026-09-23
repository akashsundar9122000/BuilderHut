"use client";

import { useId, useRef, useState, useTransition } from "react";
import { ImageUp, Loader2, Trash2, X } from "lucide-react";

import { Button } from "./Button";
import { Input } from "./Input";
import { cn } from "@/lib/cn";
import { listMediaAction, uploadMediaAction, type SerialisableAsset } from "@/lib/media/actions";

/*
 * One picture, chosen.
 *
 * Three ways in, because merchants arrive with the picture in three different
 * places: a file on the device, something already uploaded to this shop, or a
 * URL from somewhere else. The third was previously the only one, with "uploads
 * arrive with the media library" written underneath it.
 *
 * The browser resizes before sending. A photo off a phone is four megabytes and
 * eight times wider than any slot on the page will ever render it — uploading
 * it whole spends the merchant's storage allowance and then makes their
 * customers download it over mobile data. Doing it here rather than on the
 * server also means the slow part happens on a device that is idle anyway.
 */

/** Wide enough for a full-bleed hero on a high-density screen, and no wider. */
const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;

async function downscale(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  // SVGs are already small and resizing one rasterises it, which is the
  // opposite of what anyone wants. GIFs would lose their animation.
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    return { blob: file, width: 0, height: 0 };
  }

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return { blob: file, width: 0, height: 0 };

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  // Already small enough: send the original rather than re-encoding it, which
  // would only lose quality for no saving.
  if (scale === 1 && file.size < 900_000) {
    bitmap.close();
    return { blob: file, width, height };
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return { blob: file, width, height };
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    // PNG keeps transparency; everything else is smaller as JPEG.
    canvas.toBlob(
      resolve,
      file.type === "image/png" ? "image/png" : "image/jpeg",
      JPEG_QUALITY,
    ),
  );

  return blob ? { blob, width, height } : { blob: file, width, height };
}

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
      const { blob, width, height } = await downscale(file);
      const form = new FormData();
      form.append("file", new File([blob], file.name, { type: blob.type || file.type }));
      if (width) form.append("width", String(width));
      if (height) form.append("height", String(height));

      const result = await uploadMediaAction(form);
      if (result.ok) {
        onChange(result.asset.url);
        // The library is stale the moment something is added to it.
        setLibrary(null);
      } else {
        setError(result.message);
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
