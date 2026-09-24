import { formatMoney } from "@/lib/money";
import { AccountNav } from "./AccountNav";
import { LABELS, type OrderStatus } from "@/lib/commerce/order-state";
import type { AccountSummary, SignedInCustomer } from "@/lib/render/context";

/*
 * What somebody sees when they open their account.
 *
 * A server component: it renders data the route already loaded and has nothing
 * interactive of its own, so there is no reason to ship it to the browser.
 */

function Panel({
  title,
  href,
  action,
  children,
}: {
  title: string;
  href?: string;
  action?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "var(--sf-surface)",
        border: "max(1px, var(--sf-border-width)) solid var(--sf-border)",
        borderRadius: "var(--sf-radius)",
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <h3
          style={{
            fontFamily: "var(--sf-font-heading)",
            fontSize: "calc(1.05rem * var(--sf-scale))",
            margin: 0,
          }}
        >
          {title}
        </h3>
        {href ? (
          <a
            href={href}
            style={{
              fontFamily: "var(--sf-font-body)",
              fontSize: "0.85rem",
              color: "var(--sf-muted)",
              textDecoration: "underline",
            }}
          >
            {action ?? "See all"}
          </a>
        ) : null}
      </div>
      <div style={{ marginTop: 14, fontFamily: "var(--sf-font-body)", fontSize: "0.9rem", lineHeight: 1.6 }}>
        {children}
      </div>
    </section>
  );
}

function Quiet({ children }: { children: React.ReactNode }) {
  return <p style={{ color: "var(--sf-muted)", margin: 0 }}>{children}</p>;
}

export function AccountOverview({
  base,
  slug,
  customer,
  summary,
  recentOrders,
  showWishlist,
  showAddresses,
}: {
  base: string;
  slug: string;
  customer: SignedInCustomer;
  summary: AccountSummary;
  recentOrders: number;
  showWishlist: boolean;
  showAddresses: boolean;
}) {
  const orders = summary.orders.slice(0, recentOrders);

  return (
    <div style={{ marginTop: 24, display: "grid", gap: 16 }}>
      {/*
       * The nav lives here rather than in a layout, because THIS page is the one
       * the merchant lays out in the builder — a layout would wrap it in a second
       * header and footer. The bespoke subpages get the same nav from
       * AccountShell, so signing out is reachable from every account page.
       */}
      <AccountNav base={base} slug={slug} active="overview" />
      <Panel title="Recent orders" href={`${base}/account/orders`}>
        {orders.length === 0 ? (
          <Quiet>Nothing yet. Your orders will be here once you place one.</Quiet>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {orders.map((order) => (
              <li
                key={order.id}
                style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
              >
                <a
                  href={`${base}/account/orders/${order.id}`}
                  style={{ color: "var(--sf-text)", textDecoration: "underline" }}
                >
                  Order #{order.number}
                </a>
                <span style={{ color: "var(--sf-muted)" }}>
                  {order.itemCount} {order.itemCount === 1 ? "item" : "items"} ·{" "}
                  {formatMoney(order.totalMinor, order.currency)} ·{" "}
                  {LABELS[order.status as OrderStatus] ?? order.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {showAddresses ? (
        <Panel title="Delivery address" href={`${base}/account/addresses`} action="Manage">
          {summary.defaultAddressLines ? (
            <address style={{ fontStyle: "normal", color: "var(--sf-text)" }}>
              {summary.defaultAddressLines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </address>
          ) : (
            <Quiet>No address saved yet — you can add one to save typing at checkout.</Quiet>
          )}
        </Panel>
      ) : null}

      {showWishlist ? (
        <Panel title="Saved items" href={`${base}/account/wishlist`}>
          {summary.wishlist.length === 0 ? (
            <Quiet>Nothing saved. The heart on a product keeps it here for later.</Quiet>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
              {summary.wishlist.slice(0, 4).map((product) => (
                <li key={product.id}>
                  <a
                    href={`${base}/p/${product.slug}`}
                    style={{ color: "var(--sf-text)", textDecoration: "underline" }}
                  >
                    {product.name}
                  </a>
                  <span style={{ color: "var(--sf-muted)" }}>
                    {" "}
                    · {formatMoney(product.priceMinor, product.currency)}
                    {product.soldOut ? " · sold out" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}

      <Panel title="Your details" href={`${base}/account/profile`} action="Edit">
        <div style={{ color: "var(--sf-text)" }}>
          {customer.name ? <div>{customer.name}</div> : null}
          {customer.email ? (
            <div>
              {customer.email}
              {!customer.emailVerified ? (
                <span style={{ color: "var(--sf-muted)" }}> · not confirmed yet</span>
              ) : null}
            </div>
          ) : null}
          {customer.phone ? (
            <div>
              {customer.phone}
              {!customer.phoneVerified ? (
                <span style={{ color: "var(--sf-muted)" }}> · not confirmed yet</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
