import "server-only";

import { desc, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { mediaAssets } from "@/lib/db/schema";
import type { TenantDb } from "@/lib/db/tenant";
import { storeUpload } from "./store";

/*
 * The library that makes an upload findable again.
 *
 * Storing the object was already solved (store.ts); what was missing was any
 * record that it exists. Without a row, a shop's files cannot be listed,
 * cannot be metered against a plan, and cannot be cleaned up when the shop
 * closes — the only trace of an upload would be a URL typed into a page
 * document that nothing queries.
 *
 * Keys are content-addressed, so uploading the same picture twice is one
 * object and one row. That is worth a conflict clause rather than a duplicate,
 * because merchants re-upload constantly: the same photo goes on the product,
 * the hero and the banner.
 */

export interface LibraryAsset {
  id: string;
  key: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  filename: string | null;
  createdAt: Date;
}

/** Dimensions come from the browser, which already decoded the image to resize
 *  it. They are a layout hint, never a security boundary, so they are clamped
 *  rather than trusted — a nonsense value would only produce a nonsense
 *  aspect-ratio box. */
function clampDimension(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded > 0 && rounded <= 20_000 ? rounded : null;
}

export async function saveUpload(
  db: TenantDb,
  data: Uint8Array,
  meta: { filename?: string; declaredType?: string; width?: number; height?: number },
): Promise<LibraryAsset> {
  const stored = await storeUpload(db.ctx.tenantId, data, meta.declaredType);

  const row = {
    id: uuidv7(),
    tenantId: db.ctx.tenantId,
    key: stored.key,
    contentType: stored.contentType,
    sizeBytes: stored.bytes,
    width: clampDimension(meta.width),
    height: clampDimension(meta.height),
    filename: meta.filename?.slice(0, 200) ?? null,
  };

  /*
   * db.raw with an explicit tenantId, because the scoped builder has no
   * conflict clause — and re-uploading an identical file must be a no-op, not
   * a unique-violation the merchant sees as "upload failed".
   */
  await db.raw.insert(mediaAssets).values(row).onConflictDoNothing({
    target: [mediaAssets.tenantId, mediaAssets.key],
  });

  const [existing] = await db.select(mediaAssets).where(eq(mediaAssets.key, stored.key)).limit(1);

  return {
    id: existing?.id ?? row.id,
    key: stored.key,
    url: stored.url,
    contentType: stored.contentType,
    sizeBytes: existing?.sizeBytes ?? stored.bytes,
    width: existing?.width ?? row.width,
    height: existing?.height ?? row.height,
    filename: existing?.filename ?? row.filename,
    createdAt: existing?.createdAt ?? new Date(),
  };
}

/** The shop's files, newest first. */
export async function listAssets(db: TenantDb, limit = 60): Promise<LibraryAsset[]> {
  const rows = await db.select(mediaAssets).orderBy(desc(mediaAssets.createdAt)).limit(limit);
  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    url: publicUrlFor(row.key),
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    filename: row.filename,
    createdAt: row.createdAt,
  }));
}

/**
 * Where the browser fetches an asset.
 *
 * Derived from the key rather than stored, so moving between storage backends
 * — local disk in development, KV or R2 in production — does not require
 * rewriting every row. The /media route serves whichever backend is configured.
 */
export function publicUrlFor(key: string): string {
  return `/media/${key}`;
}
