"use client";

import { Builder } from "@/components/builder/Builder";
import type { SiteDocument } from "@/lib/schema/page";

export function ReproClient({ doc }: { doc: SiteDocument }) {
  return <Builder initialDoc={doc} initialRevision={1} storeSlug="repro" products={[]} />;
}
