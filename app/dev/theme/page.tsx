import { PackageOpen } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Skeleton,
  Textarea,
  ThemeToggle,
} from "@/components/ui";

/*
 * The design system, rendered. Every token, type step and primitive on one page
 * so the identity can be judged as a whole — and so a token change that looks
 * fine in isolation but wrong next to its neighbours is visible immediately.
 */

const SURFACES = [
  ["canvas", "bg-canvas", "the page itself"],
  ["surface", "bg-surface", "cards, panels"],
  ["raised", "bg-raised", "a sheet lifted off the page"],
  ["sunken", "bg-sunken", "wells, inset fields"],
] as const;

const TEXT = [
  ["text", "text-text", "body copy, headings"],
  ["text-secondary", "text-text-secondary", "labels, supporting copy"],
  ["muted", "text-muted", "captions, metadata"],
  ["faint", "text-faint", "placeholders, disabled"],
] as const;

const ACCENTS = [
  ["accent", "bg-accent", "clay — the one colour that means 'act'"],
  ["accent-2", "bg-accent-2", "botanical green — secondary emphasis"],
  ["success", "bg-success", "completed, live, paid"],
  ["warning", "bg-warning", "needs attention"],
  ["danger", "bg-danger", "destructive, failed"],
  ["info", "bg-info", "neutral information"],
] as const;

// Written out in full: Tailwind scans source for literal class names, so a
// template-built `bg-${name}` compiles to nothing at all.
const CHARTS = [
  ["chart-1", "bg-chart-1"],
  ["chart-2", "bg-chart-2"],
  ["chart-3", "bg-chart-3"],
  ["chart-4", "bg-chart-4"],
  ["chart-5", "bg-chart-5"],
  ["chart-6", "bg-chart-6"],
] as const;

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border border-t pt-10">
      <h2 className="font-display text-2xl">{title}</h2>
      {note ? <p className="text-muted mt-1 text-sm">{note}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function ThemePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <header className="flex items-start justify-between gap-6 pb-10">
        <div>
          <p className="text-accent text-xs font-medium tracking-[0.18em] uppercase">
            BuilderHut design system
          </p>
          <h1 className="font-display mt-2 text-4xl leading-tight">Warm editorial</h1>
          <p className="text-muted mt-2 max-w-lg text-sm">
            Bone paper, ink text, a single clay accent, and an old-style serif against a quiet
            grotesque. Toggle the theme — dark is a re-derivation, not an inversion.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex flex-col gap-12">
        <Section title="Type" note="Fraunces for display, Inter for interface.">
          <div className="flex flex-col gap-4">
            <p className="font-display text-6xl leading-[1.02]">Sell what you make</p>
            <p className="font-display text-4xl leading-tight">Your storefront, live today</p>
            <p className="font-display text-2xl">Handmade, and it shows</p>
            <p className="max-w-prose text-base">
              Body copy sits in Inter at a comfortable measure. The serif is reserved for headlines
              and the occasional pull quote, which is what keeps it feeling editorial rather than
              decorative.
            </p>
            <p className="text-muted max-w-prose text-sm">
              Supporting copy drops to the muted token and a smaller step, so hierarchy comes from
              contrast and scale rather than from adding another colour.
            </p>
          </div>
        </Section>

        <Section title="Surfaces" note="Paper, stacked. Fine borders and low, soft shadows.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SURFACES.map(([name, cls, why]) => (
              <div key={name} className="border-border overflow-hidden rounded-lg border">
                <div className={`${cls} h-20`} />
                <div className="bg-surface border-border border-t px-3 py-2">
                  <p className="font-mono text-xs">{name}</p>
                  <p className="text-muted mt-0.5 text-xs">{why}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {(["shadow-xs", "shadow-sm", "shadow-md"] as const).map((s) => (
              <div key={s} className={`bg-surface rounded-lg p-5 ${s}`}>
                <p className="font-mono text-xs">{s}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Text" note="Four steps of emphasis. All clear WCAG AA on every surface.">
          <div className="flex flex-col gap-2">
            {TEXT.map(([name, cls, why]) => (
              <div
                key={name}
                className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4"
              >
                <span className={`${cls} text-base sm:w-56`}>The quick brown fox</span>
                <span className="font-mono text-xs">{name}</span>
                <span className="text-muted text-xs">{why}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Colour" note="Used sparingly and with intent — never decoration.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ACCENTS.map(([name, cls, why]) => (
              <div key={name} className="border-border overflow-hidden rounded-lg border">
                <div className={`${cls} h-16`} />
                <div className="bg-surface border-border border-t px-3 py-2">
                  <p className="font-mono text-xs">{name}</p>
                  <p className="text-muted mt-0.5 text-xs">{why}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <p className="text-muted mb-2 text-xs">Chart series</p>
            <div className="flex gap-2">
              {CHARTS.map(([name, cls]) => (
                <div key={name} className={`${cls} h-12 flex-1 rounded-md`} title={name} />
              ))}
            </div>
          </div>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Create my store</Button>
              <Button variant="secondary">Explore templates</Button>
              <Button variant="ghost">Cancel</Button>
              <Button variant="danger">Delete store</Button>
              <Button variant="link">Learn more</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button disabled>Disabled</Button>
            </div>
          </div>
        </Section>

        <Section title="Badges">
          <div className="flex flex-wrap gap-2">
            <Badge>Draft</Badge>
            <Badge tone="accent">Featured</Badge>
            <Badge tone="success">Live</Badge>
            <Badge tone="warning">Low stock</Badge>
            <Badge tone="danger">Payment failed</Badge>
            <Badge tone="info">Pending</Badge>
          </div>
        </Section>

        <Section title="Forms" note="Inputs sit at 16px minimum so iOS Safari never zooms on focus.">
          <div className="grid max-w-md gap-4">
            <Field label="Store name" htmlFor="t-name" hint="This is how customers will find you.">
              <Input id="t-name" placeholder="Thread & Bloom" />
            </Field>
            <Field label="Store description" htmlFor="t-desc">
              <Textarea id="t-desc" placeholder="Handmade crochet flowers and gift sets." />
            </Field>
            <Field label="Slug" htmlFor="t-slug" error="That address is already taken.">
              <Input id="t-slug" defaultValue="thread-and-bloom" aria-invalid />
            </Field>
          </div>
        </Section>

        <Section title="Cards">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue</CardTitle>
                <CardDescription>Last 30 days</CardDescription>
              </CardHeader>
              <CardBody>
                <p className="font-display text-4xl">₹1,24,500</p>
                <p className="text-success mt-1 text-sm">+12.4% vs previous 30 days</p>
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Orders</CardTitle>
                <CardDescription>Last 30 days</CardDescription>
              </CardHeader>
              <CardBody>
                <p className="font-display text-4xl">312</p>
                <p className="text-muted mt-1 text-sm">+4.1% vs previous 30 days</p>
              </CardBody>
            </Card>
          </div>
        </Section>

        <Section title="States" note="No screen ships with a blank table or a dead end.">
          <div className="flex flex-col gap-4">
            <EmptyState
              icon={<PackageOpen />}
              title="Your catalog is empty"
              description="Add your first product and start building your store."
              action={{ label: "Add product" }}
            />
            <ErrorState description="We couldn't load your orders. This is usually temporary." />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          </div>
        </Section>
      </div>
    </main>
  );
}
