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
 */

/** Wide enough for a full-bleed hero on a high-density screen, and no wider. */
const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;

/** Below this, re-encoding costs quality and saves nothing worth having. */
const ALREADY_SMALL_BYTES = 900_000;

export interface Downscaled {
  blob: Blob;
  /** 0 when the dimensions are unknown — an SVG, or a file the browser could not decode. */
  width: number;
  height: number;
}

export async function downscale(file: File): Promise<Downscaled> {
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

  if (scale === 1 && file.size < ALREADY_SMALL_BYTES) {
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
    canvas.toBlob(resolve, file.type === "image/png" ? "image/png" : "image/jpeg", JPEG_QUALITY),
  );

  return blob ? { blob, width, height } : { blob: file, width, height };
}

/**
 * Downscale and upload one file, as a form the media action understands.
 *
 * The dimensions ride along so the server records them without decoding the
 * image a second time.
 */
export async function uploadForm(file: File): Promise<FormData> {
  const { blob, width, height } = await downscale(file);
  const form = new FormData();
  form.append("file", new File([blob], file.name, { type: blob.type || file.type }));
  if (width) form.append("width", String(width));
  if (height) form.append("height", String(height));
  return form;
}
