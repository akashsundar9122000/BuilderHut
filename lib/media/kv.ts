import "server-only";
import { MediaError, type MediaStore } from "./types";

/*
 * Cloudflare Workers KV over the REST API.
 *
 * Chosen because the account already has KV and R2 is not enabled yet. Know the
 * ceiling before relying on it: the free plan allows 1,000 writes/day, 100,000
 * reads/day, and caps a value at 25 MiB. One merchant uploading a 60-image
 * catalogue spends 6% of the daily write budget, so this is a store for
 * building and demoing, not for a platform with real merchants.
 *
 * Switching to R2 is a MEDIA_STORE env change plus credentials — see ./r2.
 */

function config() {
  const accountId = process.env.CF_ACCOUNT_ID;
  const namespaceId = process.env.CF_KV_NAMESPACE_ID;
  const token = process.env.CF_KV_API_TOKEN;
  if (!accountId || !namespaceId || !token) {
    throw new MediaError(
      "MEDIA_STORE is 'kv' but CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID or CF_KV_API_TOKEN is missing.",
      "not_configured",
    );
  }
  return {
    base: `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}`,
    token,
  };
}

export const kvStore: MediaStore = {
  name: "kv",

  async put(key, data, contentType) {
    const { base, token } = config();
    // The multipart form is how KV takes a value with metadata. Content type
    // travels in the metadata because KV itself stores only opaque bytes.
    const form = new FormData();
    form.set("value", new Blob([data as BlobPart], { type: contentType }));
    form.set("metadata", JSON.stringify({ contentType }));

    const res = await fetch(`${base}/values/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      throw new MediaError(
        `KV rejected the upload (${res.status}). ${await res.text().catch(() => "")}`.trim(),
        "store_failed",
      );
    }
  },

  async get(key) {
    const { base, token } = config();
    const res = await fetch(`${base}/values/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new MediaError(`KV read failed (${res.status}).`, "store_failed");

    const data = new Uint8Array(await res.arrayBuffer());
    // KV returns the stored blob's type; fall back rather than guessing wrongly.
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    return { data, contentType };
  },

  async delete(key) {
    const { base, token } = config();
    const res = await fetch(`${base}/values/${encodeURIComponent(key)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 404) {
      throw new MediaError(`KV delete failed (${res.status}).`, "store_failed");
    }
  },

  // KV has no public URL — every read goes through our own route, which is also
  // what lets a suspended store's media stop being served immediately.
  publicUrl: () => null,
};
