"use client";

import { useTransition } from "react";

import { signOutAction } from "@/app/(storefront)/s/[slug]/account-actions";

/*
 * Moving around the account area, and getting out of it.
 *
 * A client component only because signing out is a mutation; the links are plain
 * anchors so the whole thing still works before any JavaScript arrives.
 */

const TABS = [
  { key: "overview", label: "Overview", path: "/account" },
  { key: "orders", label: "Orders", path: "/account/orders" },
  { key: "addresses", label: "Addresses", path: "/account/addresses" },
  { key: "wishlist", label: "Saved", path: "/account/wishlist" },
  { key: "profile", label: "Details", path: "/account/profile" },
] as const;

export type AccountTab = (typeof TABS)[number]["key"];

export function AccountNav({
  base,
  slug,
  active,
}: {
  base: string;
  slug: string;
  active: AccountTab;
}) {
  const [pending, start] = useTransition();

  return (
    <nav
      aria-label="Your account"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        alignItems: "center",
        paddingBottom: 18,
        borderBottom: "max(1px, var(--sf-border-width)) solid var(--sf-border)",
      }}
    >
      {TABS.map((tab) => {
        const current = tab.key === active;
        return (
          <a
            key={tab.key}
            href={`${base}${tab.path}`}
            aria-current={current ? "page" : undefined}
            style={{
              // 44px on a coarse pointer: this is a phone-first product and these
              // sit close together.
              minHeight: 40,
              display: "inline-flex",
              alignItems: "center",
              padding: "0 12px",
              borderRadius: "var(--sf-button-radius)",
              fontFamily: "var(--sf-font-body)",
              fontSize: "0.9rem",
              textDecoration: "none",
              color: current ? "var(--sf-on-primary)" : "var(--sf-text)",
              background: current ? "var(--sf-primary)" : "transparent",
            }}
          >
            {tab.label}
          </a>
        );
      })}

      <button
        type="button"
        aria-label="Sign out"
        disabled={pending}
        onClick={() => start(() => void signOutAction(slug))}
        style={{
          marginLeft: "auto",
          minHeight: 40,
          padding: "0 12px",
          background: "transparent",
          border: "max(1px, var(--sf-border-width)) solid var(--sf-border)",
          borderRadius: "var(--sf-button-radius)",
          fontFamily: "var(--sf-font-body)",
          fontSize: "0.9rem",
          color: "var(--sf-text)",
          cursor: pending ? "progress" : "pointer",
        }}
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </nav>
  );
}
