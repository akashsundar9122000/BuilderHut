import type { Metadata } from "next";

import { StoreTable } from "@/components/platform/StoreTable";
import { requirePlatformAdmin } from "@/lib/platform/guard";
import { loadStores } from "@/lib/platform/queries";

export const metadata: Metadata = { title: "Stores" };

export default async function AdminStoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const actor = await requirePlatformAdmin();
  const { q = "" } = await searchParams;
  const stores = await loadStores(actor.userId, q);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl leading-tight">Stores</h1>
        <p className="text-muted mt-1.5 text-sm">
          {stores.length} shop{stores.length === 1 ? "" : "s"}
          {q ? ` matching "${q}"` : ""}. Sales figures cover all time.
        </p>
      </header>
      <StoreTable stores={stores} search={q} />
    </div>
  );
}
