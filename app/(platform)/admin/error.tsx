"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin]", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <h1 className="font-display text-text text-2xl">That view didn&rsquo;t load</h1>
      <p className="text-muted mt-2 text-sm leading-relaxed">
        The console failed to read something it needed. No merchant data has been changed.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RefreshCw className="size-4" />
          Try again
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/admin">Overview</Link>
        </Button>
      </div>
      {error.digest ? (
        <p className="text-faint mt-6 font-mono text-xs">Reference {error.digest}</p>
      ) : null}
    </div>
  );
}
