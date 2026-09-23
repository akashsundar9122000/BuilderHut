import "server-only";

import { randomBytes } from "node:crypto";
import { promises as dns } from "node:dns";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { runForTenant } from "@/lib/auth/session";
import { getRootDb } from "@/lib/db/client";
import { auditLogs, domains, tenants } from "@/lib/db/schema";
import { checkHostname, dnsInstructions, normaliseHostname } from "./hostname";

/*
 * Connecting a domain.
 *
 * Verification is real: it asks DNS what the merchant's records actually say
 * and reports what it found. A screen that claimed "verified" without checking
 * would be worse than none — the merchant would point customers at a domain
 * that does not resolve and have no idea why.
 *
 * Nothing here talks to a registrar or issues a certificate. On Vercel the
 * domain still has to be added to the project, and that step is stated plainly
 * rather than implied. Buying domains is designed but unbuilt; see the
 * registrar note at the bottom.
 */

export const EXPECTED_CNAME = "cname.builderhut.app";
export const EXPECTED_A = "76.76.21.21";

export type DomainRow = typeof domains.$inferSelect;

export interface DomainView extends DomainRow {
  records: ReturnType<typeof dnsInstructions>;
  isApex: boolean;
}

function decorate(row: DomainRow): DomainView {
  const check = checkHostname(row.normalizedHostname);
  const isApex = check.ok ? check.isApex : false;
  return {
    ...row,
    isApex,
    records: dnsInstructions(row.normalizedHostname, row.verificationToken, isApex),
  };
}

export async function listDomains(): Promise<DomainView[]> {
  const rows = await runForTenant((db) => db.select(domains).orderBy(domains.createdAt));
  return rows.map(decorate);
}

export type AddResult = { ok: true; id: string } | { ok: false; message: string };

export async function addDomain(hostname: string): Promise<AddResult> {
  const check = checkHostname(hostname);
  if (!check.ok) return { ok: false, message: check.reason };

  /*
   * The uniqueness check is global, so it has to run outside the tenant scope —
   * an RLS-scoped read would not see another store's claim and the insert would
   * fail on the constraint with an unhelpful message.
   */
  const taken = await getRootDb()
    .select({ id: domains.id })
    .from(domains)
    .where(eq(domains.normalizedHostname, check.hostname))
    .limit(1);
  if (taken.length > 0) {
    return {
      ok: false,
      message: "That domain is already connected to a shop. If it's yours, disconnect it there first.",
    };
  }

  const id = uuidv7();
  const existing = await runForTenant((db) => db.select(domains));

  await runForTenant(async (db) => {
    await db.insert(domains, {
      id,
      hostname: hostname.trim(),
      normalizedHostname: check.hostname,
      verificationToken: `bh-verify-${randomBytes(16).toString("hex")}`,
      // The first domain a shop connects becomes its primary; there is nothing
      // for it to compete with.
      isPrimary: existing.length === 0,
    });

    await db.raw.insert(auditLogs).values({
      id: uuidv7(),
      tenantId: db.ctx.tenantId,
      actorId: db.ctx.actorId,
      action: "domain.added",
      entityType: "domain",
      entityId: id,
      metadata: { hostname: check.hostname },
    });
  });

  return { ok: true, id };
}

export interface CheckResult {
  status: DomainRow["status"];
  detail: string;
}

/**
 * Ask DNS what the merchant's records actually say.
 *
 * Both checks run even when the first fails, so the screen can say "ownership
 * proven, but it isn't pointing here yet" rather than stopping at the first
 * problem and making them guess what comes next.
 */
export async function verifyDomain(domainId: string): Promise<CheckResult> {
  const [row] = await runForTenant((db) =>
    db.select(domains).where(eq(domains.id, domainId)).limit(1),
  );
  if (!row) return { status: "pending", detail: "That domain is no longer connected." };

  const host = row.normalizedHostname;
  const check = checkHostname(host);
  const isApex = check.ok ? check.isApex : false;

  let ownershipProven = false;
  let ownershipDetail = "No _builderhut TXT record found yet.";
  try {
    const records = await dns.resolveTxt(`_builderhut.${host}`);
    const flattened = records.map((parts) => parts.join(""));
    ownershipProven = flattened.includes(row.verificationToken);
    ownershipDetail = ownershipProven
      ? "Ownership confirmed."
      : `Found a TXT record, but not the expected value. Seen: ${flattened[0]?.slice(0, 40) ?? "(empty)"}`;
  } catch {
    // ENOTFOUND and ENODATA both just mean "not there yet".
  }

  let pointsHere = false;
  let pointingDetail = "";
  try {
    if (isApex) {
      const addresses = await dns.resolve4(host);
      pointsHere = addresses.includes(EXPECTED_A);
      pointingDetail = pointsHere
        ? "Pointing here."
        : `An A record exists but points at ${addresses[0] ?? "nothing"}, not ${EXPECTED_A}.`;
    } else {
      const targets = await dns.resolveCname(host);
      pointsHere = targets.some((t) => t.replace(/\.$/, "") === EXPECTED_CNAME);
      pointingDetail = pointsHere
        ? "Pointing here."
        : `A CNAME exists but points at ${targets[0] ?? "nothing"}, not ${EXPECTED_CNAME}.`;
    }
  } catch {
    pointingDetail = isApex
      ? "No A record found yet."
      : "No CNAME found yet.";
  }

  const status: DomainRow["status"] = ownershipProven && pointsHere
    ? "verified"
    : ownershipProven || pointsHere
      ? "misconfigured"
      : "pending";

  const detail = `${ownershipDetail} ${pointingDetail}`.trim();

  await runForTenant((db) =>
    db.update(
      domains,
      {
        status,
        lastCheckDetail: detail,
        dnsCheckedAt: new Date(),
        verifiedAt: status === "verified" ? (row.verifiedAt ?? new Date()) : null,
      },
      eq(domains.id, domainId),
    ),
  );

  return { status, detail };
}

export async function setPrimaryDomain(domainId: string): Promise<{ ok: boolean; message?: string }> {
  return runForTenant(async (db) => {
    const [row] = await db.select(domains).where(eq(domains.id, domainId)).limit(1);
    if (!row) return { ok: false, message: "That domain is no longer connected." };
    if (row.status !== "verified" && row.status !== "active") {
      return { ok: false, message: "Verify the domain before making it the main one." };
    }

    // Clear first: the unique partial index refuses two primaries, and doing
    // this in one transaction means there is never a moment with none.
    const all = await db.select(domains);
    for (const other of all) {
      if (other.isPrimary) await db.update(domains, { isPrimary: false }, eq(domains.id, other.id));
    }
    await db.update(domains, { isPrimary: true, status: "active" }, eq(domains.id, domainId));
    return { ok: true };
  });
}

export async function removeDomain(domainId: string): Promise<{ ok: boolean }> {
  const rows = await runForTenant((db) => db.delete(domains, eq(domains.id, domainId)));
  return { ok: rows.length > 0 };
}

/**
 * Hostname to store slug, for routing.
 *
 * Runs unscoped because the caller is an anonymous visitor: the hostname IS the
 * identification. Only active domains resolve, so disconnecting one stops it
 * serving immediately.
 */
export async function resolveHostname(hostname: string): Promise<{ slug: string } | null> {
  const normalised = normaliseHostname(hostname);
  if (!normalised) return null;

  const rows = await getRootDb()
    .select({ slug: tenants.slug, status: domains.status, tenantStatus: tenants.status })
    .from(domains)
    .innerJoin(tenants, eq(tenants.id, domains.tenantId))
    .where(eq(domains.normalizedHostname, normalised))
    .limit(1);

  const row = rows[0];
  if (!row || row.status !== "active" || row.tenantStatus !== "active") return null;
  return { slug: row.slug };
}

/*
 * TODO(phase-8): buying a domain.
 *
 * Blueprint section 14 asks for search, suggestions, pricing and checkout, and
 * for the UI not to be coupled to one registrar. The shape that fits is a
 * DomainRegistrar interface — search(), price(), purchase(), transfer() — with
 * the same treatment the payment provider got: one real implementation, no
 * pretending, and the order system depending on normalised states rather than a
 * registrar's vocabulary. Nothing here is built, and nothing claims to be.
 */
