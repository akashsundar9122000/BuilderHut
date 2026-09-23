"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui";

/*
 * Blueprint section 42: a failure is a state with a way out, not a stack trace.
 *
 * The digest is shown deliberately — it is the only thing that connects what a
 * merchant saw to what we can find in the logs, and "quote this code" is a far
 * better support conversation than "it said something went wrong".
 *
 * What is NOT shown is error.message: on the server it can carry a query, a
 * column name or a connection string, and Next only redacts it in production.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard]", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <h1 className="font-display text-text text-2xl">That page didn&rsquo;t load</h1>
      <p className="text-muted mt-2 text-sm leading-relaxed">
        Something went wrong on our side, not yours. Nothing you&rsquo;ve saved is affected — try
        again, and if it keeps happening send us the code below.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RefreshCw className="size-4" />
          Try again
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/app">Back to the dashboard</Link>
        </Button>
      </div>

      {error.digest ? (
        <p className="text-faint mt-6 font-mono text-xs">Reference {error.digest}</p>
      ) : null}
    </div>
  );
}
