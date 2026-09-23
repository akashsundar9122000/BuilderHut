"use client";

import { useActionState, useState } from "react";
import { ExternalLink, Loader2, Search } from "lucide-react";

import { Badge, Button, Card, Input } from "@/components/ui";
import { setStoreStatusAction, type AdminState } from "@/app/(platform)/admin/actions";
import { formatMoney } from "@/lib/money";
import type { StoreRow } from "@/lib/platform/queries";

/*
 * Blueprint section 15's store explorer.
 *
 * A dense table, which this screen has actually earned — an operator scanning
 * for a shop is comparing rows. Each one pairs the figures with the actions
 * that follow from them, so noticing something and doing something about it are
 * not two different screens.
 */
export function StoreTable({ stores, search }: { stores: StoreRow[]; search: string }) {
  const [query, setQuery] = useState(search);

  return (
    <div>
      <form className="mb-5 flex max-w-sm items-center gap-2">
        <div className="relative flex-1">
          <Search className="text-muted pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
          <Input
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Shop name, address or owner"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary" size="sm">
          Search
        </Button>
      </form>

      {stores.length === 0 ? (
        <Card>
          <p className="text-muted px-5 py-10 text-center text-sm">
            {search ? `Nothing matches "${search}".` : "No shops yet."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-border text-muted border-b text-left text-xs">
                <th className="px-4 py-2.5 font-medium">Shop</th>
                <th className="px-4 py-2.5 font-medium">Owner</th>
                <th className="px-4 py-2.5 font-medium">Trade</th>
                <th className="px-4 py-2.5 text-right font-medium">Products</th>
                <th className="px-4 py-2.5 text-right font-medium">Orders</th>
                <th className="px-4 py-2.5 text-right font-medium">Sales</th>
                <th className="px-4 py-2.5 text-right font-medium">Visitors</th>
                <th className="px-4 py-2.5 font-medium">State</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {stores.map((store) => (
                <StoreRowView key={store.id} store={store} />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function StoreRowView({ store }: { store: StoreRow }) {
  const [state, submit, pending] = useActionState<AdminState, FormData>(
    setStoreStatusAction,
    {},
  );
  const [confirming, setConfirming] = useState(false);
  const suspended = store.status === "suspended";

  return (
    <>
      <tr className="hover:bg-raised transition-colors">
        <td className="px-4 py-3">
          <p className="text-text">{store.name}</p>
          <p className="text-muted font-mono text-xs">/s/{store.slug}</p>
        </td>
        <td className="text-muted px-4 py-3 text-xs break-all">{store.ownerEmail ?? "—"}</td>
        <td className="text-muted px-4 py-3 text-xs capitalize">{store.industry}</td>
        <td className="text-text px-4 py-3 text-right tabular-nums">{store.products}</td>
        <td className="text-text px-4 py-3 text-right tabular-nums">{store.orders}</td>
        <td className="text-text px-4 py-3 text-right tabular-nums">
          {formatMoney(store.gmvMinor, "INR")}
        </td>
        <td className="text-text px-4 py-3 text-right tabular-nums">{store.visitors}</td>
        <td className="px-4 py-3">
          <Badge tone={suspended ? "danger" : store.published ? "success" : "neutral"}>
            {suspended ? "Suspended" : store.published ? "Live" : "Draft"}
          </Badge>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            <a
              href={`/s/${store.slug}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${store.name}`}
              className="text-muted hover:text-text grid size-8 place-items-center rounded-md transition-colors"
            >
              <ExternalLink className="size-3.5" />
            </a>
            {suspended ? (
              <form action={submit}>
                <input type="hidden" name="tenantId" value={store.id} />
                <input type="hidden" name="status" value="active" />
                <Button type="submit" size="sm" variant="ghost" disabled={pending}>
                  {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Restore
                </Button>
              </form>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted"
                onClick={() => setConfirming((v) => !v)}
              >
                Suspend
              </Button>
            )}
          </div>
        </td>
      </tr>

      {confirming && !suspended ? (
        <tr className="bg-raised">
          <td colSpan={9} className="px-4 py-4">
            {/*
              Suspending takes a shop off the internet. The reason is required
              because somebody will have to review this later, and "suspended by
              an admin, no reason recorded" is not reviewable.
            */}
            <form action={submit} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="tenantId" value={store.id} />
              <input type="hidden" name="status" value="suspended" />
              <label className="flex-1" style={{ minWidth: 260 }}>
                <span className="text-text-secondary mb-1.5 block text-sm">
                  Why is {store.name} being suspended?
                </span>
                <Input name="reason" placeholder="Selling counterfeit goods — reported by…" required />
              </label>
              <Button type="submit" variant="danger" size="sm" disabled={pending}>
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Suspend this shop
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </form>
            {state.error ? (
              <p role="alert" className="text-danger mt-2 text-sm">
                {state.error}
              </p>
            ) : null}
            <p className="text-faint mt-2 text-xs">
              Their storefront stops resolving immediately, including any custom domain. The
              merchant keeps their data and can be restored at any time.
            </p>
          </td>
        </tr>
      ) : null}
    </>
  );
}
