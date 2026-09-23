"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { Button, Field, Input } from "@/components/ui";
import {
  refundOrderAction,
  transitionOrderAction,
  type OrderActionState,
} from "@/app/(dashboard)/app/orders/actions";
import { LABELS, type OrderStatus } from "@/lib/commerce/order-state";

/*
 * What a merchant can do to an order, and nothing else.
 *
 * The buttons shown are exactly the transitions the state machine permits from
 * where this order currently is. Rendering every status and letting the server
 * reject most of them would be a worse experience and a worse habit — the UI
 * should not offer something it knows will fail.
 */
export function OrderActions({
  orderId,
  next,
}: {
  orderId: string;
  next: OrderStatus[];
}) {
  const [state, submit, pending] = useActionState<OrderActionState, FormData>(
    transitionOrderAction,
    {},
  );

  if (next.length === 0) {
    return (
      <p className="text-muted text-xs leading-relaxed">
        This order is finished. Nothing further to do.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {next
          .filter((status) => status !== "refunded" && status !== "partially_refunded")
          .map((status) => (
            <form key={status} action={submit}>
              <input type="hidden" name="orderId" value={orderId} />
              <input type="hidden" name="to" value={status} />
              <Button
                type="submit"
                size="sm"
                variant={status === "cancelled" ? "ghost" : "secondary"}
                disabled={pending}
              >
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Mark {LABELS[status].toLowerCase()}
              </Button>
            </form>
          ))}
      </div>
      {state.error ? (
        <p role="alert" className="text-danger mt-3 text-xs">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

export function RefundForm({
  orderId,
  currency,
  remainingLabel,
}: {
  orderId: string;
  currency: string;
  remainingLabel: string;
}) {
  const [state, submit, pending] = useActionState<OrderActionState, FormData>(
    refundOrderAction,
    {},
  );

  if (state.ok) {
    return <p className="text-success text-sm">Refund recorded.</p>;
  }

  return (
    <form action={submit} className="flex flex-col gap-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="currency" value={currency} />

      <Field
        label={`Amount (${currency})`}
        htmlFor="refund-amount"
        hint={`${remainingLabel} left to refund.`}
        error={state.error}
      >
        <Input id="refund-amount" name="amount" inputMode="decimal" placeholder="499" required />
      </Field>

      <Field label="Reason" htmlFor="refund-reason" hint="Kept for your records only.">
        <Input id="refund-reason" name="reason" placeholder="Arrived damaged" />
      </Field>

      <Button type="submit" variant="danger" size="sm" disabled={pending}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
        {pending ? "Refunding" : "Refund"}
      </Button>

      <p className="text-faint text-xs leading-relaxed">
        Payments are simulated, so this records the refund against the order without moving
        money. A real gateway will make the same call.
      </p>
    </form>
  );
}
