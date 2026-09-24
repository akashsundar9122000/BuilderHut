import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, nullableTimestamp, primaryId, timestamps } from "./_shared";
import { tenants } from "./tenancy";
import { customers } from "./customers";
import { products } from "./catalog";

/*
 * Carts, orders, payments.
 *
 * Three rules run through all of it, and each is in the blueprint for a reason:
 *
 *   Money is bigint minor units with an explicit currency. Never a float.
 *   Order items snapshot what was bought — name, price, tax — so an order
 *     stays readable after the product it refers to is renamed or deleted.
 *   Order state is a server-validated machine. A browser cannot say "paid".
 */

export const orderStatus = pgEnum("order_status", [
  "pending_payment",
  "paid",
  "processing",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
  "partially_refunded",
]);

export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "cancelled",
  "refunded",
  "partially_refunded",
]);

export const fulfilmentKind = pgEnum("fulfilment_kind", ["delivery", "pickup", "digital"]);

/*
 * A cart belongs either to a signed-in customer or to an anonymous visitor
 * identified by a cookie token. Both are kept: a visitor who fills a cart and
 * then signs in should not lose it.
 */
export const carts = pgTable(
  "carts",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    /** Opaque cookie value for an anonymous visitor. */
    token: text("token").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    /*
     * A code the customer has entered. Kept on the cart rather than in a cookie
     * so it survives a different device, and so the discount is recomputed from
     * the live rule every time — a code that expires between adding it and
     * paying must stop applying, not be honoured because a cookie said so.
     */
    discountCode: varchar("discount_code", { length: 40 }),
    /** Set when the cart becomes an order; an ordered cart is never reopened. */
    convertedOrderId: uuid("converted_order_id"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("carts_token_key").on(t.token),
    index("carts_tenant_customer_idx").on(t.tenantId, t.customerId),
    index("carts_tenant_updated_idx").on(t.tenantId, t.updatedAt),
  ],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("cart_items_cart_product_key").on(t.cartId, t.productId),
    index("cart_items_tenant_cart_idx").on(t.tenantId, t.cartId),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** Short, per-tenant, human-quotable. "#1043", not a uuid. */
    number: integer("number").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    /*
     * Kept even for a guest, because it is how they are contacted — but
     * nullable, because a store that signs its customers in by mobile number may
     * never ask for an email address at all. A CHECK constraint in the
     * accompanying migration guarantees an order always has one way to reach the
     * buyer, whether that is the email or the phone.
     */
    email: text("email"),
    phone: varchar("phone", { length: 32 }),
    status: orderStatus("status").notNull().default("pending_payment"),
    currency: varchar("currency", { length: 3 }).notNull(),

    /* Every figure in minor units. subtotal - discount + shipping + tax = total. */
    subtotalMinor: bigint("subtotal_minor", { mode: "bigint" }).notNull(),
    discountMinor: bigint("discount_minor", { mode: "bigint" }).notNull().default(sql`0`),
    shippingMinor: bigint("shipping_minor", { mode: "bigint" }).notNull().default(sql`0`),
    taxMinor: bigint("tax_minor", { mode: "bigint" }).notNull().default(sql`0`),
    totalMinor: bigint("total_minor", { mode: "bigint" }).notNull(),
    refundedMinor: bigint("refunded_minor", { mode: "bigint" }).notNull().default(sql`0`),

    fulfilment: fulfilmentKind("fulfilment").notNull().default("delivery"),
    shippingMethodName: text("shipping_method_name"),
    discountCode: varchar("discount_code", { length: 40 }),
    customerNote: text("customer_note"),
    internalNote: text("internal_note"),

    placedAt: nullableTimestamp("placed_at"),
    paidAt: nullableTimestamp("paid_at"),
    shippedAt: nullableTimestamp("shipped_at"),
    deliveredAt: nullableTimestamp("delivered_at"),
    cancelledAt: nullableTimestamp("cancelled_at"),
    /*
     * When we nudged them about an order they never paid for.
     *
     * Set rather than counted, because exactly one reminder is ever sent: the
     * difference between a helpful nudge and being a nuisance is the second
     * email, and a null column makes sending two impossible rather than
     * unlikely.
     */
    remindedAt: nullableTimestamp("reminded_at"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("orders_tenant_number_key").on(t.tenantId, t.number),
    index("orders_tenant_status_created_idx").on(t.tenantId, t.status, t.createdAt),
    index("orders_tenant_created_idx").on(t.tenantId, t.createdAt),
    index("orders_tenant_customer_idx").on(t.tenantId, t.customerId),
  ],
);

/*
 * What was bought, as it was at the time.
 *
 * The product reference is kept for convenience but is NOT what the row means.
 * Blueprint section 35.1: never make an old order depend on today's product to
 * explain what the customer bought. Rename a product, change its price, delete
 * it — the order still reads correctly.
 */
export const orderItems = pgTable(
  "order_items",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),

    productName: text("product_name").notNull(),
    sku: varchar("sku", { length: 80 }),
    unitPriceMinor: bigint("unit_price_minor", { mode: "bigint" }).notNull(),
    quantity: integer("quantity").notNull(),
    lineDiscountMinor: bigint("line_discount_minor", { mode: "bigint" }).notNull().default(sql`0`),
    lineTaxMinor: bigint("line_tax_minor", { mode: "bigint" }).notNull().default(sql`0`),
    lineTotalMinor: bigint("line_total_minor", { mode: "bigint" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    /** Answers to custom product options — "names for the invitation", a date. */
    options: jsonb("options"),
    ...timestamps(),
  },
  (t) => [index("order_items_tenant_order_idx").on(t.tenantId, t.orderId)],
);

export const orderAddresses = pgTable(
  "order_addresses",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 16 }).notNull(),
    name: text("name").notNull(),
    phone: varchar("phone", { length: 32 }),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city").notNull(),
    region: text("region"),
    postalCode: varchar("postal_code", { length: 16 }),
    country: varchar("country", { length: 2 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("order_addresses_order_kind_key").on(t.orderId, t.kind),
    // Leading tenant_id, so a scoped read of a store's addresses does not scan.
    index("order_addresses_tenant_order_idx").on(t.tenantId, t.orderId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** "dummy" now; "razorpay", "stripe" later. The order never learns which. */
    provider: varchar("provider", { length: 32 }).notNull(),
    providerRef: text("provider_ref").notNull(),
    status: paymentStatus("status").notNull().default("pending"),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    /** Provider response, redacted. Never card data — none is ever collected. */
    metadata: jsonb("metadata"),
    failureReason: text("failure_reason"),
    ...timestamps(),
  },
  (t) => [
    index("payments_tenant_order_idx").on(t.tenantId, t.orderId),
    uniqueIndex("payments_provider_ref_key").on(t.provider, t.providerRef),
  ],
);

export const refunds = pgTable(
  "refunds",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "set null" }),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    reason: text("reason"),
    providerRef: text("provider_ref"),
    createdBy: uuid("created_by"),
    createdAt: createdAt(),
  },
  (t) => [index("refunds_tenant_order_idx").on(t.tenantId, t.orderId)],
);

/*
 * Idempotency keys.
 *
 * Blueprint section 35.1: a double-click or a network retry must not create two
 * orders. The client sends a key; the first request stores its result, and a
 * repeat gets that result back instead of doing the work twice.
 */
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    scope: varchar("scope", { length: 40 }).notNull(),
    result: jsonb("result"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("idempotency_keys_scope_key").on(t.tenantId, t.scope, t.key)],
);

export const discountKind = pgEnum("discount_kind", ["percent", "fixed", "free_shipping"]);

export const discounts = pgTable(
  "discounts",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 40 }).notNull(),
    kind: discountKind("kind").notNull(),
    /** Basis points for percent (1000 = 10%), minor units for fixed. */
    value: bigint("value", { mode: "bigint" }).notNull().default(sql`0`),
    minSubtotalMinor: bigint("min_subtotal_minor", { mode: "bigint" }),
    /** Null means unlimited. */
    maxRedemptions: integer("max_redemptions"),
    redemptions: integer("redemptions").notNull().default(0),
    firstOrderOnly: boolean("first_order_only").notNull().default(false),
    startsAt: nullableTimestamp("starts_at"),
    endsAt: nullableTimestamp("ends_at"),
    active: boolean("active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("discounts_tenant_code_key").on(t.tenantId, t.code),
    index("discounts_tenant_active_idx").on(t.tenantId, t.active),
  ],
);

export const discountRedemptions = pgTable(
  "discount_redemptions",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    discountId: uuid("discount_id")
      .notNull()
      .references(() => discounts.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("discount_redemptions_tenant_discount_idx").on(t.tenantId, t.discountId),
    uniqueIndex("discount_redemptions_order_discount_key").on(t.orderId, t.discountId),
  ],
);
