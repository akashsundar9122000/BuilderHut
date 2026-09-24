import Image from "next/image";

import hut from "@/brand/hut-192.png";
import { cn } from "@/lib/cn";

/*
 * The BuilderHut mark: the hut, as the app icon draws it.
 *
 * This used to be a flat line drawing — a roof over a stroked B — while the
 * browser tab showed the rendered hut. Two different marks for one product,
 * which the old file called "a decision waiting to be made rather than one
 * that has been made". This is the decision: the thing in the tab and the
 * thing beside the name are now the same thing.
 *
 * ── What that costs, and why it is still right ────────────────────────────
 *
 * It is a raster, so it does not take `currentColor` and does not invert with
 * the theme the way the drawn mark did. On the bone header it reads as a dark
 * tile, which is what an app icon looks like anywhere else it appears — a dock,
 * a home screen, a browser tab — so it is consistent rather than wrong.
 *
 * The corners are baked into the artwork against its own near-black, so the
 * radius here is CSS clipping the square rather than decoration; without it the
 * tile has hard corners on a light page.
 *
 * 192px source for a 28px mark: three times the largest rendered size, so it
 * stays crisp on a phone's display, and next/image serves a hashed, re-encoded
 * copy rather than the 2.6MB master in brand/.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <Image
      src={hut}
      alt=""
      /*
       * Eager, not lazy. This sits in the header of every page, so the default
       * lazy behaviour means the logo visibly pops in after the rest of the
       * chrome has painted — on the one element a reader uses to check they
       * are where they think they are.
       */
      priority
      aria-hidden="true"
      className={cn("size-7 shrink-0 rounded-[0.45rem]", className)}
    />
  );
}

/** The mark and the name together, which is how the product signs itself. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Mark />
      <span className="font-display">BuilderHut</span>
    </span>
  );
}
