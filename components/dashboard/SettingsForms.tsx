"use client";

import { useActionState, useState } from "react";
import { Loader2, Plus } from "lucide-react";

import { Button, Field, Input } from "@/components/ui";
import {
  createDiscountAction,
  createShippingAction,
  createTaxAction,
  saveContactDetailsAction,
  saveCustomerAccountsAction,
  saveSettingsAction,
  type SettingsState,
} from "@/app/(dashboard)/app/settings-actions";

/*
 * The forms behind the commerce settings screens.
 *
 * Each one collapses until asked for, because a settings page that opens with
 * four empty forms reads as work to be done rather than as a list of what is
 * already configured.
 */

function Disclosure({
  label,
  children,
}: {
  label: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" />
        {label}
      </Button>
    );
  }
  return (
    <div className="border-border bg-raised rounded-lg border p-4">
      {children(() => setOpen(false))}
    </div>
  );
}

const selectClass =
  "bg-surface border-border-input text-text h-10 w-full rounded-md border px-3 text-sm coarse:h-11";

export function NewDiscountForm({ currency }: { currency: string }) {
  const [state, submit, pending] = useActionState<SettingsState, FormData>(
    createDiscountAction,
    {},
  );
  const [kind, setKind] = useState("percent");

  return (
    <Disclosure label="New code">
      {() => (
        <form action={submit} className="flex flex-col gap-4">
          <Field
            label="Code"
            htmlFor="d-code"
            error={state.field === "code" ? state.error : undefined}
            hint="People type this by hand — keep it short."
          >
            <Input id="d-code" name="code" placeholder="WELCOME10" required className="uppercase" />
          </Field>

          <Field label="What it does" htmlFor="d-kind">
            <select
              id="d-kind"
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className={selectClass}
            >
              <option value="percent">Takes a percentage off</option>
              <option value="fixed">Takes a fixed amount off</option>
              <option value="free_shipping">Makes delivery free</option>
            </select>
          </Field>

          {kind !== "free_shipping" ? (
            <Field
              label={kind === "percent" ? "Percentage off" : `Amount off (${currency})`}
              htmlFor="d-amount"
              error={state.field === "amount" ? state.error : undefined}
            >
              <Input
                id="d-amount"
                name="amount"
                inputMode="decimal"
                placeholder={kind === "percent" ? "10" : "250"}
                required
              />
            </Field>
          ) : null}

          <Field
            label={`Minimum basket (${currency})`}
            htmlFor="d-min"
            hint="Optional. Leave blank for no minimum."
            error={state.field === "minSubtotal" ? state.error : undefined}
          >
            <Input id="d-min" name="minSubtotal" inputMode="decimal" placeholder="1000" />
          </Field>

          <Field
            label="How many times it can be used"
            htmlFor="d-max"
            hint="Optional. Leave blank for unlimited."
            error={state.field === "maxRedemptions" ? state.error : undefined}
          >
            <Input id="d-max" name="maxRedemptions" inputMode="numeric" placeholder="100" />
          </Field>

          {state.error && !state.field ? (
            <p role="alert" className="text-danger text-sm">{state.error}</p>
          ) : null}

          <Button type="submit" size="sm" disabled={pending}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Create code
          </Button>
        </form>
      )}
    </Disclosure>
  );
}

export function NewShippingForm({ zoneId, currency }: { zoneId: string; currency: string }) {
  const [state, submit, pending] = useActionState<SettingsState, FormData>(
    createShippingAction,
    {},
  );
  const [kind, setKind] = useState("flat");
  const [pickup, setPickup] = useState(false);

  return (
    <Disclosure label="New delivery option">
      {() => (
        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="zoneId" value={zoneId} />

          <Field
            label="Name"
            htmlFor="s-name"
            hint="What the customer sees at checkout."
            error={state.field === "name" ? state.error : undefined}
          >
            <Input id="s-name" name="name" placeholder="Express delivery" required />
          </Field>

          <Field label="Description" htmlFor="s-desc" hint="Optional. Times, areas, conditions.">
            <Input id="s-desc" name="description" placeholder="Next working day within Chennai" />
          </Field>

          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              name="isPickup"
              checked={pickup}
              onChange={(e) => setPickup(e.target.checked)}
              className="accent-accent mt-0.5 size-4"
            />
            <span>
              <span className="text-text-secondary block text-sm">They collect in person</span>
              <span className="text-faint block text-xs">
                No address is asked for and nothing is charged.
              </span>
            </span>
          </label>

          {!pickup ? (
            <>
              <Field label="Charging" htmlFor="s-kind">
                <select
                  id="s-kind"
                  name="kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  className={selectClass}
                >
                  <option value="flat">A flat rate</option>
                  <option value="free">Nothing — always free</option>
                  <option value="free_over">Flat rate, free over a certain total</option>
                </select>
              </Field>

              {kind !== "free" ? (
                <Field
                  label={`Price (${currency})`}
                  htmlFor="s-price"
                  error={state.field === "price" ? state.error : undefined}
                >
                  <Input id="s-price" name="price" inputMode="decimal" placeholder="80" />
                </Field>
              ) : null}

              {kind === "free_over" ? (
                <Field
                  label={`Free over (${currency})`}
                  htmlFor="s-threshold"
                  hint="Measured after any discount."
                  error={state.field === "threshold" ? state.error : undefined}
                >
                  <Input id="s-threshold" name="threshold" inputMode="decimal" placeholder="1500" />
                </Field>
              ) : null}
            </>
          ) : null}

          {state.error && !state.field ? (
            <p role="alert" className="text-danger text-sm">{state.error}</p>
          ) : null}

          <Button type="submit" size="sm" disabled={pending}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Add option
          </Button>
        </form>
      )}
    </Disclosure>
  );
}

export function NewTaxForm() {
  const [state, submit, pending] = useActionState<SettingsState, FormData>(createTaxAction, {});

  return (
    <Disclosure label="New tax rule">
      {() => (
        <form action={submit} className="flex flex-col gap-4">
          <Field
            label="Name"
            htmlFor="t-name"
            hint="Exactly as it should read on an invoice."
            error={state.field === "name" ? state.error : undefined}
          >
            <Input id="t-name" name="name" placeholder="GST 18%" required />
          </Field>

          <Field
            label="Rate (%)"
            htmlFor="t-rate"
            error={state.field === "rate" ? state.error : undefined}
          >
            <Input id="t-rate" name="rate" inputMode="decimal" placeholder="18" required />
          </Field>

          <Field
            label="How it's applied"
            htmlFor="t-inclusive"
            hint="Get this wrong and the customer pays a different amount."
          >
            <select id="t-inclusive" name="inclusive" defaultValue="true" className={selectClass}>
              <option value="true">Already inside my prices (inclusive)</option>
              <option value="false">Added at checkout (exclusive)</option>
            </select>
          </Field>

          <p className="text-faint text-xs leading-relaxed">
            BuilderHut applies the rate you enter. It does not know your local rules, and
            nothing here is tax advice — check the rate and treatment with your accountant
            before you publish.
          </p>

          <Button type="submit" size="sm" disabled={pending}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Save rule
          </Button>
        </form>
      )}
    </Disclosure>
  );
}

/*
 * How customers sign in to this shop — blueprint sections 10 and 23.
 *
 * The phone options are disabled AND named with the plan that would allow them,
 * so the ceiling is legible in the list rather than discovered on submit. The
 * service refuses them anyway: a greyed control is not a limit.
 *
 * The two contradictory pairs are disabled as they arise for the same reason —
 * being told why up front beats being refused afterwards.
 */
export function CustomerAccountsForm({
  initial,
  phoneAllowed,
  planName,
  neededPlanName,
}: {
  initial: { identifier: string; credential: string; verification: string };
  phoneAllowed: boolean;
  planName: string;
  neededPlanName: string | null;
}) {
  const [state, submit, pending] = useActionState<SettingsState, FormData>(
    saveCustomerAccountsAction,
    {},
  );
  const [identifier, setIdentifier] = useState(initial.identifier);
  const [credential, setCredential] = useState(initial.credential);

  const phoneSuffix = phoneAllowed ? "" : ` — ${neededPlanName ?? "a paid plan"}`;

  return (
    <form action={submit} className="flex max-w-lg flex-col gap-5">
      <h2 className="font-display text-lg">Customer accounts</h2>

      <Field
        label="How customers sign in"
        htmlFor="customer-identifier-mode"
        hint={
          phoneAllowed
            ? "Signing in by mobile sends a text message for each code."
            : `Mobile sign-in is part of ${neededPlanName ?? "a paid plan"}. You're on ${planName}.`
        }
        error={state.field === "identifier" ? state.error : undefined}
      >
        <select
          id="customer-identifier-mode"
          name="identifier"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          className={selectClass}
        >
          <option value="email_only">With an email address</option>
          <option value="phone_only" disabled={!phoneAllowed}>
            With a mobile number{phoneSuffix}
          </option>
          <option value="either" disabled={!phoneAllowed}>
            Either — their choice{phoneSuffix}
          </option>
          <option value="both" disabled={!phoneAllowed}>
            Both, and confirm both{phoneSuffix}
          </option>
        </select>
      </Field>

      <Field
        label="What they sign in with"
        htmlFor="customer-credential-mode"
        hint="A code is sent each time. A password is not, so it costs nothing to send."
        error={state.field === "credential" ? state.error : undefined}
      >
        <select
          id="customer-credential-mode"
          name="credential"
          value={credential}
          onChange={(event) => setCredential(event.target.value)}
          className={selectClass}
        >
          <option value="both">A password, or a code if they&rsquo;d rather</option>
          <option value="password" disabled={identifier === "phone_only"}>
            A password
            {identifier === "phone_only" ? " — needs an email address for resets" : ""}
          </option>
          <option value="code">A code we send them</option>
        </select>
      </Field>

      <Field
        label="When we confirm their details"
        htmlFor="customer-verification-mode"
        hint="Confirming before the first order keeps a mistyped address from losing it."
        error={state.field === "verification" ? state.error : undefined}
      >
        <select
          id="customer-verification-mode"
          name="verification"
          defaultValue={initial.verification}
          className={selectClass}
        >
          <option value="before_checkout">Before their first order</option>
          <option value="at_signup">As soon as they sign up</option>
          <option value="off" disabled={credential === "code"}>
            Don&rsquo;t confirm
            {credential === "code" ? " — a code already confirms it" : ""}
          </option>
        </select>
      </Field>

      <p className="text-muted text-xs leading-relaxed">
        Claiming an account that has already ordered here always needs a code, whatever this
        is set to — otherwise anyone typing that address would see those orders.
      </p>

      {state.error && !state.field ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {pending ? "Saving" : "Save"}
        </Button>
        {state.ok ? <span className="text-success text-sm">Saved.</span> : null}
      </div>
    </form>
  );
}

export function StoreSettingsForm({
  initial,
}: {
  initial: {
    checkoutMode: string;
    requirePhone: boolean;
    allowOrderNotes: boolean;
    showMarketingConsent: boolean;
    gstin: string;
  };
}) {
  const [state, submit, pending] = useActionState<SettingsState, FormData>(
    saveSettingsAction,
    {},
  );

  return (
    <form action={submit} className="flex max-w-lg flex-col gap-5">
      <Field label="Who can check out" htmlFor="checkout-mode">
        <select
          id="checkout-mode"
          name="checkoutMode"
          defaultValue={initial.checkoutMode}
          className={selectClass}
        >
          <option value="guest">Anyone — no account needed</option>
          <option value="optional_account">Anyone, with the option to make an account</option>
          <option value="account_required">Only people with an account</option>
        </select>
      </Field>

      <Toggle name="requirePhone" label="Ask for a phone number" defaultChecked={initial.requirePhone}
              hint="Most couriers in India want one." />
      <Toggle name="allowOrderNotes" label="Let people add a note" defaultChecked={initial.allowOrderNotes}
              hint="Gift messages, delivery times, allergies." />
      <Toggle name="showMarketingConsent" label="Ask about marketing email"
              defaultChecked={initial.showMarketingConsent}
              hint="Unticked by default — consent has to be given, not assumed." />

      <Field
        label="GSTIN"
        htmlFor="gstin"
        hint="Optional. Shown on invoices for Indian merchants."
        error={state.field === "gstin" ? state.error : undefined}
      >
        <Input id="gstin" name="gstin" defaultValue={initial.gstin} placeholder="33AAAAA0000A1Z5" className="uppercase" />
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {pending ? "Saving" : "Save settings"}
        </Button>
        {state.ok ? <span className="text-success text-sm">Saved.</span> : null}
      </div>
    </form>
  );
}

function Toggle({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-start gap-2.5">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="accent-accent mt-0.5 size-4"
      />
      <span>
        <span className="text-text-secondary block text-sm">{label}</span>
        {hint ? <span className="text-faint block text-xs">{hint}</span> : null}
      </span>
    </label>
  );
}

/*
 * How people reach this shop.
 *
 * These four feed the Contact section and the footer directly — both read
 * ctx.doc.settings.socials — so filling them in here is what makes a Contact
 * section show anything at all. Until now there was no way to set them: the
 * `setSocial` command existed and nothing called it, so a merchant could add
 * the section and find it empty with no explanation.
 *
 * Every field is optional and every one that is blank simply produces no
 * button. A shop that only wants WhatsApp gets one button, not three and two
 * dead ones.
 */
export function ContactDetailsForm({
  initial,
}: {
  initial: { whatsapp: string; instagram: string; email: string; phone: string };
}) {
  const [state, submit, pending] = useActionState<{ ok: boolean; error?: string }, FormData>(
    saveContactDetailsAction,
    { ok: false },
  );

  return (
    <form action={submit} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="WhatsApp number"
          htmlFor="whatsapp"
          hint="With the country code — 919876543210. The button opens a chat."
        >
          <Input
            id="whatsapp"
            name="whatsapp"
            inputMode="tel"
            defaultValue={initial.whatsapp}
            placeholder="919876543210"
          />
        </Field>

        <Field label="Instagram" htmlFor="instagram" hint="The full link to your profile.">
          <Input
            id="instagram"
            name="instagram"
            defaultValue={initial.instagram}
            placeholder="https://instagram.com/yourshop"
          />
        </Field>

        <Field label="Email" htmlFor="contact-email" hint="Where customers can write to you.">
          <Input
            id="contact-email"
            name="email"
            type="email"
            defaultValue={initial.email}
            placeholder="hello@yourshop.in"
          />
        </Field>

        <Field label="Phone" htmlFor="contact-phone" hint="Optional. Shown as a call button.">
          <Input
            id="contact-phone"
            name="phone"
            inputMode="tel"
            defaultValue={initial.phone}
            placeholder="+91 98765 43210"
          />
        </Field>
      </div>

      {state.error ? (
        <p role="alert" className="text-danger bg-danger-soft rounded-md px-3 py-2 text-sm">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-success text-sm">
          Saved. Your Contact section and footer are using these now.
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {pending ? "Saving" : "Save contact details"}
        </Button>
      </div>
    </form>
  );
}
