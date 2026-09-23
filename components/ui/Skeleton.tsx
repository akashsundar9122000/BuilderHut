import { cn } from "@/lib/cn";

/** A settling shape, not a shimmer: the pulse is slow enough to read as "loading", not "broken". */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("bg-raised animate-pulse rounded-md", className)} {...props} />;
}
