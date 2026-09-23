import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { MediaError, type MediaStore } from "./types";

/*
 * Local disk, for development with no credentials configured.
 *
 * Deliberately not usable in production: serverless instances have no shared or
 * persistent filesystem, so an upload would land on one instance and 404 from
 * the next. .uploads/ is gitignored.
 */

const ROOT = path.join(process.cwd(), ".uploads");

function resolve(key: string): string {
  // Keys are generated server-side, but a path-traversal check costs nothing
  // and the consequence of being wrong is writing anywhere on the disk.
  const full = path.join(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) {
    throw new MediaError("Refusing a media key that escapes the upload root.", "store_failed");
  }
  return full;
}

export const localStore: MediaStore = {
  name: "local",

  async put(key, data, contentType) {
    const full = resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
    await writeFile(`${full}.type`, contentType, "utf8");
  },

  async get(key) {
    try {
      const full = resolve(key);
      const data = new Uint8Array(await readFile(full));
      const contentType = await readFile(`${full}.type`, "utf8").catch(
        () => "application/octet-stream",
      );
      return { data, contentType };
    } catch {
      return null;
    }
  },

  async delete(key) {
    const full = resolve(key);
    await unlink(full).catch(() => {});
    await unlink(`${full}.type`).catch(() => {});
  },

  publicUrl: () => null,
};
