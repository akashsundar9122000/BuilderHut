import Link from "next/link";

import { Button } from "@/components/ui";

export default function DashboardNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <h1 className="font-display text-text text-2xl">We couldn&rsquo;t find that</h1>
      <p className="text-muted mt-2 text-sm leading-relaxed">
        The page, product or order you were looking for has either been deleted or never existed.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/app">Back to the dashboard</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/app/products">Your products</Link>
        </Button>
      </div>
    </div>
  );
}
