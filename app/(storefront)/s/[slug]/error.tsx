"use client";

import { useEffect } from "react";

/*
 * A shop that failed to render.
 *
 * Deliberately unbranded on both sides: the merchant's theme lives in the
 * layout, and if the failure was in the layout there is no theme to use. What
 * a customer needs here is a working reload button and no suggestion that they
 * did something wrong.
 */
export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[storefront]", error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "70dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        padding: "2rem 1.5rem",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontFamily: "var(--sf-font-heading, serif)", fontSize: "1.5rem", margin: 0 }}>
        This page didn&rsquo;t load
      </h1>
      <p style={{ color: "var(--sf-muted, #666)", fontSize: "0.9rem", margin: 0, maxWidth: "26rem" }}>
        Something went wrong at our end. Nothing in your basket has been lost.
      </p>
      <button
        type="button"
        onClick={reset}
        style={{
          marginTop: "0.5rem",
          background: "var(--sf-primary, #1c1917)",
          color: "var(--sf-on-primary, #fff)",
          border: 0,
          borderRadius: "var(--sf-button-radius, 8px)",
          padding: "0.7rem 1.25rem",
          fontSize: "0.9rem",
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </main>
  );
}
