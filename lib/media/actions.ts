"use server";

import { requireActor, runForTenant } from "@/lib/auth/session";
import { EntitlementError, requireCapacity } from "@/lib/plans/entitlements";
import { listAssets, saveUpload, type LibraryAsset } from "./library";
import { MAX_UPLOAD_BYTES, MediaError } from "./store";

/*
 * Uploading a picture.
 *
 * Server actions rather than a route handler, because both callers — the
 * product form and the builder's image controls — are already client
 * components inside the dashboard, and an action gives them the session and
 * the tenant without either of them naming a tenant id.
 *
 * The file arrives as multipart FormData. Nothing the browser says about it is
 * believed: the size is re-measured here, the type is decided by sniffing the
 * bytes (see store.ts), and the storage key is derived from a hash of the
 * contents rather than from anything the client chose.
 */

export type UploadResult =
  | { ok: true; asset: SerialisableAsset }
  | { ok: false; message: string };

/** What the browser needs back. Dates cross the boundary as ISO strings. */
export interface SerialisableAsset {
  id: string;
  key: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  filename: string | null;
}

function serialise(asset: LibraryAsset): SerialisableAsset {
  const { createdAt: _createdAt, ...rest } = asset;
  return rest;
}

export async function uploadMediaAction(form: FormData): Promise<UploadResult> {
  const actor = await requireActor();
  if (!actor.tenantId) return { ok: false, message: "Open a shop before uploading anything." };

  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, message: "No file was sent." };

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      message: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
    };
  }

  try {
    /*
     * Checked before the bytes are written, not after. Storing it first and
     * then refusing would leave the object in the bucket with nothing pointing
     * at it — and would let a shop over its limit keep filling the bucket.
     */
    await requireCapacity(actor.tenantId, "storageMb", Math.ceil(file.size / 1_000_000));
  } catch (error) {
    if (error instanceof EntitlementError) return { ok: false, message: error.message };
    throw error;
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const width = numberFrom(form.get("width"));
  const height = numberFrom(form.get("height"));

  try {
    const asset = await runForTenant((db) =>
      saveUpload(db, data, {
        filename: file.name,
        declaredType: file.type || undefined,
        width,
        height,
      }),
    );
    return { ok: true, asset: serialise(asset) };
  } catch (error) {
    // MediaError messages are written for merchants — "that file claims to be
    // a PNG but its contents are a PDF" is useful. Anything else is not.
    if (error instanceof MediaError) return { ok: false, message: error.message };
    console.error("[uploadMediaAction]", error);
    return { ok: false, message: "That upload didn't work. Try again in a moment." };
  }
}

function numberFrom(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== "string") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** The shop's recent uploads, for picking one that is already there. */
export async function listMediaAction(): Promise<SerialisableAsset[]> {
  await requireActor();
  const assets = await runForTenant((db) => listAssets(db));
  return assets.map(serialise);
}
