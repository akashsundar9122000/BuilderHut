---
title: Orders and refunds
summary: Why an order only offers some of the next steps, and why a refund is partial unless you say otherwise.
who: Merchants
icon: receipt
related: publishing
---

![An order's page: the items, the address, the payment, and the actions available at this point in its life.](shot:order-detail "Only the states that can follow this one are offered.")

## An order is a state machine, not a status field

An order can only move to a state that actually follows the one it is in. "Delivered" is not
offered until it has been sent; "sent" is not offered until it has been paid.

This is why the buttons change from one order to the next. It is not a permissions thing — it
is that a dropdown listing every state lets you mark something delivered that was never posted,
and then the history of that order is a lie.

## Refunds are partial by default

The amount box starts empty rather than filled in with the order total.

A chipped piece is worth a thousand rupees back, not the whole order and an argument about
return postage. Making partial the default costs one number typed; making full the default
costs the difference, every time somebody accepts it without thinking.

:::warning
A refund cannot be undone. It is a real movement of money — or in this build, a real record of
one — and reversing it means taking a fresh payment.
:::

## What the revenue figure counts

Paid, less refunded. Net, not gross.

A revenue number that counts refunded money is a number that lies to the person relying on it,
and it lies in the most expensive direction — upwards, at exactly the moment you are deciding
whether you can afford something.

## When a payment fails

A refused card leaves a **payable order**, not an empty basket. The order exists, the basket is
closed, and the customer pays against the order rather than building it a second time and
hoping the stock held.

From your side it appears in the orders list as unpaid, and the customer can be sent back to it.

:::faq
### Can I create an order myself?

Not in this build. Orders come from the shop.

### Can I change an order after it is placed?

You can move it through its states and refund it. The items and the prices are fixed, because
they are the record of what was actually agreed.

### What happens to stock on a refund?

Nothing automatic. Whether a refunded item comes back to you is a conversation, not a rule.
:::
