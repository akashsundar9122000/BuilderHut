import "server-only";

import { eq, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { getRootDb } from "@/lib/db/client";
import {
  auditLogs,
  shippingMethods,
  shippingZones,
  siteVersions,
  storeSettings,
  tenantMembers,
  tenants,
  websites,
} from "@/lib/db/schema";
import { SCHEMA_VERSION } from "@/lib/schema/page";
import { checkSlug } from "@/lib/slug";
import { buildDocument } from "@/lib/templates";

/*
 * Creating a store is the one operation that cannot go through withTenant():
 * the tenant does not exist yet, so there is no context to enter.
 *
 * It still has to be atomic. A tenant with no owner is unadministrable; an
 * owner row pointing at a tenant that failed to insert is a foreign key
 * violation; a tenant with no website is a dashboard that 404s. So this opens
 * the root transaction directly and sets the tenant context inside it, which is
 * what lets the tenant-scoped websites insert satisfy its RLS policy in the
 * same transaction that created the tenant it belongs to.
 *
 * This is the documented exception. Everything downstream uses runForTenant.
 */

export interface CreateStoreInput {
  userId: string;
  name: string;
  slug: string;
  industry: string;
  templateId: string;
  currency: string;
  country: string;
  timezone: string;
  salesChannel: string;
  goal: string;
}

export type CreateStoreResult =
  | { ok: true; tenantId: string; websiteId: string; slug: string }
  | { ok: false; field: "slug" | "form"; message: string };

export async function createStore(input: CreateStoreInput): Promise<CreateStoreResult> {
  const shape = checkSlug(input.slug);
  if (!shape.ok) return { ok: false, field: "slug", message: shape.reason };

  if (input.name.trim().length < 2) {
    return { ok: false, field: "form", message: "Your store needs a name." };
  }

  const db = getRootDb();

  // One store per person for now. The schema models many, and the plan exposes
  // them later; letting one account create unlimited stores today is a free
  // way to fill the database.
  const existing = await db
    .select({ id: tenantMembers.id })
    .from(tenantMembers)
    .where(eq(tenantMembers.userId, input.userId))
    .limit(1);
  if (existing.length > 0) {
    return { ok: false, field: "form", message: "This account already has a store." };
  }

  const tenantId = uuidv7();
  const websiteId = uuidv7();
  const versionId = uuidv7();

  /*
   * Build the starting document before opening the transaction. It is pure and
   * it validates, so a malformed template fails here rather than half way
   * through creating a store.
   */
  let document;
  try {
    document = buildDocument(input.templateId, {
      storeName: input.name.trim(),
      tagline: "",
      industry: input.industry,
    });
  } catch {
    return { ok: false, field: "form", message: "That template couldn't be loaded." };
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(tenants).values({
        id: tenantId,
        name: input.name.trim(),
        slug: input.slug,
        industry: input.industry,
        currency: input.currency,
        country: input.country,
        timezone: input.timezone,
      });

      await tx.insert(tenantMembers).values({
        id: uuidv7(),
        tenantId,
        userId: input.userId,
        role: "owner",
        acceptedAt: new Date(),
      });

      // websites is tenant-scoped and RLS-protected. The policy reads
      // app.tenant_id, so it has to be set before the insert — inside this same
      // transaction, with SET LOCAL, so it cannot leak onto the pooled
      // connection once the transaction ends.
      await tx.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`);
      await tx.execute(sql`SELECT set_config('app.actor_id', ${input.userId}, true)`);
      await tx.execute(sql`SELECT set_config('app.actor_role', 'owner', true)`);

      await tx.insert(websites).values({
        id: websiteId,
        tenantId,
        name: input.name.trim(),
        templateId: input.templateId,
        draftState: document,
        draftRevision: 1,
      });

      /*
       * Publish version 1 immediately.
       *
       * A merchant who has just chosen a template expects their store to exist,
       * not to be a draft awaiting a ceremony they have not been told about.
       * The publish FLOW — readiness checklist, progress, rollback — arrives in
       * Phase 4; the versioning mechanism it depends on has to be right from
       * the first store, because retrofitting immutability is not possible.
       */
      await tx.insert(siteVersions).values({
        id: versionId,
        tenantId,
        websiteId,
        versionNumber: 1,
        schemaVersion: SCHEMA_VERSION,
        snapshot: document,
        createdBy: input.userId,
        note: `Created from the ${input.templateId} template`,
      });

      await tx
        .update(websites)
        .set({ publishedVersionId: versionId, publishedAt: new Date() })
        .where(eq(websites.id, websiteId));

      /*
       * Commerce defaults, so the checkout works the moment a product exists.
       *
       * A store that opens with no delivery option has a checkout that cannot
       * complete, and the merchant has no way to know why. Two options is the
       * smallest set that is actually useful: post it, or come and collect.
       *
       * No tax rule is created. Blueprint section 13 is explicit that a
       * jurisdiction's rate must not be assumed as universal truth — guessing
       * 18% GST for a merchant in Manchester would put a wrong number on their
       * invoices, which is worse than putting none.
       */
      await tx.insert(storeSettings).values({ id: uuidv7(), tenantId });

      const zoneId = uuidv7();
      await tx.insert(shippingZones).values({
        id: zoneId,
        tenantId,
        name: input.country === "IN" ? "India" : "Everywhere",
        countries: input.country === "IN" ? ["IN"] : [],
      });

      await tx.insert(shippingMethods).values([
        {
          id: uuidv7(),
          tenantId,
          zoneId,
          name: "Standard delivery",
          description: "3–5 working days",
          kind: "flat",
          priceMinor: 0n,
          position: 0,
        },
        {
          id: uuidv7(),
          tenantId,
          zoneId,
          name: "Collect in person",
          description: "Arrange a time with us after ordering",
          kind: "free",
          priceMinor: 0n,
          isPickup: true,
          position: 1,
        },
      ]);

      await tx.insert(auditLogs).values({
        id: uuidv7(),
        tenantId,
        actorId: input.userId,
        actorRole: "owner",
        action: "store.created",
        entityType: "tenant",
        entityId: tenantId,
        metadata: {
          slug: input.slug,
          industry: input.industry,
          templateId: input.templateId,
          salesChannel: input.salesChannel,
          goal: input.goal,
        },
      });
    });
  } catch (error) {
    // The slug is globally unique, and two people can pick the same one in the
    // same second. That is a form error, not a server fault.
    const message = error instanceof Error ? error.message : String(error);
    if (/tenants_slug_key|duplicate key/i.test(message)) {
      return {
        ok: false,
        field: "slug",
        message: "Someone just took that address. Try another.",
      };
    }
    console.error("[createStore] failed:", error);
    return { ok: false, field: "form", message: "We couldn't create your store. Please try again." };
  }

  return { ok: true, tenantId, websiteId, slug: input.slug };
}

/** Is this address free? Used by the wizard as the merchant types. */
export async function isSlugAvailable(slug: string): Promise<boolean> {
  if (!checkSlug(slug).ok) return false;
  const rows = await getRootDb()
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  return rows.length === 0;
}
