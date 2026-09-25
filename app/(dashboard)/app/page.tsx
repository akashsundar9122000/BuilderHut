import Link from "next/link";
import { ArrowUpRight, Check, Circle, ExternalLink, Package, Palette } from "lucide-react";

import { Badge, Button, Card, CardBody } from "@/components/ui";
import { requireActor } from "@/lib/auth/session";
import { countOrderRevenue } from "@/lib/commerce/orders";
import { formatMoney } from "@/lib/money";
import { productStats } from "@/lib/products/service";

/*
 * Blueprint section 88's hierarchy, honestly scaled to what exists.
 *
 * Revenue, orders and conversion arrive with commerce in Phase 3. Showing them
 * now as zeroes would be a lie dressed as a dashboard — section 101 rule 16 is
 * explicit — so what leads instead is the thing a new merchant actually needs:
 * the checklist that gets their store ready.
 */

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const [actor, stats, { welcome }] = await Promise.all([
    requireActor(),
    productStats(),
    searchParams,
  ]);
  const revenue = await countOrderRevenue(actor.tenantId!);

  const storeUrl = `/s/${actor.tenantSlug}`;
  const firstName = actor.name.split(" ")[0];

  const checklist = [
    { done: true, label: "Create your store", hint: "Done when you picked a template." },
    { done: stats.total > 0, label: "Add your first product", hint: "A photo, a name and a price is enough.", href: "/app/products/new" },
    { done: stats.active > 0, label: "Make a product live", hint: "Draft products don't show on your storefront." },
    { done: revenue.orders > 0, label: "Take a test order", hint: "Buy from your own shop to see the whole flow.", href: `/s/${actor.tenantSlug}` },
    { done: false, label: "Customise your storefront", hint: "Change the words, colours and pictures.", href: "/app/builder" },
    { done: false, label: "Set up delivery", hint: "Arrives with commerce.", soon: true },
    { done: false, label: "Connect a domain", hint: "Arrives with hosting.", soon: true },
  ];
  const complete = checklist.filter((c) => c.done).length;

  return (
    <div className="mx-auto max-w-(--bh-dash-w)">
      {welcome ? (
        <div className="border-accent-border bg-accent-soft mb-6 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3">
          <p className="text-text text-sm">
            <span className="font-medium">Your store is live.</span> It&rsquo;s empty, but it&rsquo;s real.
          </p>
          <Button asChild size="sm" variant="secondary" className="ml-auto">
            <a href={storeUrl} target="_blank" rel="noreferrer">
              Visit it <ExternalLink className="size-3.5" />
            </a>
          </Button>
        </div>
      ) : null}

      <header className="mb-8">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">
          {greeting()}, {firstName}
        </h1>
        <p className="text-muted mt-1.5 text-sm">
          {stats.total === 0
            ? "Your storefront is built. Now it needs something to sell."
            : `Here's what's happening with ${actor.tenantName}.`}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardBody>
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-lg">Get your store ready</h2>
              <span className="text-muted text-sm">
                {complete} of {checklist.length}
              </span>
            </div>
            <div className="bg-sunken mt-3 h-1 overflow-hidden rounded-full">
              <div
                className="bg-accent h-full rounded-full transition-[width] duration-(--bh-duration-slow) ease-(--ease-out)"
                style={{ width: `${(complete / checklist.length) * 100}%` }}
              />
            </div>

            <ul className="mt-5 flex flex-col">
              {checklist.map((item) => (
                <li
                  key={item.label}
                  className="border-border flex items-center gap-3 border-b py-3 last:border-0"
                >
                  {item.done ? (
                    <span className="bg-success text-on-accent grid size-5 shrink-0 place-items-center rounded-full">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  ) : (
                    <Circle className="text-border-strong size-5 shrink-0" strokeWidth={1.5} />
                  )}
                  <div className="min-w-0">
                    <p className={item.done ? "text-muted text-sm line-through" : "text-text text-sm"}>
                      {item.label}
                    </p>
                    <p className="text-faint text-xs">{item.hint}</p>
                  </div>
                  {!item.done && item.href ? (
                    <Button asChild size="sm" variant="secondary" className="ml-auto shrink-0">
                      <Link href={item.href}>Fix now</Link>
                    </Button>
                  ) : null}
                  {item.soon ? <Badge className="ml-auto shrink-0">Soon</Badge> : null}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <CardBody>
              <p className="text-muted text-xs tracking-[0.12em] uppercase">Revenue</p>
              <p className="font-display mt-2 text-4xl">
                {formatMoney(revenue.netMinor, "INR")}
              </p>
              <p className="text-muted mt-1 text-sm">
                {revenue.orders} order{revenue.orders === 1 ? "" : "s"}
                {revenue.refundedMinor > 0
                  ? ` · ${formatMoney(revenue.refundedMinor, "INR")} refunded`
                  : ""}
              </p>
              {revenue.pending > 0 ? (
                <p className="text-warning mt-1 text-xs">
                  {revenue.pending} awaiting payment
                </p>
              ) : null}
              <Button asChild size="sm" variant="secondary" className="mt-4 w-full">
                <Link href="/app/orders">View orders</Link>
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <p className="text-muted text-xs tracking-[0.12em] uppercase">Products</p>
              <p className="font-display mt-2 text-4xl">{stats.total}</p>
              <p className="text-muted mt-1 text-sm">
                {stats.active} live
                {stats.draft > 0 ? ` · ${stats.draft} in draft` : ""}
              </p>
              <Button asChild size="sm" className="mt-4 w-full">
                <Link href="/app/products/new">
                  <Package className="size-4" />
                  Add a product
                </Link>
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <p className="text-muted text-xs tracking-[0.12em] uppercase">Your storefront</p>
              <p className="text-text mt-2 font-mono text-sm break-all">/s/{actor.tenantSlug}</p>
              <p className="text-muted mt-2 text-xs leading-relaxed">
                A custom domain comes later. This address works now and keeps working.
              </p>
              <Button asChild size="sm" variant="secondary" className="mt-4 w-full">
                <a href={storeUrl} target="_blank" rel="noreferrer">
                  Open storefront <ArrowUpRight className="size-3.5" />
                </a>
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="flex items-center gap-2">
                <Palette className="text-accent size-4" />
                <p className="text-text text-sm font-medium">Make it yours</p>
              </div>
              <p className="text-muted mt-2 text-xs leading-relaxed">
                Drag sections around, change the colours and type, and watch it change as
                you go.
              </p>
              <Button asChild size="sm" variant="secondary" className="mt-4 w-full">
                <Link href="/app/builder">Open the builder</Link>
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
