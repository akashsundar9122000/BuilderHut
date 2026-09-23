import Link from "next/link";
import type { Metadata } from "next";
import { Package, Plus } from "lucide-react";

import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { listProducts } from "@/lib/products/service";
import { archiveProductAction } from "./actions";

export const metadata: Metadata = { title: "Products" };

const STATUS_TONE = { active: "success", draft: "neutral", archived: "warning" } as const;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string; saved?: string }>;
}) {
  const [items, { added, saved }] = await Promise.all([listProducts(), searchParams]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl leading-tight">Products</h1>
          <p className="text-muted mt-1.5 text-sm">
            {items.length === 0
              ? "Everything you sell lives here."
              : `${items.length} product${items.length === 1 ? "" : "s"} in your catalogue.`}
          </p>
        </div>
        <Button asChild>
          <Link href="/app/products/new">
            <Plus className="size-4" />
            Add product
          </Link>
        </Button>
      </header>

      {added || saved ? (
        <p className="border-success/30 bg-success-soft text-text mb-5 rounded-md border px-3 py-2 text-sm">
          {added ? "Product added." : "Changes saved, and live on your shop."}
        </p>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title="Your catalogue is empty"
          description="Add your first product and your storefront stops being a placeholder."
          action={{ label: "Add product", href: "/app/products/new" }}
        />
      ) : (
        <Card className="overflow-hidden">
          {/* A table on desktop, stacked rows on a phone — not a table squeezed. */}
          <ul className="divide-border divide-y">
            {items.map((product) => (
              <li
                key={product.id}
                className="hover:bg-raised flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors sm:px-5"
              >
                {product.imageUrl ? (
                  // The merchant's own upload, served from our /media route.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.imageUrl}
                    alt=""
                    className="bg-sunken border-border size-11 shrink-0 rounded-md border object-cover"
                  />
                ) : (
                  <div
                    className="bg-sunken border-border size-11 shrink-0 rounded-md border"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0 flex-1">
                  {/*
                    * The name is the link to editing it. A product that could
                    * be created and archived but never changed made a typo in
                    * a price permanent.
                    */}
                  <Link
                    href={`/app/products/${product.id}`}
                    className="text-text hover:text-accent block truncate text-sm font-medium transition-colors"
                  >
                    {product.name}
                  </Link>
                  <p className="text-muted truncate text-xs">
                    {product.sku ? `${product.sku} · ` : ""}/{product.slug}
                  </p>
                </div>
                <p className="text-text text-sm tabular-nums">
                  {formatMoney(product.priceMinor, product.currency)}
                </p>
                <Badge tone={STATUS_TONE[product.status]}>{product.status}</Badge>
                <form action={archiveProductAction}>
                  <input type="hidden" name="id" value={product.id} />
                  <Button type="submit" variant="ghost" size="sm" className="text-muted">
                    Archive
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
