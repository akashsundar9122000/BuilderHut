ALTER TABLE "orders" ADD COLUMN "reminded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "remind_unpaid_orders" boolean DEFAULT true NOT NULL;