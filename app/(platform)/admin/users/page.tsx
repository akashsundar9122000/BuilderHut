import type { Metadata } from "next";
import { Search } from "lucide-react";

import { Badge, Button, Card, Input } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/platform/guard";
import { loadUsers } from "@/lib/platform/queries";

export const metadata: Metadata = { title: "People" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const actor = await requirePlatformAdmin();
  const { q = "" } = await searchParams;
  const users = await loadUsers(actor.userId, q);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl leading-tight">People</h1>
        <p className="text-muted mt-1.5 text-sm">
          {users.length} account{users.length === 1 ? "" : "s"}
          {q ? ` matching "${q}"` : ""}.
        </p>
      </header>

      <form className="mb-5 flex max-w-sm items-center gap-2">
        <div className="relative flex-1">
          <Search className="text-muted pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
          <Input name="q" defaultValue={q} placeholder="Name or email" className="pl-9" />
        </div>
        <Button type="submit" variant="secondary" size="sm">
          Search
        </Button>
      </form>

      <Card className="overflow-hidden">
        <ul className="divide-border divide-y">
          {users.map((user) => (
            <li key={user.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-text truncate text-sm">{user.name}</p>
                <p className="text-muted truncate text-xs">{user.email}</p>
              </div>
              {user.isPlatformAdmin ? <Badge tone="accent">Operator</Badge> : null}
              <Badge tone={user.emailVerified ? "success" : "warning"}>
                {user.emailVerified ? "Verified" : "Unverified"}
              </Badge>
              <span className="text-muted text-xs">
                {user.stores} shop{user.stores === 1 ? "" : "s"}
              </span>
              <span className="text-faint text-xs">
                {new Date(user.createdAt).toLocaleDateString()}
              </span>
            </li>
          ))}
          {users.length === 0 ? (
            <li className="text-muted px-4 py-10 text-center text-sm">Nobody matches that.</li>
          ) : null}
        </ul>
      </Card>

      {/*
        Deliberately read-only. Changing somebody's password, email or role from
        here would be an account takeover with a nice interface, and the cases
        that genuinely need it — a locked-out merchant — deserve a designed flow
        with its own audit trail rather than a button on a list.
      */}
      <p className="text-faint mt-5 text-xs leading-relaxed">
        This list is read-only. Changing an account&rsquo;s email, password or role needs a
        deliberate flow with its own audit trail, not a button here.
      </p>
    </div>
  );
}
