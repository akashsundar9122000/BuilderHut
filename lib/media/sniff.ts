import { MediaError } from "./types";

/*
 * Never trust the Content-Type header or the file extension.
 *
 * Both are attacker-controlled. A file claiming to be image/png while actually
 * being an HTML document is a stored-XSS delivery mechanism the moment anything
 * serves it back — and a storefront serves merchant uploads to the public. So
 * the bytes decide, and anything we cannot positively identify is refused.
 */

const SIGNATURES: { ext: string; mime: string; test: (b: Uint8Array) => boolean }[] = [
  {
    ext: "jpg",
    mime: "image/jpeg",
    test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: "png",
    mime: "image/png",
    test: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d,
  },
  {
    ext: "gif",
    mime: "image/gif",
    test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38,
  },
  {
    ext: "webp",
    mime: "image/webp",
    // "RIFF" .... "WEBP"
    test: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
  {
    ext: "avif",
    mime: "image/avif",
    // ....ftypavif
    test: (b) =>
      b[4] === 0x66 &&
      b[5] === 0x74 &&
      b[6] === 0x79 &&
      b[7] === 0x70 &&
      b[8] === 0x61 &&
      b[9] === 0x76 &&
      b[10] === 0x69 &&
      b[11] === 0x66,
  },
  {
    ext: "pdf",
    mime: "application/pdf",
    test: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  },
  {
    ext: "mp4",
    mime: "video/mp4",
    test: (b) =>
      b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 && b[8] !== 0x61,
  },
];

/*
 * SVG is deliberately absent.
 *
 * An SVG is an XML document that can carry <script> and event handlers, so
 * serving one from a storefront origin is an XSS primitive. Supporting it
 * safely means sanitising the DOM on upload and serving with a restrictive CSP;
 * until that exists, merchants upload raster images. Logos included.
 */

export interface SniffResult {
  ext: string;
  mime: string;
}

export function sniff(data: Uint8Array): SniffResult {
  if (data.length < 12) {
    throw new MediaError("That file is too small to be a valid image.", "unsupported_type");
  }
  const match = SIGNATURES.find((s) => s.test(data));
  if (!match) {
    throw new MediaError(
      "That file doesn't look like an image we support. Try JPG, PNG, WebP, AVIF or GIF.",
      "unsupported_type",
    );
  }
  return { ext: match.ext, mime: match.mime };
}
