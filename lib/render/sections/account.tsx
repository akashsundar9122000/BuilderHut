import { z } from "zod";

import { formatMoney } from "@/lib/money";
import type { RenderContext } from "../context";
import { AlignSchema, Heading, Lede, SectionShell, ToneSchema } from "./shared";
import { CustomerSignIn } from "@/components/storefront/CustomerSignIn";
import { CustomerSignUp } from "@/components/storefront/CustomerSignUp";
import { AccountOverview } from "@/components/storefront/AccountOverview";
import { identifierLabel } from "@/lib/customers/labels";

/*
 * The customer-account sections.
 *
 * Each belongs to exactly one system page — `onlyOn` in ../registry.tsx — so a
 * merchant can put a hero or a paragraph above their sign-in form without also
 * being able to drop a sign-in form halfway down the home page, or delete the one
 * on the page whose entire purpose it is.
 *
 * ONE RULE, at the top of all three components: no ctx.account means no live
 * form. It is keyed off that rather than off ctx.editing because the draft
 * preview renders with editing: false and must still not post — its base is
 * "/app/builder/preview", so a form that worked out its own slug would be
 * attempting a real sign-in at a shop that does not exist.
 */

export const AccountLoginProps = z.object({
  heading: z.string().max(80).default("Welcome back"),
  body: z.string().max(240).default(""),
  buttonLabel: z.string().max(40).default("Sign in"),
  showSignupLink: z.boolean().default(true),
  signupLabel: z.string().max(60).default("Create an account"),
  align: AlignSchema.default("center"),
  tone: ToneSchema,
});

export const AccountSignupProps = z.object({
  heading: z.string().max(80).default("Create an account"),
  body: z.string().max(240).default("So your next order already knows where to go."),
  buttonLabel: z.string().max(40).default("Create account"),
  askName: z.boolean().default(true),
  showSigninLink: z.boolean().default(true),
  align: AlignSchema.default("center"),
  tone: ToneSchema,
});

export const AccountAreaProps = z.object({
  heading: z.string().max(80).default("Your account"),
  recentOrders: z.number().int().min(1).max(10).default(3),
  showWishlist: z.boolean().default(true),
  showAddresses: z.boolean().default(true),
  tone: ToneSchema,
});

/*
 * What the builder canvas and the draft preview show: the shape of the form,
 * inert. The Newsletter section already does this for a form that is not wired
 * up yet; this is the same idea for one that must not be wired up here.
 */
/*
 * The canvas has no policy to read, because it has no store context — so the
 * sample shows the commonest arrangement rather than nothing. The live form uses
 * the store's real rules.
 */
const SAMPLE_POLICY = {
  identifier: "either",
  credential: "both",
  verification: "before_checkout",
  defaultCountry: "IN",
} as const;

function FormSample({
  fields,
  buttonLabel,
}: {
  fields: { label: string; type?: string }[];
  buttonLabel: string;
}) {
  return (
    <div className="mt-2 flex w-full flex-col gap-3">
      {fields.map((field) => (
        <label
          key={field.label}
          style={{ fontFamily: "var(--sf-font-body)", fontSize: "0.85rem", color: "var(--sf-muted)" }}
        >
          {field.label}
          <input
            type={field.type ?? "text"}
            disabled
            aria-label={field.label}
            style={{
              display: "block",
              width: "100%",
              minHeight: 46,
              marginTop: 6,
              padding: "0 14px",
              fontFamily: "var(--sf-font-body)",
              fontSize: "max(16px, 0.95rem)",
              color: "var(--sf-text)",
              background: "var(--sf-surface)",
              border: "max(1px, var(--sf-border-width)) solid var(--sf-border)",
              borderRadius: "var(--sf-button-radius)",
            }}
          />
        </label>
      ))}
      <span
        aria-disabled="true"
        style={{
          marginTop: 4,
          display: "inline-flex",
          minHeight: 46,
          alignItems: "center",
          justifyContent: "center",
          padding: "0 22px",
          background: "var(--sf-primary)",
          color: "var(--sf-on-primary)",
          borderRadius: "var(--sf-button-radius)",
          fontFamily: "var(--sf-font-body)",
          fontSize: "0.95rem",
        }}
      >
        {buttonLabel}
      </span>
    </div>
  );
}

export function AccountLogin({
  props,
  ctx,
}: {
  props: z.infer<typeof AccountLoginProps>;
  ctx: RenderContext;
}) {
  const body = (
    <div
      className="mx-auto flex w-full max-w-md flex-col gap-4"
      style={{ alignItems: props.align === "center" ? "center" : undefined }}
    >
      <Heading align={props.align} size="sm">
        {props.heading}
      </Heading>
      {props.body ? <Lede align={props.align}>{props.body}</Lede> : null}

      {ctx.account ? (
        <CustomerSignIn
          slug={ctx.account.slug}
          policy={ctx.account.policy}
          next={ctx.account.next}
          buttonLabel={props.buttonLabel}
          signupHref={props.showSignupLink ? "/signup" : null}
          signupLabel={props.signupLabel}
          base={ctx.base}
        />
      ) : (
        <FormSample
          fields={[
            // The sample asks for whatever the store's rules ask for, so the
            // merchant is previewing their own form and not a generic one.
            { label: identifierLabel(SAMPLE_POLICY) },
            { label: "Password", type: "password" },
          ]}
          buttonLabel={props.buttonLabel}
        />
      )}
    </div>
  );

  return <SectionShell tone={props.tone}>{body}</SectionShell>;
}

export function AccountSignup({
  props,
  ctx,
}: {
  props: z.infer<typeof AccountSignupProps>;
  ctx: RenderContext;
}) {
  return (
    <SectionShell tone={props.tone}>
      <div
        className="mx-auto flex w-full max-w-md flex-col gap-4"
        style={{ alignItems: props.align === "center" ? "center" : undefined }}
      >
        <Heading align={props.align} size="sm">
          {props.heading}
        </Heading>
        {props.body ? <Lede align={props.align}>{props.body}</Lede> : null}

        {ctx.account ? (
          <CustomerSignUp
            slug={ctx.account.slug}
            policy={ctx.account.policy}
            next={ctx.account.next}
            askName={props.askName}
            buttonLabel={props.buttonLabel}
            signinHref={props.showSigninLink ? "/login" : null}
            base={ctx.base}
          />
        ) : (
          <FormSample
            fields={[
              ...(props.askName ? [{ label: "Your name" }] : []),
              { label: "Email address" },
              { label: "Password", type: "password" },
            ]}
            buttonLabel={props.buttonLabel}
          />
        )}
      </div>
    </SectionShell>
  );
}

export function AccountArea({
  props,
  ctx,
}: {
  props: z.infer<typeof AccountAreaProps>;
  ctx: RenderContext;
}) {
  const summary = ctx.account?.summary;
  const customer = ctx.account?.customer ?? null;

  return (
    <SectionShell tone={props.tone}>
      <Heading size="sm">{props.heading}</Heading>

      {ctx.account && customer && summary ? (
        <AccountOverview
          base={ctx.base}
          slug={ctx.account.slug}
          customer={customer}
          summary={summary}
          recentOrders={props.recentOrders}
          showWishlist={props.showWishlist}
          showAddresses={props.showAddresses}
        />
      ) : (
        /*
         * The canvas has nobody signed in, so it shows what the page is FOR
         * rather than an empty state a merchant would read as broken.
         */
        <div
          style={{
            marginTop: 24,
            border: "1px dashed var(--sf-border)",
            borderRadius: "var(--sf-radius)",
            padding: "32px 24px",
            fontFamily: "var(--sf-font-body)",
            color: "var(--sf-muted)",
            fontSize: "0.9rem",
            lineHeight: 1.6,
          }}
        >
          Your customers see their orders{props.showAddresses ? ", saved addresses" : ""}
          {props.showWishlist ? " and saved items" : ""} here once they sign in. The last{" "}
          {props.recentOrders} {props.recentOrders === 1 ? "order" : "orders"} are shown first.
          <div style={{ marginTop: 12, color: "var(--sf-text)" }}>
            For example: order #1043 · {formatMoney(250000, "INR")} · Paid
          </div>
        </div>
      )}
    </SectionShell>
  );
}
