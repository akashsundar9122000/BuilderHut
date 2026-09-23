import type { Metadata } from "next";
import { Truck } from "lucide-react";

import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { NewShippingForm } from "@/components/dashboard/SettingsForms";
import { toggleShippingAction } from "@/app/(dashboard)/app/settings-actions";
import { requireActor } from "@/lib/auth/session";
import { listShipping, loadStoreSettings } from "@/lib/commerce/settings";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Delivery" };

export default async function ShippingPage() {
  const actor = await requireActor();
  const [{ zones, methods }, { tenant }] = await Promise.all([
    listShipping(),
    loadStoreSettings(actor.tenantId!),
  ]);
  const currency = tenant?.currency ?? "INR";

  const price = (method: (typeof methods)[number]) => {
    if (method.isPickup || method.kind === "free") return "Free";
    if (method.kind === "free_over" && method.thresholdMinor) {
      return `${formatMoney(method.priceMinor, currency)}, free over ${formatMoney(method.thresholdMinor, currency)}`;
    }
    return formatMoney(method.priceMinor, currency);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl leading-tight">Delivery</h1>
          <p className="text-muted mt-1.5 text-sm">
            What customers can choose at checkout.
          </p>
        </div>
        {zones[0] ? <NewShippingForm zoneId={zones[0].id} currency={currency} /> : null}
      </header>

      {methods.length === 0 ? (
        <EmptyState
          icon={<Truck />}
          title="No delivery options"
          description="Without at least one, nobody can finish a checkout."
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-border divide-y">
            {methods.map((method) => (
              <li key={method.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="text-text text-sm">{method.name}</p>
                  {method.description ? (
                    <p className="text-muted text-xs">{method.description}</p>
                  ) : null}
                </div>
                {method.isPickup ? <Badge>Collection</Badge> : null}
                <span className="text-text text-sm">{price(method)}</span>
                <Badge tone={method.active ? "success" : "neutral"}>
                  {method.active ? "Live" : "Off"}
                </Badge>
                <form action={toggleShippingAction}>
                  <input type="hidden" name="id" value={method.id} />
                  <input type="hidden" name="active" value={String(!method.active)} />
                  <Button type="submit" variant="ghost" size="sm">
                    {method.active ? "Turn off" : "Turn on"}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-faint mt-5 text-xs leading-relaxed">
        Free-delivery thresholds are measured after any discount, so a ₹1,600 basket with
        ₹200 off is a ₹1,400 sale.
      </p>
    </div>
  );
}
