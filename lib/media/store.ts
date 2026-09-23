import "server-only";
import { createHash } from "node:crypto";

import { kvStore } from "./kv";
import { localStore } from "./local";
import { r2Store } from "./r2";
import { sniff } from "./sniff";
import { MediaError, type MediaStore, type StoredAsset } from "./types";

export { MediaError } from "./types";
export type { StoredAsset } from "./types";

/**
 * 8 MB. Large enough for a phone photo straight off a camera roll, small enough
 * that one upload cannot consume a meaningful share of KV's 25 MiB value cap.
 * The browser downscales before sending, so hitting this is unusual.
 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export function getMediaStore(): MediaStore {
  switch (process.env.MEDIA_STORE) {
    case "kv":
      return kvStore;
    case "r2":
      return r2Store;
    case "local":
      return localStore;
    default:
      // No configuration means local disk, so `pnpm dev` works on a fresh clone
      // with an empty .env.local rather than failing on the first upload.
      return localStore;
  }
}

/**
 * Validate and store one file.
 *
 * Keys are tenant-prefixed and content-addressed. Tenant-prefixed so a store's
 * media can be enumerated and removed as a unit, and so one merchant's key can
 * never collide with another's. Content-addressed so re-uploading an unchanged
 * image is a no-op write — which matters a great deal against a 1,000/day
 * write budget.
 */
export async function storeUpload(
  tenantId: string,
  data: Uint8Array,
  declaredType?: string,
): Promise<StoredAsset> {
  if (data.byteLength > MAX_UPLOAD_BYTES) {
    throw new MediaError(
      `That file is ${(data.byteLength / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
      "too_large",
    );
  }

  // The bytes decide, not the header. A mismatch is worth reporting rather than
  // silently correcting: it usually means the client is confused, occasionally
  // that someone is probing.
  const { ext, mime } = sniff(data);
  if (declaredType && declaredType !== mime && !declaredType.startsWith("application/octet")) {
    throw new MediaError(
      `That file claims to be ${declaredType} but its contents are ${mime}.`,
      "type_mismatch",
    );
  }

  const hash = createHash("sha256").update(data).digest("hex").slice(0, 24);
  const key = `t/${tenantId}/${hash}.${ext}`;

  const store = getMediaStore();
  await store.put(key, data, mime);

  return {
    key,
    url: store.publicUrl(key) ?? `/media/${key}`,
    bytes: data.byteLength,
    contentType: mime,
    hash,
  };
}

export async function deleteUpload(key: string): Promise<void> {
  await getMediaStore().delete(key);
}
