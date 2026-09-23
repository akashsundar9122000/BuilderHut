import { cn } from "@/lib/cn";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "bg-surface border-border-input text-text placeholder:text-faint h-10 w-full rounded-md border px-3",
        "coarse:h-11 text-sm transition-colors duration-(--bh-duration-fast)",
        "hover:border-border-strong focus:border-accent",
        "disabled:bg-sunken disabled:cursor-not-allowed disabled:opacity-60",
        "aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "bg-surface border-border-input text-text placeholder:text-faint min-h-24 w-full rounded-md border px-3 py-2",
        "text-sm transition-colors duration-(--bh-duration-fast)",
        "hover:border-border-strong focus:border-accent",
        "disabled:bg-sunken disabled:cursor-not-allowed disabled:opacity-60",
        "aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-text-secondary text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-danger text-xs">{error}</p>
      ) : hint ? (
        <p className="text-muted text-xs">{hint}</p>
      ) : null}
    </div>
  );
}
