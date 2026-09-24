import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { Users } from "lucide-react";

import { Badge, Card, EmptyState } from "@/components/ui";
import { runForTenant } from "@/lib/auth/session";
import { customers, orders, storeSettings } from "@/lib/db/schema";
import { formatMoney } from "@/lib/money";
import { countsAsRevenue, type OrderStatus } from "@/lib/commerce/order-state";

export const metadata: Metadata = { title: "Customers" };

/** What this shop currently asks a customer for, in a sentence. */
function signInSentence(identifier: string): string {
  switch (identifier) {
    case "phone_only":
      return "Customers sign in with a mobile number.";
    case "either":
      return "Customers sign in with an email address or a mobile number.";
    case "both":
      return "Customers sign in with both an email address and a mobile number.";
    default:
      return "Customers sign in with an email address.";
  }
}

/*
 * Whether this person's contact detail has been proven.
 *
 * Only worth showing where the shop actually asks — at a store that confirms
 * nobody, every row would carry a badge that means nothing.
 */
function unconfirmed(person: {
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
}): boolean {
  if (person.email && !person.emailVerified) return true;
  return Boolean(person.phone && !person.phoneVerified && !person.email);
}

export default async function CustomersPage() {
  const { people, byCustomer, settings } = await runForTenant(async (db) => {
    const people = await db.select(customers).orderBy(desc(customers.createdAt)).limit(200);
    const allOrders = await db.select(orders).limit(1000);

    /*
     * Totals are computed from orders rather than kept on the customer row.
     * A denormalised "lifetime value" column is one refund away from being
     * wrong, and nothing would ever tell you.
     */
    const byCustomer = new Map<string, { orders: number; spentMinor: number; currency: string }>();
    for (const order of allOrders) {
      if (!order.customerId) continue;
      const entry = byCustomer.get(order.customerId) ?? {
        orders: 0,
        spentMinor: 0,
        currency: order.currency,
      };
      entry.orders += 1;
      if (countsAsRevenue(order.status as OrderStatus)) {
        entry.spentMinor += Number(order.totalMinor) - Number(order.refundedMinor);
      }
      byCustomer.set(order.customerId, entry);
    }
    const [settings] = await db.select(storeSettings).limit(1);
    return { people, byCustomer, settings: settings ?? null };
  });

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-7">
        <h1 className="font-display text-3xl leading-tight">Customers</h1>
        <p className="text-muted mt-1.5 text-sm">
          {people.length === 0
            ? "Everyone who buys from you will appear here."
            : `${people.length} ${people.length === 1 ? "person has" : "people have"} bought from you.`}
        </p>
        <p className="text-muted mt-1 text-xs">
          {signInSentence(settings?.customerIdentifier ?? "email_only")}{" "}
          <a href="/app/settings" className="underline underline-offset-4">
            Change this in store settings
          </a>
          .
        </p>
      </header>

      {people.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="No customers yet"
          description="When someone places an order, their details are kept here so you can see what they've bought before."
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-border divide-y">
            {people.map((person) => {
              const stats = byCustomer.get(person.id);
              return (
                <li
                  key={person.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-text truncate text-sm">
                      {person.name ?? person.email ?? person.phone}
                    </p>
                    {person.name ? (
                      <p className="text-muted truncate text-xs">{person.email ?? person.phone}</p>
                    ) : null}
                  </div>
                  {/*
                    * Account or guest, which is the distinction this whole feature
                    * turns on: "bought once without signing in" and "has an account
                    * they can come back to" are different people to talk to.
                    */}
                  <Badge tone={person.passwordHash || person.lastLoginAt ? "accent" : "neutral"}>
                    {person.passwordHash || person.lastLoginAt ? "Account" : "Guest"}
                  </Badge>
                  {unconfirmed(person) ? (
                    <Badge tone="neutral">Unconfirmed</Badge>
                  ) : null}
                  <span className="text-muted text-xs">
                    {stats?.orders ?? 0} order{stats?.orders === 1 ? "" : "s"}
                  </span>
                  <span className="text-text text-sm tabular-nums">
                    {formatMoney(stats?.spentMinor ?? 0, stats?.currency ?? "INR")}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
