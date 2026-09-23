import { cn } from "@/lib/cn";
import { Button } from "./Button";

/*
 * Blueprint sections 41/42: no screen ships with a blank table or a dead end.
 * An empty state says what this place is for and offers the next action; an
 * error state says what failed and offers a way out.
 */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick?: () => void; href?: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? <div className="text-faint mb-4 [&_svg]:size-8">{icon}</div> : null}
      <h3 className="font-display text-text text-lg">{title}</h3>
      <p className="text-muted mt-1.5 max-w-sm text-sm">{description}</p>
      {action ? (
        <div className="mt-5">
          {action.href ? (
            <Button asChild size="sm">
              <a href={action.href}>{action.label}</a>
            </Button>
          ) : (
            <Button size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-danger/30 bg-danger-soft flex flex-col items-center rounded-lg border px-6 py-10 text-center",
        className,
      )}
    >
      <h3 className="font-display text-text text-lg">{title}</h3>
      <p className="text-text-secondary mt-1.5 max-w-sm text-sm">{description}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
