"use client";

import type { AccountPolicyView } from "@/lib/render/context";

/*
 * The shared furniture of the customer auth forms.
 *
 * Storefront styling, so every value comes from --sf-*: these render inside a
 * merchant's own shop, and BuilderHut's tokens would repaint somebody's brand.
 * components/ui is deliberately not used here for the same reason.
 */

export function FieldShell({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      <label
        htmlFor={htmlFor}
        style={{ fontFamily: "var(--sf-font-body)", fontSize: "0.85rem", color: "var(--sf-muted)" }}
      >
        {label}
      </label>
      {children}
      {error ? (
        <p
          role="alert"
          style={{ fontFamily: "var(--sf-font-body)", fontSize: "0.8rem", color: "var(--sf-danger)", margin: 0 }}
        >
          {error}
        </p>
      ) : hint ? (
        <p style={{ fontFamily: "var(--sf-font-body)", fontSize: "0.8rem", color: "var(--sf-muted)", margin: 0 }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 46,
  padding: "0 14px",
  fontFamily: "var(--sf-font-body)",
  // 16px is the floor that stops iOS Safari zooming the whole page on focus.
  fontSize: "max(16px, 0.95rem)",
  color: "var(--sf-text)",
  background: "var(--sf-surface)",
  border: "max(1px, var(--sf-border-width)) solid var(--sf-border)",
  borderRadius: "var(--sf-button-radius)",
};

export function SubmitButton({
  children,
  pending,
  variant = "primary",
}: {
  children: React.ReactNode;
  pending?: boolean;
  variant?: "primary" | "quiet";
}) {
  const primary = variant === "primary";
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        minHeight: 46,
        padding: "0 22px",
        background: primary ? "var(--sf-primary)" : "transparent",
        color: primary ? "var(--sf-on-primary)" : "var(--sf-text)",
        border: primary ? "none" : "max(1px, var(--sf-border-width)) solid var(--sf-border)",
        borderRadius: "var(--sf-button-radius)",
        fontFamily: "var(--sf-font-body)",
        fontSize: "0.95rem",
        cursor: pending ? "progress" : "pointer",
        opacity: pending ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      style={{
        fontFamily: "var(--sf-font-body)",
        fontSize: "0.85rem",
        color: "var(--sf-danger)",
        background: "var(--sf-raised)",
        border: "max(1px, var(--sf-border-width)) solid var(--sf-border)",
        borderRadius: "var(--sf-radius)",
        padding: "10px 12px",
        margin: 0,
      }}
    >
      {message}
    </p>
  );
}

export function QuietLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      style={{
        fontFamily: "var(--sf-font-body)",
        fontSize: "0.85rem",
        color: "var(--sf-muted)",
        textDecoration: "underline",
      }}
    >
      {children}
    </a>
  );
}

/** What a store that takes mobile numbers should say under the field. */
export function phoneHint(policy: AccountPolicyView): string | undefined {
  if (policy.identifier === "email_only") return undefined;
  return `A number without a country code is read as ${policy.defaultCountry}.`;
}
