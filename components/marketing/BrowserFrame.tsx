import { cn } from "@/lib/cn";

/*
 * Window chrome, drawn rather than photographed.
 *
 * Its whole job is to say "this is a real page on the internet" about the
 * thing inside it — which here is a live StoreFrame, not a screenshot, so a
 * screenshot of a browser around it would be the only stale pixel on the page.
 *
 * Hidden from assistive technology: the dots and the address are set dressing,
 * and a screen reader announcing "three circles, builderhut dot app" before
 * the content is worse than silence. The URL is decoration; the real link is
 * the button beside it.
 */
export function BrowserFrame({
  url,
  children,
  className,
}: {
  url: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border bg-surface overflow-hidden rounded-[var(--bh-radius-xl)] border shadow-lg",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="border-border bg-raised flex items-center gap-2 border-b px-3.5 py-2.5"
      >
        <span className="flex gap-1.5">
          <span className="bg-border-strong size-2.5 rounded-full" />
          <span className="bg-border-strong size-2.5 rounded-full" />
          <span className="bg-border-strong size-2.5 rounded-full" />
        </span>
        <span className="bg-canvas text-faint ml-2 flex-1 truncate rounded-[var(--bh-radius-sm)] px-2.5 py-1 text-[0.6875rem]">
          {url}
        </span>
      </div>
      {children}
    </div>
  );
}
