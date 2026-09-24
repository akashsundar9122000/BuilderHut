import { cn } from "@/lib/cn";

/*
 * A row that scrolls forever.
 *
 * The content is rendered twice and the track translated by exactly -100%, so
 * the second copy is where the first one was at the moment it loops and there
 * is no seam to see. The duplicate is aria-hidden: it is the same words again,
 * and a screen reader should read the list once.
 *
 * Pure CSS, and it pauses on hover and on focus-within — an item somebody is
 * trying to read or tab to should not slide out from under them.
 */
export function Marquee({
  items,
  className,
  label,
}: {
  items: readonly string[];
  className?: string;
  /** Names the list for assistive technology, since it reads as a bare row. */
  label: string;
}) {
  const row = (hidden: boolean) => (
    <ul
      className="bh-mk-marquee__track"
      aria-hidden={hidden || undefined}
      aria-label={hidden ? undefined : label}
    >
      {items.map((item) => (
        <li key={item} className="text-text-secondary text-sm whitespace-nowrap">
          {item}
        </li>
      ))}
    </ul>
  );

  return (
    <div className={cn("bh-mk-marquee", className)}>
      {row(false)}
      {row(true)}
    </div>
  );
}
