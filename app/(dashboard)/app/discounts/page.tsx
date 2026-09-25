import type { Metadata } from "next";
import { Percent } from "lucide-react";

import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { NewDiscountForm } from "@/components/dashboard/SettingsForms";
import { toggleDiscountAction } from "@/app/(dashboard)/app/settings-actions";
import { requireActor } from "@/lib/auth/session";
import { listDiscounts, loadStoreSettings } from "@/lib/commerce/settings";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Discounts" };

export default async function DiscountsPage() {
  const actor = await requireActor();
  const [codes, { tenant }] = await Promise.all([
    listDiscounts(),
    loadStoreSettings(actor.tenantId!),
  ]);
  const currency = tenant?.currency ?? "INR";

  const describe = (code: (typeof codes)[number]) => {
    if (code.kind === "free_shipping") return "Free delivery";
    if (code.kind === "percent") return `${Number(code.value) / 100}% off`;
    return `${formatMoney(code.value, currency)} off`;
  };

  return (
    <div className="mx-auto max-w-(--bh-dash-w)">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl leading-tight">Discounts</h1>
          <p className="text-muted mt-1.5 text-sm">
            Codes customers type at checkout.
          </p>
        </div>
        <NewDiscountForm currency={currency} />
      </header>

      {codes.length === 0 ? (
        <EmptyState
          icon={<Percent />}
          title="No discount codes yet"
          description="Create one for a launch, a festival, or to say sorry when something goes wrong."
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-border divide-y">
            {codes.map((code) => (
              <li key={code.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5">
                <span className="text-text font-mono text-sm">{code.code}</span>
                <span className="text-muted flex-1 text-sm">{describe(code)}</span>
                {code.minSubtotalMinor ? (
                  <span className="text-faint text-xs">
                    over {formatMoney(code.minSubtotalMinor, currency)}
                  </span>
                ) : null}
                <span className="text-faint text-xs">
                  used {code.redemptions}
                  {code.maxRedemptions ? ` of ${code.maxRedemptions}` : ""}
                </span>
                <Badge tone={code.active ? "success" : "neutral"}>
                  {code.active ? "Live" : "Off"}
                </Badge>
                <form action={toggleDiscountAction}>
                  <input type="hidden" name="id" value={code.id} />
                  <input type="hidden" name="active" value={String(!code.active)} />
                  <Button type="submit" variant="ghost" size="sm">
                    {code.active ? "Turn off" : "Turn on"}
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
