"use client";

import { useEffect } from "react";

/*
 * The root layout itself failed, so there is no layout, no fonts and no
 * stylesheet to rely on — this component replaces <html> entirely. Everything
 * is inline for that reason, and it is deliberately the plainest page in the
 * product. It should almost never be seen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          padding: "2rem",
          textAlign: "center",
          background: "#fbf8f3",
          color: "#1c1917",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", margin: 0, fontWeight: 600 }}>BuilderHut is having a moment</h1>
        <p style={{ margin: 0, maxWidth: "28rem", fontSize: "0.9rem", color: "#6b625a" }}>
          Something failed before the page could load. Reloading usually sorts it.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            background: "#a84c32",
            color: "#fff",
            border: 0,
            borderRadius: "8px",
            padding: "0.7rem 1.25rem",
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          Reload
        </button>
        {error.digest ? (
          <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#9a9089", fontFamily: "ui-monospace, monospace" }}>
            Reference {error.digest}
          </p>
        ) : null}
      </body>
    </html>
  );
}
