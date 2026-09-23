/*
 * The storefront's own loading state, in the merchant's colours.
 *
 * Shaped like a page rather than a spinner, and using the theme variables the
 * layout has already emitted — so the moment before a shop appears looks like
 * that shop rather than like a blank tab.
 */
export default function StorefrontLoading() {
  return (
    <div aria-busy="true" style={{ minHeight: "60dvh", padding: "3rem 1.5rem" }}>
      <span className="sr-only" role="status">
        Loading
      </span>
      <div
        aria-hidden
        style={{
          margin: "0 auto",
          maxWidth: "60rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        {[62, 38, 90].map((width, index) => (
          <div
            key={index}
            className="animate-pulse"
            style={{
              height: index === 0 ? "2.5rem" : "1rem",
              width: `${width}%`,
              borderRadius: "var(--sf-radius, 8px)",
              background: "var(--sf-raised, rgba(0,0,0,0.06))",
            }}
          />
        ))}
        <div
          className="animate-pulse"
          style={{
            marginTop: "1.5rem",
            height: "18rem",
            borderRadius: "var(--sf-radius, 8px)",
            background: "var(--sf-raised, rgba(0,0,0,0.06))",
          }}
        />
      </div>
    </div>
  );
}
