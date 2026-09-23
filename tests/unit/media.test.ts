import { describe, expect, it } from "vitest";
import { sniff } from "@/lib/media/sniff";
import { MediaError } from "@/lib/media/types";

/** Minimal byte headers, padded past the 12-byte floor the sniffer requires. */
function bytes(...head: number[]): Uint8Array {
  const out = new Uint8Array(32);
  out.set(head, 0);
  return out;
}

const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0);
const GIF = bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d);

describe("magic-byte sniffing", () => {
  it("identifies the formats merchants actually upload", () => {
    expect(sniff(PNG)).toEqual({ ext: "png", mime: "image/png" });
    expect(sniff(JPG)).toEqual({ ext: "jpg", mime: "image/jpeg" });
    expect(sniff(GIF)).toEqual({ ext: "gif", mime: "image/gif" });
    expect(sniff(WEBP)).toEqual({ ext: "webp", mime: "image/webp" });
    expect(sniff(PDF)).toEqual({ ext: "pdf", mime: "application/pdf" });
  });

  it("rejects an HTML document dressed as an image", () => {
    // The actual attack: upload .png, get it served from the storefront origin,
    // and the <script> inside runs against a customer's session.
    const html = new TextEncoder().encode("<!DOCTYPE html><script>alert(1)</script>");
    expect(() => sniff(html)).toThrow(MediaError);
  });

  it("rejects SVG, which is a script-bearing XML document", () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
    expect(() => sniff(svg)).toThrow(/doesn't look like an image/);
  });

  it("rejects a file too short to identify", () => {
    expect(() => sniff(new Uint8Array([0xff, 0xd8]))).toThrow(/too small/);
  });

  it("does not mistake arbitrary binary for an image", () => {
    const noise = new Uint8Array(32).fill(0x42);
    expect(() => sniff(noise)).toThrow(MediaError);
  });
});
