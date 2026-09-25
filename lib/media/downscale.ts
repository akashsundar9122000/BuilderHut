/*
 * Shrink a picture in the browser, before it is ever sent.
 *
 * A photo off a phone is four megabytes and eight times wider than any slot on
 * the page will ever render it. Uploading it whole spends the merchant's
 * storage allowance and then makes their customers download it over mobile
 * data. Doing it here rather than on the server also means the slow part
 * happens on a device that is idle anyway.
 *
 * Lives here because three uploaders need it — one picture for a section, a
 * product's pictures, and a gallery's — and three copies of a canvas encoder is
 * three places for the quality setting to drift apart.
 *
 * ── Why this targets BYTES and not just pixels ────────────────────────────
 *
 * The first version capped the longest edge at 2000px and stopped there, which
 * is not a size limit at all: a 2000px PNG screenshot is routinely three or
 * four megabytes, and even a 2000px JPEG clears a megabyte often enough. A
 * Server Action's request body is capped at 1MB by default, and exceeding it
 * does not fail the upload politely — it throws in the action's transport,
 * which takes down the whole React tree and every unsaved edit with it. That
 * happened to a real draft on 2026-09-25.
 *
 * So the pixel cap is now the starting point of a search, not the answer. Drop
 * quality first, because that is nearly free visually; then dimensions, which
 * are not. Give up rather than degrade past the point of being worth
 * uploading, and let the caller say so.
 */

/** Wide enough for a full-bleed hero on a high-density screen, and no wider. */
const MAX_EDGE = 2000;
/** Never shrink past this: below it, a hero is visibly soft on a laptop. */
const MIN_EDGE = 1000;

/**
 * The byte budget every upload must fit.
 *
 * Comfortably under the Server Action body limit, with room for the rest of
 * the multipart payload — the filename, the dimensions, React's own fields.
 */
export const TARGET_BYTES = 900_000;

/** Tried in order. Below 0.5 a photograph starts to show blocking. */
const QUALITIES = [0.85, 0.72, 0.6, 0.5];

export interface Downscaled {
  blob: Blob;
  /** 0 when the dimensions are unknown — an SVG, or a file the browser could not decode. */
  width: number;
  height: number;
  /** True when even the smallest attempt was over budget. */
  tooLarge: boolean;
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Whether any pixel is not fully opaque.
 *
 * Only asked when a PNG is over budget, because it is the question that decides
 * whether re-encoding it as a JPEG would ruin it. Sampled on a small copy: a
 * logo's transparency is a large region, not one stray pixel, so a 64px
 * thumbnail answers this as well as four million pixels would and costs
 * nothing.
 */
function hasAlpha(bitmap: ImageBitmap): boolean {
  const size = 64;
  const probe = document.createElement("canvas");
  probe.width = size;
  probe.height = size;
  const context = probe.getContext("2d", { willReadFrequently: true });
  if (!context) return true;
  context.drawImage(bitmap, 0, 0, size, size);
  try {
    const { data } = context.getImageData(0, 0, size, size);
    for (let i = 3; i < data.length; i += 4) if (data[i]! < 250) return true;
    return false;
  } catch {
    // A tainted canvas cannot be read. Assume transparency and keep the PNG.
    return true;
  }
}

export async function downscale(file: File): Promise<Downscaled> {
  // SVGs are already small and resizing one rasterises it, which is the
  // opposite of what anyone wants. GIFs would lose their animation.
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    return { blob: file, width: 0, height: 0, tooLarge: file.size > TARGET_BYTES };
  }

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return { blob: file, width: 0, height: 0, tooLarge: file.size > TARGET_BYTES };

  const longest = Math.max(bitmap.width, bitmap.height);

  // Already small in both senses: nothing to gain, and re-encoding only costs
  // quality.
  if (longest <= MAX_EDGE && file.size <= TARGET_BYTES) {
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return { blob: file, ...size, tooLarge: false };
  }

  /*
   * PNG has no quality knob, so the only lever is dimensions — and a big PNG
   * photograph will not fit under the budget at any sensible size. Keep PNG
   * only when transparency is actually in use; otherwise JPEG, which is what
   * the picture wanted to be all along.
   */
  const keepPng = file.type === "image/png" && hasAlpha(bitmap);
  const type = keepPng ? "image/png" : "image/jpeg";

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return { blob: file, ...size, tooLarge: file.size > TARGET_BYTES };
  }

  let best: { blob: Blob; width: number; height: number } | null = null;

  for (let edge = Math.min(MAX_EDGE, longest); edge >= MIN_EDGE; edge = Math.round(edge * 0.75)) {
    const scale = edge / longest;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    // PNG ignores the quality argument, so one pass per size is all there is.
    for (const quality of keepPng ? [1] : QUALITIES) {
      const blob = await encode(canvas, type, quality);
      if (!blob) continue;
      // Remember the smallest thing produced, so a give-up still returns the
      // best attempt rather than the original four megabytes.
      if (!best || blob.size < best.blob.size) best = { blob, width, height };
      if (blob.size <= TARGET_BYTES) {
        bitmap.close();
        return { blob, width, height, tooLarge: false };
      }
    }
  }

  bitmap.close();
  if (best) return { ...best, tooLarge: best.blob.size > TARGET_BYTES };
  return { blob: file, width: 0, height: 0, tooLarge: file.size > TARGET_BYTES };
}

/** Raised when a picture cannot be made small enough to send. */
export class ImageTooLargeError extends Error {
  constructor() {
    super(
      "That picture is too large to upload, even after shrinking. Try a smaller one, or save it as a JPEG first.",
    );
    this.name = "ImageTooLargeError";
  }
}

/**
 * Downscale and upload one file, as a form the media action understands.
 *
 * The dimensions ride along so the server records them without decoding the
 * image a second time.
 *
 * Throws ImageTooLargeError rather than posting something the Server Action
 * will reject. A 413 from an action is not a failed upload the caller can
 * catch and report — it throws in the transport and takes the page down.
 */
export async function uploadForm(file: File): Promise<FormData> {
  const { blob, width, height, tooLarge } = await downscale(file);
  if (tooLarge) throw new ImageTooLargeError();

  const form = new FormData();
  form.append("file", new File([blob], file.name, { type: blob.type || file.type }));
  if (width) form.append("width", String(width));
  if (height) form.append("height", String(height));
  return form;
}
