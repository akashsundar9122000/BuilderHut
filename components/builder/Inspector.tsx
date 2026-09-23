"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button, Field, Input, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useBuilder, useSelectedSection } from "@/lib/builder/store";
import { INSPECTOR, type Control } from "@/lib/render/inspector";
import { themeLabel } from "@/lib/render/labels";
import { REGISTRY } from "@/lib/render/registry";

/*
 * The right-hand panel.
 *
 * Driven by the descriptors in lib/render/inspector.ts, so adding a section
 * type means describing its controls once rather than writing a bespoke form.
 * Blueprint section 6.4: only the controls relevant to what is selected.
 *
 * Nothing here validates: every change goes through a command, the command
 * produces a document, and the document is validated before it is saved. A
 * second validation layer in the UI would only be a second thing to disagree.
 */

export function Inspector() {
  const { page, run, doc } = useBuilder();
  const section = useSelectedSection();

  if (!section) return <ThemePanel />;

  const entry = REGISTRY[section.type];
  const groups = INSPECTOR[section.type];

  return (
    <div className="flex h-full flex-col">
      <header className="border-border border-b px-4 py-3">
        <p className="text-text text-sm font-medium">{entry.label}</p>
        <p className="text-muted mt-0.5 text-xs">{entry.hint}</p>
      </header>

      <div className="flex-1 overflow-y-auto">
        {groups.map((group) => (
          <section key={group.label} className="border-border border-b px-4 py-4">
            <p className="text-faint mb-3 text-[0.65rem] font-medium tracking-[0.14em] uppercase">
              {group.label}
            </p>
            <div className="flex flex-col gap-3.5">
              {group.controls.map((control) => (
                <ControlField
                  key={control.prop}
                  control={control}
                  value={section.props[control.prop]}
                  onChange={(value) =>
                    run({
                      type: "setSectionProp",
                      pageId: page.id,
                      sectionId: section.id,
                      prop: control.prop,
                      value,
                    })
                  }
                />
              ))}
            </div>
          </section>
        ))}

        <section className="px-4 py-4">
          <p className="text-faint text-xs">
            Section id <span className="font-mono">{section.id}</span>
            {doc.pages.length > 1 ? ` · on ${page.title}` : ""}
          </p>
        </section>
      </div>
    </div>
  );
}

function ControlField({
  control,
  value,
  onChange,
}: {
  control: Control;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = `ctrl-${control.prop}`;

  switch (control.kind) {
    case "text":
      return (
        <Field label={control.label} htmlFor={id}>
          <Input
            id={id}
            value={String(value ?? "")}
            placeholder={control.placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        </Field>
      );

    case "textarea":
      return (
        <Field label={control.label} htmlFor={id} hint={control.hint}>
          <Textarea
            id={id}
            rows={control.rows ?? 4}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
          />
        </Field>
      );

    case "link":
      return (
        <Field label={control.label} htmlFor={id} hint={control.hint ?? "A page like /shop, or a full web address."}>
          <Input id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
        </Field>
      );

    case "select":
      return (
        <Field label={control.label} htmlFor={id}>
          <select
            id={id}
            value={String(value ?? control.options[0]?.[0] ?? "")}
            onChange={(e) => {
              // Numeric props round-trip through a string in the DOM; convert
              // back or the schema rejects "3" where it wanted 3.
              const raw = e.target.value;
              onChange(/^\d+$/.test(raw) ? Number(raw) : raw);
            }}
            className="bg-surface border-border-input text-text h-10 w-full rounded-md border px-3 text-sm coarse:h-11"
          >
            {control.options.map(([optValue, optLabel]) => (
              <option key={optValue} value={optValue}>
                {optLabel}
              </option>
            ))}
          </select>
        </Field>
      );

    case "toggle":
      return (
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={value !== false}
            onChange={(e) => onChange(e.target.checked)}
            className="accent-accent mt-0.5 size-4"
          />
          <span>
            <span className="text-text-secondary block text-sm">{control.label}</span>
            {control.hint ? <span className="text-faint block text-xs">{control.hint}</span> : null}
          </span>
        </label>
      );

    case "number":
      return (
        <Field label={control.label} htmlFor={id}>
          <div className="flex items-center gap-3">
            <input
              id={id}
              type="range"
              min={control.min}
              max={control.max}
              step={control.step ?? 1}
              value={Number(value ?? control.min)}
              onChange={(e) => onChange(Number(e.target.value))}
              className="accent-accent flex-1"
            />
            <span className="text-muted w-10 text-right font-mono text-xs tabular-nums">
              {Number(value ?? control.min)}
            </span>
          </div>
        </Field>
      );

    case "image":
      return (
        <Field
          label={control.label}
          htmlFor={id}
          hint="Paste an image address. Uploads arrive with the media library."
        >
          <Input
            id={id}
            value={String(value ?? "")}
            placeholder="https://…"
            onChange={(e) => onChange(e.target.value || null)}
          />
        </Field>
      );

    case "items":
      return <ItemsControl control={control} value={value} onChange={onChange} />;
  }
}

function ItemsControl({
  control,
  value,
  onChange,
}: {
  control: Extract<Control, { kind: "items" }>;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const items = Array.isArray(value) ? (value as Record<string, string>[]) : [];

  const update = (index: number, prop: string, next: string) =>
    onChange(items.map((item, i) => (i === index ? { ...item, [prop]: next } : item)));

  const add = () =>
    onChange([
      ...items,
      Object.fromEntries(control.fields.map((f) => [f.prop, ""])),
    ]);

  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <div key={index} className="border-border bg-raised rounded-md border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-faint text-xs">
              {control.itemLabel} {index + 1}
            </span>
            <button
              onClick={() => remove(index)}
              aria-label={`Remove ${control.itemLabel} ${index + 1}`}
              className="text-muted hover:text-danger transition-colors"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
          <div className="flex flex-col gap-2.5">
            {control.fields.map((field) =>
              field.multiline ? (
                <Textarea
                  key={field.prop}
                  rows={3}
                  placeholder={field.label}
                  aria-label={field.label}
                  value={item[field.prop] ?? ""}
                  onChange={(e) => update(index, field.prop, e.target.value)}
                />
              ) : (
                <Input
                  key={field.prop}
                  placeholder={field.label}
                  aria-label={field.label}
                  value={item[field.prop] ?? ""}
                  onChange={(e) => update(index, field.prop, e.target.value)}
                />
              ),
            )}
          </div>
        </div>
      ))}

      {items.length < control.max ? (
        <Button variant="secondary" size="sm" onClick={add}>
          <Plus className="size-3.5" />
          Add {control.itemLabel.toLowerCase()}
        </Button>
      ) : (
        <p className="text-faint text-xs">That&rsquo;s the maximum of {control.max}.</p>
      )}
    </div>
  );
}

/*
 * With nothing selected the panel becomes the theme editor — blueprint section
 * 6.5. Putting it here rather than behind a modal means a merchant can change a
 * colour and watch the whole canvas change, which is the entire appeal.
 */
const SWATCH_KEYS = [
  "background", "surface", "raised", "text", "muted", "border", "primary", "onPrimary", "accent",
] as const;

const FONTS = [
  ["fraunces", "Fraunces"],
  ["playfair", "Playfair Display"],
  ["lora", "Lora"],
  ["instrument", "Instrument Serif"],
  ["inter", "Inter"],
  ["dmsans", "DM Sans"],
  ["worksans", "Work Sans"],
  ["spacegrotesk", "Space Grotesk"],
  ["archivo", "Archivo"],
] as const;

function ThemePanel() {
  const { doc, run } = useBuilder();
  const { colors, typography, shape } = doc.theme;

  return (
    <div className="flex h-full flex-col">
      <header className="border-border border-b px-4 py-3">
        <p className="text-text text-sm font-medium">Store style</p>
        <p className="text-muted mt-0.5 text-xs">
          Affects every page. Click a section on the canvas to edit it instead.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto">
        <section className="border-border border-b px-4 py-4">
          <p className="text-faint mb-3 text-[0.65rem] font-medium tracking-[0.14em] uppercase">
            Colours
          </p>
          <div className="flex flex-col gap-2">
            {SWATCH_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-3">
                <input
                  type="color"
                  value={colors[key]}
                  onChange={(e) =>
                    run({ type: "setTheme", group: "colors", key, value: e.target.value })
                  }
                  aria-label={themeLabel("colors", key)}
                  className="border-border size-7 cursor-pointer rounded border bg-transparent p-0.5"
                />
                <span className="text-text-secondary flex-1 text-sm">
                  {themeLabel("colors", key)}
                </span>
                <span className="text-faint font-mono text-xs">{colors[key]}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="border-border border-b px-4 py-4">
          <p className="text-faint mb-3 text-[0.65rem] font-medium tracking-[0.14em] uppercase">
            Type
          </p>
          <div className="flex flex-col gap-3.5">
            <Field label="Headings" htmlFor="font-heading">
              <FontSelect
                id="font-heading"
                value={typography.heading}
                onChange={(value) =>
                  run({ type: "setTheme", group: "typography", key: "heading", value })
                }
              />
            </Field>
            <Field label="Body text" htmlFor="font-body">
              <FontSelect
                id="font-body"
                value={typography.body}
                onChange={(value) =>
                  run({ type: "setTheme", group: "typography", key: "body", value })
                }
              />
            </Field>
            <Slider
              label="Overall size"
              value={typography.scale}
              min={0.8}
              max={1.4}
              step={0.05}
              onChange={(value) =>
                run({ type: "setTheme", group: "typography", key: "scale", value })
              }
            />
            <Field label="Heading case" htmlFor="heading-case">
              <select
                id="heading-case"
                value={typography.headingTransform}
                onChange={(e) =>
                  run({
                    type: "setTheme",
                    group: "typography",
                    key: "headingTransform",
                    value: e.target.value,
                  })
                }
                className="bg-surface border-border-input text-text h-10 w-full rounded-md border px-3 text-sm"
              >
                <option value="none">As typed</option>
                <option value="uppercase">UPPERCASE</option>
              </select>
            </Field>
          </div>
        </section>

        <section className="px-4 py-4">
          <p className="text-faint mb-3 text-[0.65rem] font-medium tracking-[0.14em] uppercase">
            Shape &amp; spacing
          </p>
          <div className="flex flex-col gap-3.5">
            <Slider
              label={themeLabel("shape", "radius")}
              value={shape.radius}
              min={0}
              max={32}
              onChange={(value) => run({ type: "setTheme", group: "shape", key: "radius", value })}
            />
            <Slider
              label={themeLabel("shape", "buttonRadius")}
              value={shape.buttonRadius}
              min={0}
              max={999}
              step={1}
              onChange={(value) =>
                run({ type: "setTheme", group: "shape", key: "buttonRadius", value })
              }
            />
            <Slider
              label={themeLabel("shape", "sectionSpacing")}
              value={shape.sectionSpacing}
              min={32}
              max={200}
              step={4}
              onChange={(value) =>
                run({ type: "setTheme", group: "shape", key: "sectionSpacing", value })
              }
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function FontSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-surface border-border-input text-text h-10 w-full rounded-md border px-3 text-sm"
    >
      {FONTS.map(([id, label]) => (
        <option key={id} value={id}>
          {label}
        </option>
      ))}
    </select>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-text-secondary text-sm">{label}</span>
        <span className="text-faint font-mono text-xs tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className={cn("accent-accent w-full")}
      />
    </div>
  );
}
