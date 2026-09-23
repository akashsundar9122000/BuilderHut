import { Skeleton } from "./Skeleton";

/*
 * What a dashboard page looks like before its data arrives.
 *
 * Shaped like the page it stands in for — a title block, then rows — so the
 * content does not jump when it lands. A centred spinner would be less work
 * and would tell the merchant nothing about what is coming.
 *
 * `aria-busy` with a polite live region is what a screen reader needs: the
 * shapes themselves are decorative and hidden from the accessibility tree.
 */
export function PageSkeleton({
  rows = 5,
  action = true,
  label = "Loading",
}: {
  rows?: number;
  /** Mirrors a page whose header carries a primary button. */
  action?: boolean;
  label?: string;
}) {
  return (
    <div className="mx-auto max-w-5xl" aria-busy="true">
      <span className="sr-only" role="status">
        {label}
      </span>
      <div aria-hidden>
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-64" />
          </div>
          {action ? <Skeleton className="h-9 w-32 rounded-lg" /> : null}
        </header>

        <div className="border-border divide-border divide-y rounded-xl border">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 p-4">
              <Skeleton className="size-11 shrink-0 rounded-lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {/*
                 * Varying widths. Identical bars read as a broken table; rows
                 * of different lengths read as text that has not arrived.
                 */}
                <Skeleton className="h-4" style={{ width: `${52 + ((index * 13) % 30)}%` }} />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** For the pages that lead with metric cards and a chart rather than a table. */
export function DashboardSkeleton({ cards = 4, label = "Loading" }: { cards?: number; label?: string }) {
  return (
    <div className="mx-auto max-w-6xl" aria-busy="true">
      <span className="sr-only" role="status">
        {label}
      </span>
      <div aria-hidden>
        <header className="mb-7 flex flex-col gap-2.5">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: cards }).map((_, index) => (
            <div key={index} className="border-border flex flex-col gap-3 rounded-xl border p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>

        <div className="border-border mt-4 rounded-xl border p-4">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-4 h-56 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
