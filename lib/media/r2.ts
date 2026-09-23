import "server-only";
import { MediaError, type MediaStore } from "./types";

/*
 * Cloudflare R2 — NOT IMPLEMENTED YET, and deliberately not faked.
 *
 * R2 is where this should end up: 10 GB free, ~1M writes/month, no egress fees,
 * and it is real object storage rather than a key/value cache being asked to be
 * one. It needs R2 enabled on the Cloudflare account (which asks for a card on
 * file even for the free tier), a bucket, and an S3-compatible API token.
 *
 * Implementing it means adding @aws-sdk/client-s3 and signing requests with
 * SigV4 against https://<account>.r2.cloudflarestorage.com. That is perhaps an
 * hour's work, and it is not worth carrying an unverifiable implementation —
 * or twenty megabytes of unused SDK — until the credentials exist.
 *
 * TODO(phase-4): implement against real credentials before deploying.
 */

export const r2Store: MediaStore = {
  name: "r2",

  async put() {
    throw new MediaError(
      "MEDIA_STORE is 'r2' but the R2 adapter is not implemented yet. Use MEDIA_STORE=kv or 'local'.",
      "not_configured",
    );
  },
  async get() {
    throw new MediaError("The R2 adapter is not implemented yet.", "not_configured");
  },
  async delete() {
    throw new MediaError("The R2 adapter is not implemented yet.", "not_configured");
  },
  publicUrl: (key) => {
    const base = process.env.R2_PUBLIC_BASE_URL;
    return base ? `${base.replace(/\/$/, "")}/${key}` : null;
  },
};
