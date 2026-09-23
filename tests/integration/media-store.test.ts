import { afterAll, describe, expect, it } from "vitest";
import { uuidv7 } from "uuidv7";

import { deleteUpload, getMediaStore, MAX_UPLOAD_BYTES, storeUpload } from "@/lib/media/store";
import { MediaError } from "@/lib/media/types";

/*
 * Exercises the real configured store — Cloudflare KV in development.
 *
 * Writes cost against a 1,000/day budget, so this suite keeps to a handful of
 * small objects and cleans up after itself.
 */

const tenantId = uuidv7();
const written: string[] = [];

function pngOf(marker: number): Uint8Array {
  const out = new Uint8Array(64);
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  out[40] = marker; // vary the tail so the content hash differs
  return out;
}

afterAll(async () => {
  for (const key of written) await deleteUpload(key).catch(() => {});
});

describe(`media store (${process.env.MEDIA_STORE ?? "local"})`, () => {
  it("stores and reads back the same bytes", async () => {
    const data = pngOf(1);
    const asset = await storeUpload(tenantId, data, "image/png");
    written.push(asset.key);

    expect(asset.contentType).toBe("image/png");
    expect(asset.key).toBe(`t/${tenantId}/${asset.hash}.png`);

    const read = await getMediaStore().get(asset.key);
    expect(read).not.toBeNull();
    expect(Array.from(read!.data)).toEqual(Array.from(data));
  });

  it("is content-addressed, so re-uploading the same image reuses the key", async () => {
    const data = pngOf(2);
    const a = await storeUpload(tenantId, data, "image/png");
    const b = await storeUpload(tenantId, data, "image/png");
    written.push(a.key);
    expect(b.key).toBe(a.key);
  });

  it("namespaces keys by tenant so two merchants cannot collide", async () => {
    const other = uuidv7();
    const data = pngOf(3);
    const mine = await storeUpload(tenantId, data, "image/png");
    const theirs = await storeUpload(other, data, "image/png");
    written.push(mine.key, theirs.key);

    expect(mine.hash).toBe(theirs.hash); // same bytes
    expect(mine.key).not.toBe(theirs.key); // different objects
  });

  it("refuses a file whose declared type contradicts its bytes", async () => {
    await expect(storeUpload(tenantId, pngOf(4), "image/jpeg")).rejects.toThrow(MediaError);
  });

  it("refuses an oversized upload before touching the store", async () => {
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    await expect(storeUpload(tenantId, big, "image/png")).rejects.toThrow(/limit is/);
  });

  it("deletes", async () => {
    const asset = await storeUpload(tenantId, pngOf(5), "image/png");
    await deleteUpload(asset.key);
    expect(await getMediaStore().get(asset.key)).toBeNull();
  });
});
