import { AiPlanSchema, type AiPlan } from "./ops";

/*
 * One interface, so the assistant does not know or care who answered.
 *
 * NVIDIA NIM is the configured backend. It is OpenAI-compatible, so the client
 * in nvidia.ts is a plain fetch — no SDK, no vendor types leaking upwards. When
 * no model is configured, or the call fails or times out, the offline planner
 * answers instead. That is not a stub: it is a rule-based interpreter that
 * handles the common instructions, and it is what the tests run against so the
 * suite is deterministic and needs no network.
 */

export interface PlanRequest {
  instruction: string;
  /** A compact description of the page being edited. Never customer data. */
  context: string;
}

export interface PlanResponse {
  plan: AiPlan;
  /** Which backend answered. Shown in the UI — the merchant should know. */
  source: "nvidia" | "offline";
  /** Set when the model was asked and could not answer. */
  note?: string;
}

export interface AiProvider {
  readonly name: "nvidia" | "offline";
  plan(request: PlanRequest): Promise<AiPlan>;
}

export const SYSTEM_PROMPT = `You edit an online store's page by proposing operations. You never write HTML, CSS or code.

Reply with JSON only, no prose and no markdown fence, in exactly this shape:
{"summary": "one sentence for the shop owner", "ops": [ ... ]}

Each op is one of:
{"op":"setProp","sectionId":"<id from the page>","prop":"<setting name>","value":<any>}
{"op":"addSection","sectionType":"<type>","afterSectionId":"<id or null>"}
{"op":"removeSection","sectionId":"<id>"}
{"op":"moveSection","sectionId":"<id>","afterSectionId":"<id or null>"}
{"op":"setVisible","sectionId":"<id>","visible":true|false}
{"op":"setTheme","group":"colors"|"typography"|"shape","key":"<key>","value":<any>}

Rules:
- Only use sectionIds that appear in the page description.
- Section types: header, hero, productGrid, featureList, richText, imageBanner, gallery, testimonials, faq, newsletter, contact, footer.
- colors keys are background, surface, raised, text, muted, border, primary, onPrimary, accent, and values are hex strings.
- typography keys are heading, body (one of fraunces, playfair, lora, instrument, inter, dmsans, worksans, spacegrotesk, archivo), scale (0.8-1.4), headingWeight (400/500/600/700), headingTracking (-0.06-0.2), headingTransform ("none"/"uppercase").
- shape keys are radius (0-32), buttonRadius (0-999), sectionSpacing (32-200), borderWidth (0-3).
- Never touch a section marked locked.
- Propose the smallest set of changes that does what was asked. Fewer, better ops.
- Write copy the way a shop owner would say it out loud. No marketing filler, no exclamation marks, no words like "elevate", "unleash" or "seamless".`;

/**
 * Pull a plan out of whatever the model returned.
 *
 * Models wrap JSON in prose or a fence however firmly they are told not to, so
 * this finds the outermost object and parses that. A reply that still does not
 * yield a valid plan is an error, not something to salvage — a half-understood
 * instruction editing a live storefront is worse than no answer.
 */
export function parsePlan(raw: string): AiPlan {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("The assistant replied with something that was not a plan.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    throw new Error("The assistant replied with something that was not a plan.");
  }

  const result = AiPlanSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("The assistant proposed changes in a shape we don't accept.");
  }
  return result.data;
}
