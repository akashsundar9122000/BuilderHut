import { cn } from "@/lib/cn";

/*
 * The BuilderHut mark: a roof over a B, with a lit window in its counter.
 *
 * The geometry is character-for-character the same as brand/mark.svg, with the
 * viewBox cropped to the artwork instead of the tile. Redrawing it at a
 * different scale — which is what this was first — makes the strokes
 * proportionally heavier, and the two stop being the same drawing.
 *
 * Two deliberate differences from that master. No tile: inside the product the
 * mark sits on our own canvas, and a dark tile there is a sticker on the page.
 * And the colours are tokens rather than hex, so the mark inverts with the
 * theme instead of staying a light-mode artefact on a warm-black page. The
 * letterform takes `currentColor` so it matches whatever it is set beside.
 *
 * Note that this is NOT what the browser tab shows any more: the app icon is
 * the rendered hut in app/icon.png, cut from brand/app-icon.png. The two are
 * different drawings, which is a decision waiting to be made rather than one
 * that has been made.
 */
export function Mark({ className }: { className?: string }) {
  return (
    // The artwork's own bounds in the icon's 64-unit space, plus a hair.
    <svg
      viewBox="9.5 10.5 45 45.5"
      className={cn("size-7 shrink-0", className)}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M23 26 V53" />
        <path d="M23 26 H32.5 C38.5 26 38.5 38 32.5 38 H23" />
        <path d="M23 38 H34.5 C41.5 38 41.5 53 34.5 53 H23" />
      </g>

      <path
        d="M13 31 L32 14 L51 31"
        stroke="var(--color-accent)"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* One jewel, the second accent — the pairing the rest of the product uses. */}
      <g fill="var(--color-accent-2)">
        <rect x="26.4" y="29" width="2.9" height="2.9" rx="0.7" />
        <rect x="30.2" y="29" width="2.9" height="2.9" rx="0.7" />
        <rect x="26.4" y="32.8" width="2.9" height="2.9" rx="0.7" />
        <rect x="30.2" y="32.8" width="2.9" height="2.9" rx="0.7" />
      </g>
    </svg>
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
