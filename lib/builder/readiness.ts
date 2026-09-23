import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { runForTenant } from "@/lib/auth/session";
import { domains, products, shippingMethods, storeSettings, websites } from "@/lib/db/schema";
import { SiteDocumentSchema } from "@/lib/schema/page";

/*
 * Is this shop ready to be published?
 *
 * Blueprint section 92 is specific that not every warning is a blocker, and
 * that matters: a merchant who wants to publish an empty shop to show a friend
 * should be able to. Only things that make the shop actually broken block —
 * no delivery option means a checkout that cannot complete, which is worse
 * than an unfinished shop.
 *
 * Everything else is said once, plainly, and then got out of the way.
 */

export type Severity = "blocker" | "warning" | "suggestion";

export interface ReadinessItem {
  id: string;
  severity: Severity;
  label: string;
  detail: string;
  /** Where to go and fix it. */
  href?: string;
}

export interface Readiness {
  items: ReadinessItem[];
  blockers: ReadinessItem[];
  canPublish: boolean;
}

export async function checkReadiness(): Promise<Readiness> {
  const items: ReadinessItem[] = [];

  await runForTenant(async (db) => {
    const [site] = await db.select(websites).limit(1);
    const live = await db
      .select(products)
      .where(and(eq(products.status, "active"), isNull(products.deletedAt)));
    const delivery = await db.select(shippingMethods).where(eq(shippingMethods.active, true));
    const [settings] = await db.select(storeSettings).limit(1);
    const connected = await db.select(domains);

    const doc = SiteDocumentSchema.safeParse(site?.draftState);

    /* ── Blockers: the shop would not work ─────────────────────────────── */

    if (!doc.success) {
      items.push({
        id: "document",
        severity: "blocker",
        label: "Your shop's layout can't be read",
        detail: "Something in the builder has gone wrong. Open it and try an edit, or restore an earlier version.",
        href: "/app/builder",
      });
      return;
    }

    if (!doc.data.pages.some((p) => p.system === "home")) {
      items.push({
        id: "home",
        severity: "blocker",
        label: "No home page",
        detail: "Your shop needs somewhere for people to land.",
        href: "/app/builder",
      });
    }

    if (delivery.length === 0) {
      items.push({
        id: "delivery",
        severity: "blocker",
        label: "No delivery option",
        detail: "Without one, nobody can finish a checkout — they'd reach the last step and be stuck.",
        href: "/app/shipping",
      });
    }

    /* ── Warnings: it will work, but not well ──────────────────────────── */

    if (live.length === 0) {
      items.push({
        id: "products",
        severity: "warning",
        label: "Nothing to sell yet",
        detail: "Your shop will publish, but visitors will find an empty catalogue.",
        href: "/app/products/new",
      });
    }

    const policies = ["shipping-policy", "refund-policy"];
    const untouched = doc.data.pages.filter(
      (page) =>
        policies.includes(page.slug) &&
        page.sections.some(
          (s) =>
            s.type === "richText" &&
            typeof s.props.body === "string" &&
            s.props.body.includes("This is a starting point"),
        ),
    );
    if (untouched.length > 0) {
      items.push({
        id: "policies",
        severity: "warning",
        label: "Your policies are still the sample text",
        detail:
          "Delivery and returns still say what we wrote. Customers read these, and so do payment providers.",
        href: "/app/builder",
      });
    }

    if (!doc.data.settings.logoUrl) {
      items.push({
        id: "logo",
        severity: "warning",
        label: "No logo",
        detail: "Your shop's name is shown as text. That's fine, but a logo looks more finished.",
        href: "/app/builder",
      });
    }

    /* ── Suggestions: worth doing eventually ───────────────────────────── */

    const socials = doc.data.settings.socials;
    if (!socials.instagram && !socials.whatsapp && !socials.email && !socials.phone) {
      items.push({
        id: "contact",
        severity: "suggestion",
        label: "No way to contact you",
        detail:
          "Most people who buy handmade things message first. Add WhatsApp or Instagram in the builder.",
        href: "/app/builder",
      });
    }

    const home = doc.data.pages.find((p) => p.system === "home");
    if (!home?.seo.description) {
      items.push({
        id: "seo",
        severity: "suggestion",
        label: "No description for search engines",
        detail: "One sentence about what you sell is what shows under your name in Google.",
        href: "/app/builder",
      });
    }

    if (connected.length === 0) {
      items.push({
        id: "domain",
        severity: "suggestion",
        label: "Using your BuilderHut address",
        detail: "That works perfectly well. Connect your own domain when you're ready.",
        href: "/app/domains",
      });
    }

    if (settings?.paymentProvider === "dummy") {
      items.push({
        id: "payments",
        severity: "suggestion",
        label: "Payments are simulated",
        detail:
          "You can take test orders end to end, but no money moves yet. Real payment providers are coming.",
      });
    }
  });

  const blockers = items.filter((i) => i.severity === "blocker");
  return { items, blockers, canPublish: blockers.length === 0 };
}
