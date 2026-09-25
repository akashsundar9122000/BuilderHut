import type { Metadata } from "next";
import Link from "next/link";

import { TeamPanel } from "@/components/dashboard/TeamPanel";
import { requireActor } from "@/lib/auth/session";
import { PLANS } from "@/lib/plans/catalog";
import { planFor } from "@/lib/plans/entitlements";
import { listTeam } from "@/lib/team/service";

export const metadata: Metadata = { title: "Team" };

/*
 * Who else can run this shop.
 *
 * The roles have existed in the schema since Phase 0 and only `owner` was ever
 * created. This is where they become real — blueprint section 2.3.
 */
export default async function TeamPage() {
  const actor = await requireActor();
  const [{ members, invitations }, plan] = await Promise.all([
    listTeam(actor.tenantId!, actor.userId),
    planFor(actor.tenantId!),
  ]);

  const canManage = actor.role === "owner" || actor.role === "admin";
  const seatsUsed = members.length + invitations.filter((i) => !i.expired).length;
  const seatLimit = plan.limits.staff;

  return (
    <div className="mx-auto max-w-(--bh-dash-w)">
      <header className="mb-7">
        <h1 className="font-display text-3xl leading-tight">Team</h1>
        <p className="text-muted mt-1.5 text-sm">
          {seatLimit === null
            ? `${members.length} ${members.length === 1 ? "person" : "people"} on this shop.`
            : `${seatsUsed} of ${seatLimit} on ${plan.name}.`}{" "}
          {seatLimit !== null && seatsUsed >= seatLimit ? (
            <>
              {/*
                * Underlined always, not on hover. A link sitting inside a
                * sentence and marked only by colour is invisible to anyone who
                * cannot see that colour, and a hover state does not help on a
                * phone where there is no hover. axe calls this
                * link-in-text-block, and it is the one violation the merchant
                * sweep found the first time it ran with real credentials.
                */}
              <Link
                href="/app/plan"
                className="text-accent underline underline-offset-4 hover:no-underline"
              >
                A bigger plan
              </Link>{" "}
              makes room for more.
            </>
          ) : null}
        </p>
      </header>

      <TeamPanel
        members={members}
        invitations={invitations}
        canManage={canManage}
        atLimit={seatLimit !== null && seatsUsed >= seatLimit}
        planName={
          seatLimit !== null && seatsUsed >= seatLimit
            ? (PLANS.pro.limits.staff === null ? PLANS.pro.name : PLANS.standard.name)
            : null
        }
      />
    </div>
  );
}
