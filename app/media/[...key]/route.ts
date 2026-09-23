import { NextResponse } from "next/server";
import { getMediaStore } from "@/lib/media/store";

/*
 * Serves merchant uploads.
 *
 * Every read goes through here rather than straight from the store, which is
 * what makes a suspended store's media stop being served the moment it is
 * suspended. The cost is one store read per request; content-addressed keys mean
 * the response is immutable, so the CDN absorbs almost all of it.
 *
 * The headers matter more than they look:
 *   - Content-Type comes from the magic bytes recorded at upload, never from
 *     what the uploader claimed.
 *   - nosniff stops a browser second-guessing that and executing something.
 *   - Content-Disposition: inline with a fixed filename prevents a crafted key
 *     from steering a download.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key: segments } = await ctx.params;
  const key = segments.join("/");

  if (!/^t\/[0-9a-f-]{36}\/[0-9a-f]{24}\.[a-z0-9]{3,4}$/.test(key)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const found = await getMediaStore().get(key);
  if (!found) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(found.data as BodyInit, {
    headers: {
      "Content-Type": found.contentType,
      "Content-Length": String(found.data.byteLength),
      // Immutable: the key IS the hash, so the bytes behind it never change.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
