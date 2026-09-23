"use client";

import { useState, useTransition } from "react";
import { Clock, Loader2, Mail, UserMinus } from "lucide-react";

import { Button, Card, CardBody, Field, Input } from "@/components/ui";
import {
  inviteMemberAction,
  removeMemberAction,
  revokeInvitationAction,
  setMemberRoleAction,
} from "@/app/(dashboard)/app/team/actions";
import { ASSIGNABLE_ROLES, ROLE_BLURBS, ROLE_LABELS, type MemberRole } from "@/lib/team/roles";

/*
 * The team screen.
 *
 * Roles are chosen with their descriptions visible, not from a list of four
 * words. "Staff" means nothing on its own; "orders and customers, can't change
 * prices" is a decision somebody can actually make about a colleague.
 */

interface Member {
  userId: string;
  name: string | null;
  email: string;
  role: MemberRole;
  isYou: boolean;
}

interface Invitation {
  id: string;
  email: string;
  role: MemberRole;
  expiresAt: Date;
  expired: boolean;
}

export function TeamPanel({
  members,
  invitations,
  canManage,
  atLimit,
  planName,
}: {
  members: Member[];
  invitations: Invitation[];
  canManage: boolean;
  atLimit: boolean;
  planName: string | null;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("staff");
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();

  function run(work: () => Promise<{ ok: boolean; message?: string }>, success?: string) {
    setMessage(null);
    start(async () => {
      const result = await work();
      if (result.ok) {
        if (success) setMessage({ tone: "ok", text: success });
      } else {
        setMessage({ tone: "bad", text: result.message ?? "That didn't work." });
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {canManage ? (
        <Card>
          <CardBody className="flex flex-col gap-4">
            <p className="text-faint text-[0.65rem] font-medium tracking-[0.14em] uppercase">
              Invite somebody
            </p>

            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                run(() => inviteMemberAction(email, role), `Invitation sent to ${email}.`);
                setEmail("");
              }}
            >
              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field label="Their email address" htmlFor="invite-email">
                  <Input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="colleague@example.com"
                    required
                  />
                </Field>
                <Button type="submit" disabled={pending || atLimit || !email.trim()}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                  Send invitation
                </Button>
              </div>

              <fieldset className="flex flex-col gap-2">
                <legend className="text-text-secondary mb-1 text-sm font-medium">
                  What they can do
                </legend>
                {ASSIGNABLE_ROLES.map((option) => (
                  <label
                    key={option}
                    className="border-border hover:border-accent flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors has-checked:border-accent has-checked:bg-accent-soft"
                  >
                    <input
                      type="radio"
                      name="role"
                      value={option}
                      checked={role === option}
                      onChange={() => setRole(option)}
                      className="accent-accent mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="text-text block text-sm font-medium">
                        {ROLE_LABELS[option]}
                      </span>
                      <span className="text-muted block text-xs leading-snug">
                        {ROLE_BLURBS[option]}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>

              {atLimit ? (
                <p className="text-warning text-xs">
                  This plan is full.{planName ? ` ${planName} makes room for more.` : ""}
                </p>
              ) : null}
            </form>
          </CardBody>
        </Card>
      ) : null}

      {message ? (
        <p
          role={message.tone === "bad" ? "alert" : "status"}
          className={
            message.tone === "bad"
              ? "text-danger bg-danger-soft rounded-md px-3 py-2 text-sm"
              : "text-text bg-success-soft border-success/30 rounded-md border px-3 py-2 text-sm"
          }
        >
          {message.text}
        </p>
      ) : null}

      <Card className="overflow-hidden">
        <ul className="divide-border divide-y">
          {members.map((member) => (
            <li
              key={member.userId}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-text truncate text-sm font-medium">
                  {member.name ?? member.email}
                  {member.isYou ? <span className="text-muted font-normal"> · you</span> : null}
                </p>
                <p className="text-muted truncate text-xs">{member.email}</p>
              </div>

              {canManage && member.role !== "owner" && !member.isYou ? (
                <>
                  <label className="sr-only" htmlFor={`role-${member.userId}`}>
                    Role for {member.email}
                  </label>
                  <select
                    id={`role-${member.userId}`}
                    defaultValue={member.role}
                    disabled={pending}
                    onChange={(event) =>
                      run(
                        () => setMemberRoleAction(member.userId, event.target.value),
                        `${member.email} is now ${ROLE_LABELS[event.target.value as MemberRole].toLowerCase()}.`,
                      )
                    }
                    className="bg-surface border-border-input text-text h-9 rounded-md border px-2 text-sm coarse:h-11"
                  >
                    {ASSIGNABLE_ROLES.map((option) => (
                      <option key={option} value={option}>
                        {ROLE_LABELS[option]}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted"
                    disabled={pending}
                    onClick={() =>
                      run(() => removeMemberAction(member.userId), `${member.email} was removed.`)
                    }
                  >
                    <UserMinus className="size-4" />
                    Remove
                  </Button>
                </>
              ) : (
                <span className="text-muted text-sm">{ROLE_LABELS[member.role]}</span>
              )}
            </li>
          ))}

          {invitations.map((invitation) => (
            <li
              key={invitation.id}
              className="bg-raised/50 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5"
            >
              <Clock className="text-faint size-4 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-text truncate text-sm">{invitation.email}</p>
                <p className="text-muted truncate text-xs">
                  {invitation.expired
                    ? "Invitation expired"
                    : `Invited as ${ROLE_LABELS[invitation.role].toLowerCase()} · hasn't accepted yet`}
                </p>
              </div>
              {canManage ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => revokeInvitationAction(invitation.id),
                      `The invitation to ${invitation.email} was cancelled.`,
                    )
                  }
                >
                  Cancel
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
