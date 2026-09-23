import type { Metadata } from "next";
import { Receipt } from "lucide-react";

import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { NewTaxForm } from "@/components/dashboard/SettingsForms";
import { toggleTaxAction } from "@/app/(dashboard)/app/settings-actions";
import { listTaxRules } from "@/lib/commerce/settings";

export const metadata: Metadata = { title: "Tax" };

export default async function TaxesPage() {
  const rules = await listTaxRules();

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl leading-tight">Tax</h1>
          <p className="text-muted mt-1.5 text-sm">
            One rule applies at a time. Turning a new one on turns the others off.
          </p>
        </div>
        <NewTaxForm />
      </header>

      {rules.length === 0 ? (
        <EmptyState
          icon={<Receipt />}
          title="No tax rule set"
          description="Nothing is added to your prices and nothing is broken out on invoices. Add a rule if that isn't right for you."
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-border divide-y">
            {rules.map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="text-text text-sm">{rule.name}</p>
                  <p className="text-muted text-xs">
                    {rule.rateBasisPoints / 100}% ·{" "}
                    {rule.inclusive ? "already in your prices" : "added at checkout"}
                  </p>
                </div>
                <Badge tone={rule.active ? "success" : "neutral"}>
                  {rule.active ? "Applying" : "Off"}
                </Badge>
                <form action={toggleTaxAction}>
                  <input type="hidden" name="id" value={rule.id} />
                  <input type="hidden" name="active" value={String(!rule.active)} />
                  <Button type="submit" variant="ghost" size="sm">
                    {rule.active ? "Turn off" : "Use this one"}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-faint mt-5 text-xs leading-relaxed">
        BuilderHut applies the rate you enter and does not know your local rules. Nothing
        here is tax advice — check the rate and whether it should be inclusive or exclusive
        with your accountant before you publish.
      </p>
    </div>
  );
}
