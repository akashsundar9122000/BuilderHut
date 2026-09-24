/*
 * What a merchant is paying for.
 *
 * Blueprint section 47. One file describes every plan, and nothing anywhere
 * else in the product hard-codes a limit — the pricing page, the entitlement
 * checks, the usage meters in settings and the platform console all read this.
 * A limit that lives in two places is a limit that will disagree with itself
 * the first time somebody edits one of them.
 *
 * Prices are integer minor units with an explicit currency, like every other
 * amount in the product (section 103). A plan's price is BuilderHut's revenue,
 * which is a different ledger from the merchant's GMV — see lib/platform.
 */

export const PLAN_IDS = ["free", "standard", "pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** A limit of `null` means "no ceiling on this plan", not "zero". */
export interface PlanLimits {
  products: number | null;
  /** People who can sign in to the shop's dashboard, including the owner. */
  staff: number | null;
  customDomains: number;
  /** Total size of the media library. */
  storageMb: number | null;
  /** Raw analytics retention. Rollups are kept regardless. */
  analyticsDays: number;
}

export interface PlanFeatures {
  /** Remove "Built on BuilderHut" from the storefront footer. */
  removeBranding: boolean;
  discountCodes: boolean;
  /** Abandoned-basket reminders and campaign sends. */
  marketingTools: boolean;
  /** The structured-ops assistant in the builder. */
  aiAssistant: boolean;
  /**
   * Letting customers sign in with a mobile number.
   *
   * Gated because every code is an SMS we pay for, unlike an email. Email
   * sign-in is on every plan.
   */
  customerPhoneAuth: boolean;
  prioritySupport: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  /** One line, in the merchant's terms, about who it is for. */
  blurb: string;
  priceMinor: number;
  currency: string;
  /** Billed monthly; an annual price is a later problem, not a Phase 8 one. */
  interval: "month";
  limits: PlanLimits;
  features: PlanFeatures;
  /** The one thing that makes this plan worth its price over the one below. */
  headline: string;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Starter",
    blurb: "For getting your first things online and seeing if people buy them.",
    priceMinor: 0,
    currency: "INR",
    interval: "month",
    headline: "A real shop, at a BuilderHut address",
    limits: {
      products: 15,
      staff: 1,
      customDomains: 0,
      storageMb: 250,
      analyticsDays: 30,
    },
    features: {
      removeBranding: false,
      discountCodes: false,
      marketingTools: false,
      aiAssistant: true,
      customerPhoneAuth: false,
      prioritySupport: false,
    },
  },
  standard: {
    id: "standard",
    name: "Standard",
    blurb: "For a shop that is already selling and wants its own address.",
    priceMinor: 49900,
    currency: "INR",
    interval: "month",
    headline: "Your own domain, and no BuilderHut in the footer",
    limits: {
      products: 300,
      staff: 3,
      customDomains: 1,
      storageMb: 5_000,
      analyticsDays: 180,
    },
    features: {
      removeBranding: true,
      discountCodes: true,
      marketingTools: false,
      aiAssistant: true,
      customerPhoneAuth: true,
      prioritySupport: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    blurb: "For a shop with staff, several addresses and things to send customers.",
    priceMinor: 149900,
    currency: "INR",
    interval: "month",
    headline: "Staff accounts, several domains and marketing",
    limits: {
      products: null,
      staff: null,
      customDomains: 5,
      storageMb: null,
      analyticsDays: 730,
    },
    features: {
      removeBranding: true,
      discountCodes: true,
      marketingTools: true,
      aiAssistant: true,
      customerPhoneAuth: true,
      prioritySupport: true,
    },
  },
};

export const ORDERED_PLANS: Plan[] = PLAN_IDS.map((id) => PLANS[id]);

export const DEFAULT_PLAN: PlanId = "free";

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
}

/** Where a plan sits in the ladder. Used to tell an upgrade from a downgrade. */
export function planRank(id: PlanId): number {
  return PLAN_IDS.indexOf(id);
}

export type LimitKey = keyof PlanLimits;
export type FeatureKey = keyof PlanFeatures;

/**
 * The cheapest plan that allows something.
 *
 * What a merchant needs when they hit a ceiling is not "upgrade" but "this is
 * on Standard" — so every refusal can name the plan that would let them do it.
 */
export function cheapestPlanWith(feature: FeatureKey): Plan | null {
  return ORDERED_PLANS.find((plan) => plan.features[feature]) ?? null;
}

export function cheapestPlanFor(limit: LimitKey, needed: number): Plan | null {
  return (
    ORDERED_PLANS.find((plan) => {
      const value = plan.limits[limit];
      return value === null || value >= needed;
    }) ?? null
  );
}
