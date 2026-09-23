import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg" | "icon";

/*
 * Plain lookup records rather than cva: the variants are a closed set, the
 * strings are readable at a glance, and it is one less dependency to keep
 * aligned with Tailwind's class ordering.
 */
const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-on-accent shadow-xs hover:bg-accent-hover active:translate-y-px disabled:hover:bg-accent",
  secondary:
    "bg-surface text-text border border-border-input shadow-xs hover:bg-raised active:translate-y-px",
  ghost: "text-text-secondary hover:bg-raised hover:text-text",
  danger: "bg-danger text-on-accent shadow-xs hover:brightness-110 active:translate-y-px",
  link: "text-accent underline underline-offset-4 hover:text-accent-hover",
};

const sizes: Record<Size, string> = {
  // coarse: pointers get the 44px touch floor; cursors keep the tighter rhythm.
  sm: "h-9 coarse:h-11 px-3 text-sm gap-1.5 rounded-md",
  md: "h-10 coarse:h-11 px-4 text-sm gap-2 rounded-md",
  lg: "h-12 px-6 text-base gap-2 rounded-lg",
  icon: "size-10 coarse:size-11 rounded-md",
};

export function Button({
  variant = "primary",
  size = "md",
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  /** Render as the child element — lets a Button *be* a <Link> without nesting. */
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center font-medium whitespace-nowrap",
        "transition-[background-color,color,box-shadow,transform] duration-(--bh-duration-fast) ease-(--ease-out)",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
