/** A file that has been accepted and stored. */
export interface StoredAsset {
  /** Storage key. Tenant-prefixed and content-addressed: `t/<tenantId>/<hash>.<ext>` */
  key: string;
  /** Where the browser fetches it. */
  url: string;
  bytes: number;
  contentType: string;
  /** sha256 of the contents, truncated. Two identical uploads produce one object. */
  hash: string;
}

export interface MediaStore {
  readonly name: "kv" | "r2" | "local";
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ data: Uint8Array; contentType: string } | null>;
  delete(key: string): Promise<void>;
  /** Public URL, or null when the store cannot serve directly and needs our route. */
  publicUrl(key: string): string | null;
}

export class MediaError extends Error {
  constructor(
    message: string,
    readonly code:
      | "too_large"
      | "unsupported_type"
      | "type_mismatch"
      | "not_configured"
      | "store_failed",
  ) {
    super(message);
    this.name = "MediaError";
  }
}
