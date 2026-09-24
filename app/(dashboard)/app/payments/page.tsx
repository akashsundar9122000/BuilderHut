import type { Metadata } from "next";
import { appUrl } from "@/lib/app-url";
import { AlertTriangle, CheckCircle2, CreditCard } from "lucide-react";

import { Badge, Card, CardBody } from "@/components/ui";
import { requireActor } from "@/lib/auth/session";
import { defaultProviderId, getPaymentProvider } from "@/lib/payments/dummy";
import { TEST_CARDS } from "@/lib/payments/test-cards";

export const metadata: Metadata = { title: "Payments" };

/*
 * How this shop takes money.
 *
 * The one thing this screen must never do is let a merchant believe money is
 * moving when it is not. Whether the gateway is simulated is the first thing
 * on the page, in the loudest available terms.
 */
export default async function PaymentsPage() {
  await requireActor();

  const providerId = defaultProviderId();
  const provider = getPaymentProvider(providerId);
  const base = appUrl();

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-7">
        <h1 className="font-display text-3xl leading-tight">Payments</h1>
        <p className="text-muted mt-1.5 text-sm">How your shop takes money from customers.</p>
      </header>

      <Card className={provider.isSimulated ? "border-warning/40" : undefined}>
        <CardBody className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <CreditCard className="text-muted size-5" aria-hidden />
            <p className="text-text flex-1 text-sm font-medium">{provider.displayName}</p>
            {provider.isSimulated ? (
              <Badge tone="warning">Simulated</Badge>
            ) : (
              <Badge tone="success">Live</Badge>
            )}
          </div>

          {provider.isSimulated ? (
            <div className="text-text-secondary flex items-start gap-2.5 text-sm leading-relaxed">
              <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                <strong className="text-text">No real money moves.</strong> Orders, refunds and
                revenue all work so you can rehearse the whole thing, but nothing is charged and
                nothing arrives in a bank account. Connect Razorpay below when you&rsquo;re ready
                to sell for real.
              </p>
            </div>
          ) : (
            <div className="text-text-secondary flex items-start gap-2.5 text-sm leading-relaxed">
              <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                Real payments are going through Razorpay. Money settles to the bank account on
                your Razorpay profile, not to BuilderHut.
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {provider.isSimulated ? (
        <>
          <Card className="mt-5">
            <CardBody>
              <p className="text-faint mb-3 text-[0.65rem] font-medium tracking-[0.14em] uppercase">
                Test cards
              </p>
              <p className="text-muted mb-4 text-sm">
                Use these at your own checkout to rehearse each outcome. The number decides what
                happens — nothing is stored.
              </p>
              <ul className="divide-border divide-y">
                {TEST_CARDS.map((card) => (
                  <li key={card.number} className="flex flex-wrap items-baseline gap-x-4 py-2.5">
                    <code className="text-text font-mono text-sm tabular-nums">{card.number}</code>
                    <span className="text-muted flex-1 text-sm">{card.label}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card className="mt-5">
            <CardBody className="flex flex-col gap-3">
              <p className="text-faint text-[0.65rem] font-medium tracking-[0.14em] uppercase">
                Connecting Razorpay
              </p>
              <p className="text-muted text-sm leading-relaxed">
                Razorpay is wired in and takes over as soon as its keys are set. It needs three
                values from your Razorpay dashboard, added to this deployment&rsquo;s environment:
              </p>
              <ul className="text-text-secondary flex flex-col gap-1.5 text-sm">
                <li>
                  <code className="text-text font-mono text-xs">RAZORPAY_KEY_ID</code> and{" "}
                  <code className="text-text font-mono text-xs">RAZORPAY_KEY_SECRET</code> — from
                  Settings → API Keys.
                </li>
                <li>
                  <code className="text-text font-mono text-xs">RAZORPAY_WEBHOOK_SECRET</code> —
                  chosen by you when you add the webhook below.
                </li>
              </ul>
              <p className="text-muted text-sm leading-relaxed">
                Then add a webhook in Settings → Webhooks pointing at:
              </p>
              <code className="bg-sunken text-text rounded-md px-3 py-2 font-mono text-xs break-all">
                {base}/api/webhooks/razorpay
              </code>
              <p className="text-faint text-xs leading-relaxed">
                Subscribe it to <code className="font-mono">payment.captured</code>,{" "}
                <code className="font-mono">payment.failed</code> and{" "}
                <code className="font-mono">refund.processed</code>. The webhook is what actually
                marks an order paid — a customer closing the tab the moment they pay must not cost
                you the order.
              </p>
            </CardBody>
          </Card>
        </>
      ) : (
        <Card className="mt-5">
          <CardBody className="flex flex-col gap-3">
            <p className="text-faint text-[0.65rem] font-medium tracking-[0.14em] uppercase">
              Webhook
            </p>
            <p className="text-muted text-sm leading-relaxed">
              Razorpay should be sending events to this address. If orders are not being marked
              paid, this is the first thing to check.
            </p>
            <code className="bg-sunken text-text rounded-md px-3 py-2 font-mono text-xs break-all">
              {base}/api/webhooks/razorpay
            </code>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
