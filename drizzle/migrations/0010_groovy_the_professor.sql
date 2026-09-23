CREATE TYPE "public"."domain_status" AS ENUM('pending', 'misconfigured', 'verified', 'active', 'disabled');--> statement-breakpoint
CREATE TABLE "domains" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"hostname" text NOT NULL,
	"normalized_hostname" text NOT NULL,
	"status" "domain_status" DEFAULT 'pending' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"verification_token" varchar(64) NOT NULL,
	"last_check_detail" text,
	"dns_checked_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "domains_normalized_hostname_key" ON "domains" USING btree ("normalized_hostname");--> statement-breakpoint
CREATE INDEX "domains_tenant_created_idx" ON "domains" USING btree ("tenant_id","created_at");