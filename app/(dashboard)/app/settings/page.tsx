import type { Metadata } from "next";

import { Card, CardBody } from "@/components/ui";
import { CustomerAccountsForm, StoreSettingsForm } from "@/components/dashboard/SettingsForms";
import { requireActor } from "@/lib/auth/session";
import { loadStoreSettings } from "@/lib/commerce/settings";
import { cheapestPlanWith } from "@/lib/plans/catalog";
import { hasFeature, planFor } from "@/lib/plans/entitlements";

export const metadata: Metadata = { title: "Store settings" };

export default async function SettingsPage() {
  const actor = await requireActor();
  const { settings, tenant } = await loadStoreSettings(actor.tenantId!);
  const [phoneAllowed, plan] = await Promise.all([
    hasFeature(actor.tenantId!, "customerPhoneAuth"),
    planFor(actor.tenantId!),
  ]);
  const neededPlan = cheapestPlanWith("customerPhoneAuth");

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-7">
        <h1 className="font-display text-3xl leading-tight">Store settings</h1>
        <p className="text-muted mt-1.5 text-sm">How your checkout behaves, and how customers sign in.</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardBody>
            <StoreSettingsForm
              initial={{
                checkoutMode: settings?.checkoutMode ?? "guest",
                requirePhone: settings?.requirePhone ?? true,
                allowOrderNotes: settings?.allowOrderNotes ?? true,
                showMarketingConsent: settings?.showMarketingConsent ?? true,
                gstin: settings?.gstin ?? "",
              }}
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CustomerAccountsForm
              initial={{
                identifier: settings?.customerIdentifier ?? "email_only",
                credential: settings?.customerCredential ?? "both",
                verification: settings?.customerVerification ?? "before_checkout",
              }}
              phoneAllowed={phoneAllowed}
              planName={plan.name}
              neededPlanName={neededPlan?.name ?? null}
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="font-display text-lg">Your shop</h2>
            <dl className="mt-4 flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-muted text-xs">Name</dt>
                <dd className="text-text">{tenant?.name}</dd>
              </div>
              <div>
                <dt className="text-muted text-xs">Address</dt>
                <dd className="text-text font-mono text-xs break-all">/s/{tenant?.slug}</dd>
              </div>
              <div>
                <dt className="text-muted text-xs">Currency</dt>
                <dd className="text-text">{tenant?.currency}</dd>
              </div>
              <div>
                <dt className="text-muted text-xs">Payments</dt>
                <dd className="text-text">
                  Test payments
                  <span className="text-faint block text-xs">
                    Simulated. No money moves until a real gateway is connected.
                  </span>
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
