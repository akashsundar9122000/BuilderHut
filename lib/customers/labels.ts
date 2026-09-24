import type { AccountPolicyView } from "@/lib/render/context";

/*
 * What to call the sign-in field, given what the store accepts.
 *
 * Shared by the section that draws the inert sample and the client island that
 * draws the real form, so the two cannot end up asking for different things.
 * No "server-only" here: a client component imports it.
 */

export function identifierLabel(policy: AccountPolicyView): string {
  switch (policy.identifier) {
    case "email_only":
      return "Email address";
    case "phone_only":
      return "Mobile number";
    default:
      return "Email address or mobile number";
  }
}

export function identifierPlaceholder(policy: AccountPolicyView): string {
  switch (policy.identifier) {
    case "email_only":
      return "you@example.com";
    case "phone_only":
      return "98765 43210";
    default:
      return "you@example.com";
  }
}

/** The right keyboard on a phone, which is most of them. */
export function identifierInputType(policy: AccountPolicyView): "email" | "tel" | "text" {
  switch (policy.identifier) {
    case "email_only":
      return "email";
    case "phone_only":
      return "tel";
    default:
      // "text", not "email": an email keyboard makes a mobile number awkward to
      // type, and the browser would mark a valid number as an invalid address.
      return "text";
  }
}

export function identifierAutoComplete(policy: AccountPolicyView): string {
  switch (policy.identifier) {
    case "email_only":
      return "email";
    case "phone_only":
      return "tel";
    default:
      return "username";
  }
}
