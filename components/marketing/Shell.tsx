import { cn } from "@/lib/cn";
import { Reveal } from "@/components/marketing/Reveal";

/*
 * The shapes every section on this page is made of.
 *
 * Extracted because the landing page was 390 lines of inline sections that had
 * each drifted a little from the others — three different max widths, two
 * different eyebrow sizes, heading clamps that nearly matched. A marketing
 * page is judged on whether it looks considered, and nothing reads as careless
 * faster than a section that is forty pixels narrower than the one above it.
 */

/** The one measure. Everything on the page lines up with this. */
export function Shell({
  children,
  className,
  wide,
}: {
  children: React.ReactNode;
  className?: string;
  /** For the template gallery and the bento, which want the extra breathing room. */
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto px-5 sm:px-8",
        wide ? "max-w-7xl" : "max-w-6xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A section, with the scroll offset the sticky header needs.
 *
 * Without `scroll-margin-top` every in-page link lands with the heading tucked
 * underneath the header, which looks like the link went to the wrong place.
 */
export function Section({
  id,
  children,
  className,
  surface,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
  /** Opts this band into the always-dark theatre palette. */
  surface?: "theatre";
}) {
  return (
    <section
      id={id}
      data-surface={surface}
      className={cn(
        "scroll-mt-(--bh-topbar-h)",
        /*
         * `relative` but NOT `overflow-hidden`, which this had until it broke
         * the build sequence. An overflow other than visible makes the element
         * a scroll container: `position: sticky` inside it then sticks to that
         * box rather than the viewport, and a view() timeline measures against
         * it rather than the screen — so the pinned scene rendered as a tall
         * empty band with every stage stuck at the end of its range.
         *
         * The decoration that needed clipping clips itself instead. See Backdrop.
         */
        surface === "theatre" && "bg-canvas text-text relative",
        className,
      )}
    >
      {children}
    </section>
  );
}

/**
 * The clipped layer a theatre band's decoration lives in.
 *
 * Its own `overflow-hidden`, so a glow wider than the viewport does not add a
 * horizontal scrollbar — and, because it is an absolutely positioned sibling
 * of the content rather than a wrapper around it, nothing inside the section
 * gains a scroll container it did not ask for.
 */
export function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-accent text-xs font-medium tracking-[0.18em] uppercase">
      {children}
    </p>
  );
}

export function SectionHead({
  eyebrow,
  title,
  sub,
  align = "start",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  align?: "start" | "center";
  className?: string;
}) {
  const centred = align === "center";
  return (
    <Reveal className={className}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2
        className={cn(
          "font-display text-[clamp(1.9rem,1.4rem+2vw,3rem)] leading-[1.08]",
          eyebrow && "mt-4",
          centred ? "mx-auto max-w-2xl text-center" : "max-w-xl",
        )}
      >
        {title}
      </h2>
      {sub ? (
        <p
          className={cn(
            "text-muted mt-4 text-balance",
            centred ? "mx-auto max-w-lg text-center" : "max-w-lg",
          )}
        >
          {sub}
        </p>
      ) : null}
    </Reveal>
  );
}
