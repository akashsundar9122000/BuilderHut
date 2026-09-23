/*
 * The simulated gateway's test cards.
 *
 * Kept apart from the provider itself because the checkout form needs to LIST
 * them in the browser, and the provider is server-only — it reaches for
 * node:crypto, which cannot be bundled for a client. Importing the provider
 * from a client component dragged the whole thing into the browser build and
 * broke it.
 *
 * These numbers are the well-known test values every gateway sandbox uses. None
 * is a real card, and nothing here ever leaves the browser except as a choice
 * of which outcome to simulate.
 */

export const TEST_CARDS = [
  { number: "4242 4242 4242 4242", label: "Payment succeeds", outcome: "succeeded" },
  { number: "4000 0000 0000 0002", label: "Card declined", outcome: "failed" },
  { number: "4000 0000 0000 0119", label: "Payment stays pending", outcome: "pending" },
  { number: "4000 0000 0000 0069", label: "Gateway times out", outcome: "timeout" },
] as const;

export type DummyOutcome = (typeof TEST_CARDS)[number]["outcome"];

export function outcomeForCard(cardNumber: string): DummyOutcome {
  const digits = cardNumber.replace(/\D/g, "");
  const match = TEST_CARDS.find((card) => card.number.replace(/\D/g, "") === digits);
  // An unrecognised number succeeds, so a merchant poking at their own checkout
  // to see what it looks like is not stopped by a decline they cannot explain.
  return match?.outcome ?? "succeeded";
}
