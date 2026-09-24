import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DOMParser } from "@xmldom/xmldom";

/*
 * Every SVG we ship must parse as XML.
 *
 * An SVG written inline in JSX is parsed by the JSX compiler and then by the
 * browser's HTML parser, both of which are forgiving. The same markup in a
 * standalone .svg file is parsed as XML, which is not — and a favicon that
 * fails to parse does not appear, with no error in any console.
 *
 * That is exactly what happened: a comment in app/icon.svg described a colour
 * as `--bh-canvas`, and a double hyphen is illegal inside an XML comment. The
 * link tag was emitted, the file served with the right content type, and the
 * tab stayed blank.
 */

const SVG_DIRS = ["app", "public"];

function svgFiles(dir: string, found: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) svgFiles(full, found);
    else if (entry.name.endsWith(".svg")) found.push(full);
  }
  return found;
}

const files = SVG_DIRS.flatMap((dir) => svgFiles(dir));

describe("shipped SVG assets", () => {
  it("finds the ones we know about", () => {
    // A guard on the guard: if the glob breaks, every assertion below passes
    // vacuously and the thing this file exists for stops being checked.
    expect(files).toContain(path.join("app", "icon.svg"));
  });

  it.each(files)("%s parses as XML", (file) => {
    const errors: string[] = [];
    const parser = new DOMParser({
      onError: (level, message) => {
        if (level !== "warning") errors.push(message);
      },
    });
    const doc = parser.parseFromString(readFileSync(file, "utf8"), "image/svg+xml");

    expect(errors, `${file}: ${errors.join("; ")}`).toEqual([]);
    expect(doc.documentElement?.nodeName).toBe("svg");
  });

  it.each(files)("%s has a viewBox, so it scales to whatever asks for it", (file) => {
    const source = readFileSync(file, "utf8");
    expect(source).toMatch(/viewBox="/);
  });
});
