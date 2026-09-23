"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, Check, Loader2 } from "lucide-react";

import { Button, Field, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import { INDUSTRIES, SALES_CHANNELS, STORE_GOALS } from "@/lib/industries";
import { checkSlug, slugify } from "@/lib/slug";
import { templatesForIndustry } from "@/lib/templates";
import { checkSlugAction, createStoreAction, type CreateStoreState } from "@/app/(onboarding)/onboarding/actions";

/*
 * Blueprint section 4.4, as one screen that changes rather than six pages.
 *
 * Kept in a single client component on purpose: every answer narrows the next
 * question (industry decides which templates appear, business name proposes the
 * address), and round-tripping to the server between steps would make a form
 * that is mostly waiting. Everything is re-validated server-side in actions.ts.
 */

const REGIONS = [
  { country: "IN", currency: "INR", label: "India", timezone: "Asia/Kolkata" },
  { country: "GB", currency: "GBP", label: "United Kingdom", timezone: "Europe/London" },
  { country: "US", currency: "USD", label: "United States", timezone: "America/New_York" },
  { country: "AE", currency: "AED", label: "United Arab Emirates", timezone: "Asia/Dubai" },
  { country: "SG", currency: "SGD", label: "Singapore", timezone: "Asia/Singapore" },
  { country: "AU", currency: "AUD", label: "Australia", timezone: "Australia/Sydney" },
];

const STEPS = ["What do you make?", "Name it", "Where you sell now", "What you want", "Where you are", "Pick a starting point"];

export function Wizard({ suggestedName }: { suggestedName: string }) {
  const [step, setStep] = useState(0);
  const [industry, setIndustry] = useState("");
  const [name, setName] = useState("");
  /** Set only once the merchant edits the address themselves; null means "follow the name". */
  const [manualSlug, setManualSlug] = useState<string | null>(null);
  const [channel, setChannel] = useState("");
  const [goal, setGoal] = useState("");
  const [region, setRegion] = useState(REGIONS[0]!);
  const [chosenTemplate, setChosenTemplate] = useState("");

  const [state, submit, submitting] = useActionState<CreateStoreState, FormData>(
    createStoreAction,
    {},
  );

  const slug = manualSlug ?? slugify(name);

  const templates = useMemo(
    () => (industry ? templatesForIndustry(industry) : []),
    [industry],
  );
  // The first recommendation is pre-selected without needing an effect to put
  // it there: it is simply what "nothing chosen yet" means.
  const templateId = chosenTemplate || templates[0]?.id || "";

  const slugCheck = slug ? checkSlug(slug) : null;
  const canAdvance = [
    Boolean(industry),
    name.trim().length >= 2 && Boolean(slugCheck?.ok),
    Boolean(channel),
    Boolean(goal),
    true,
    Boolean(templateId),
  ][step];

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
      <Progress step={step} total={STEPS.length} />

      <div className="mt-10">
        {step === 0 && <IndustryStep value={industry} onChange={(v) => { setIndustry(v); setChosenTemplate(""); }} />}
        {step === 1 && (
          <NameStep
            name={name}
            setName={setName}
            slug={slug}
            setSlug={(v) => setManualSlug(slugify(v))}
            suggestedName={suggestedName}
            problem={slugCheck && !slugCheck.ok ? slugCheck.reason : null}
          />
        )}
        {step === 2 && <ChoiceStep title="How do you sell today?" hint="So we know what to set up first. You can change any of this later." options={SALES_CHANNELS.map((c) => ({ id: c.id, label: c.label }))} value={channel} onChange={setChannel} />}
        {step === 3 && <ChoiceStep title="What do you want to end up with?" hint="Not every shop needs a checkout." options={STORE_GOALS.map((g) => ({ id: g.id, label: g.label, blurb: g.blurb }))} value={goal} onChange={setGoal} />}
        {step === 4 && <RegionStep value={region} onChange={setRegion} />}
        {step === 5 && <TemplateStep templates={templates} value={templateId} onChange={setChosenTemplate} />}
      </div>

      {state.error ? (
        <p role="alert" className="text-danger bg-danger-soft mt-6 rounded-md px-3 py-2 text-sm">
          {state.error}
        </p>
      ) : null}

      <div className="mt-10 flex items-center gap-3">
        {step > 0 ? (
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={submitting}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
        ) : null}

        <div className="ml-auto">
          {step < STEPS.length - 1 ? (
            <Button size="lg" disabled={!canAdvance} onClick={() => setStep((s) => s + 1)}>
              Continue
            </Button>
          ) : (
            <form action={submit}>
              <input type="hidden" name="name" value={name.trim()} />
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="industry" value={industry} />
              <input type="hidden" name="templateId" value={templateId} />
              <input type="hidden" name="currency" value={region.currency} />
              <input type="hidden" name="country" value={region.country} />
              <input type="hidden" name="timezone" value={region.timezone} />
              <input type="hidden" name="salesChannel" value={channel} />
              <input type="hidden" name="goal" value={goal} />
              <Button type="submit" size="lg" disabled={!canAdvance || submitting}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {submitting ? "Building your store" : "Create my store"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-accent text-xs font-medium tracking-[0.18em] uppercase">
          Step {step + 1} of {total}
        </p>
        <p className="text-muted text-xs">{STEPS[step]}</p>
      </div>
      <div className="bg-sunken mt-3 h-1 overflow-hidden rounded-full">
        <div
          className="bg-accent h-full rounded-full transition-[width] duration-(--bh-duration-slow) ease-(--ease-out)"
          style={{ width: `${((step + 1) / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

function StepHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-7">
      <h1 className="font-display text-3xl leading-tight sm:text-4xl">{title}</h1>
      {hint ? <p className="text-muted mt-2 text-sm">{hint}</p> : null}
    </div>
  );
}

function SelectCard({
  selected,
  onClick,
  title,
  blurb,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  blurb?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group relative rounded-lg border p-4 text-left transition-all duration-(--bh-duration-fast) ease-(--ease-out)",
        "hover:-translate-y-0.5 hover:shadow-sm",
        selected
          ? "border-accent bg-accent-soft"
          : "border-border bg-surface hover:border-border-strong",
      )}
    >
      {selected ? (
        <span className="bg-accent text-on-accent absolute top-3 right-3 grid size-5 place-items-center rounded-full">
          <Check className="size-3" strokeWidth={3} />
        </span>
      ) : null}
      <p className="text-text pr-6 text-sm font-medium">{title}</p>
      {blurb ? <p className="text-muted mt-1 text-xs leading-relaxed">{blurb}</p> : null}
    </button>
  );
}

function IndustryStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <StepHeading title="What do you make?" hint="This decides which templates we show you. Pick the closest — nothing here is locked in." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {INDUSTRIES.map((industry) => (
          <SelectCard
            key={industry.id}
            selected={value === industry.id}
            onClick={() => onChange(industry.id)}
            title={industry.label}
            blurb={industry.blurb}
          />
        ))}
      </div>
    </div>
  );
}

function NameStep({
  name,
  setName,
  slug,
  setSlug,
  suggestedName,
  problem,
}: {
  name: string;
  setName: (v: string) => void;
  slug: string;
  setSlug: (v: string) => void;
  suggestedName: string;
  problem: string | null;
}) {
  /*
   * The answer is stored alongside the address it describes. Deriving
   * staleness from that comparison means a keystroke invalidates the previous
   * result without an effect having to reach in and clear it.
   */
  const [checked, setChecked] = useState<{ slug: string; available: boolean } | null>(null);
  const [checking, startCheck] = useTransition();
  const available = checked?.slug === slug ? checked.available : null;

  // Debounced: this fires on every keystroke and each one is a database query.
  useEffect(() => {
    if (!slug || problem) return;
    const timer = setTimeout(() => {
      startCheck(async () => {
        const result = await checkSlugAction(slug);
        setChecked({ slug, available: result.available });
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [slug, problem]);

  return (
    <div>
      <StepHeading title="What's it called?" hint="Your store's name, and the address people will type." />
      <div className="flex max-w-md flex-col gap-5">
        <Field label="Store name" htmlFor="store-name">
          <Input
            id="store-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={suggestedName || "Thread & Bloom"}
            autoFocus
          />
        </Field>

        <Field
          label="Store address"
          htmlFor="store-slug"
          error={problem ?? (available === false ? "That address is taken." : undefined)}
          hint={
            !problem && available === true
              ? "That one's free."
              : "Lowercase letters, numbers and hyphens."
          }
        >
          <div className="flex items-center gap-0">
            <span className="text-muted bg-sunken border-border-input h-10 rounded-l-md border border-r-0 px-3 text-sm leading-10 coarse:h-11 coarse:leading-[2.75rem]">
              /s/
            </span>
            <Input
              id="store-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="rounded-l-none"
              aria-invalid={Boolean(problem) || available === false}
            />
            <span className="ml-2 w-4">
              {checking ? <Loader2 className="text-muted size-4 animate-spin" /> : null}
              {!checking && available === true ? <Check className="text-success size-4" /> : null}
            </span>
          </div>
        </Field>
      </div>
    </div>
  );
}

function ChoiceStep({
  title,
  hint,
  options,
  value,
  onChange,
}: {
  title: string;
  hint: string;
  options: { id: string; label: string; blurb?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <StepHeading title={title} hint={hint} />
      <div className="grid max-w-xl gap-3 sm:grid-cols-2">
        {options.map((option) => (
          <SelectCard
            key={option.id}
            selected={value === option.id}
            onClick={() => onChange(option.id)}
            title={option.label}
            blurb={option.blurb}
          />
        ))}
      </div>
    </div>
  );
}

function RegionStep({
  value,
  onChange,
}: {
  value: (typeof REGIONS)[number];
  onChange: (v: (typeof REGIONS)[number]) => void;
}) {
  return (
    <div>
      <StepHeading
        title="Where do you sell?"
        hint="Sets your currency and how dates and addresses are formatted. Changeable in settings."
      />
      <div className="grid max-w-xl gap-3 sm:grid-cols-2">
        {REGIONS.map((region) => (
          <SelectCard
            key={region.country}
            selected={value.country === region.country}
            onClick={() => onChange(region)}
            title={region.label}
            blurb={`Prices in ${region.currency}`}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateStep({
  templates,
  value,
  onChange,
}: {
  templates: ReturnType<typeof templatesForIndustry>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <StepHeading
        title="Pick a starting point"
        hint="Every one of these is fully editable. You're choosing a direction, not a cage."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onChange(template.id)}
            aria-pressed={value === template.id}
            className={cn(
              "overflow-hidden rounded-lg border text-left transition-all duration-(--bh-duration-fast) ease-(--ease-out)",
              "hover:-translate-y-0.5 hover:shadow-md",
              value === template.id ? "border-accent ring-accent/25 ring-2" : "border-border",
            )}
          >
            {/* A miniature of the template's own palette and type, not a screenshot. */}
            <div
              className="flex h-28 flex-col justify-end gap-1.5 p-4"
              style={{ background: template.theme.colors.background }}
            >
              <span
                style={{
                  color: template.theme.colors.text,
                  fontFamily: `var(--font-${template.theme.typography.heading})`,
                  fontWeight: template.theme.typography.headingWeight,
                  letterSpacing: `${template.theme.typography.headingTracking}em`,
                  textTransform: template.theme.typography.headingTransform,
                  fontSize: "1.05rem",
                  lineHeight: 1.1,
                }}
              >
                {template.name}
              </span>
              <div className="flex gap-1">
                {template.swatches.map((c) => (
                  <span
                    key={c}
                    className="size-3.5"
                    style={{ background: c, borderRadius: template.theme.shape.radius > 8 ? 999 : 2 }}
                  />
                ))}
              </div>
            </div>
            <div className="bg-surface border-border border-t p-3">
              <p className="text-muted text-xs leading-relaxed">{template.blurb}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
