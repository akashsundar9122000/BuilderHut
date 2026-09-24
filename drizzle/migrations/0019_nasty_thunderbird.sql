CREATE TYPE "public"."customer_verification_channel" AS ENUM('email', 'sms');--> statement-breakpoint
CREATE TYPE "public"."customer_verification_purpose" AS ENUM('signup', 'login', 'claim', 'verify', 'password_reset');--> statement-breakpoint
CREATE TYPE "public"."customer_credential_mode" AS ENUM('password', 'code', 'both');--> statement-breakpoint
CREATE TYPE "public"."customer_identifier_mode" AS ENUM('email_only', 'phone_only', 'either', 'both');--> statement-breakpoint
CREATE TYPE "public"."customer_verification_mode" AS ENUM('at_signup', 'before_checkout', 'off');--> statement-breakpoint
CREATE TABLE "customer_rate_limits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bucket" text NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_verifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"identifier" text NOT NULL,
	"channel" "customer_verification_channel" NOT NULL,
	"purpose" "customer_verification_purpose" NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"customer_id" uuid,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "phone_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "customer_identifier_mode" "customer_identifier_mode" DEFAULT 'email_only' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "customer_credential_mode" "customer_credential_mode" DEFAULT 'both' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "customer_verification_mode" "customer_verification_mode" DEFAULT 'before_checkout' NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_rate_limits" ADD CONSTRAINT "customer_rate_limits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_verifications" ADD CONSTRAINT "customer_verifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_verifications" ADD CONSTRAINT "customer_verifications_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_rate_limits_tenant_bucket_key" ON "customer_rate_limits" USING btree ("tenant_id","bucket");--> statement-breakpoint
CREATE INDEX "customer_rate_limits_window_idx" ON "customer_rate_limits" USING btree ("window_started_at");--> statement-breakpoint
CREATE INDEX "customer_verifications_tenant_lookup_idx" ON "customer_verifications" USING btree ("tenant_id","identifier","purpose","created_at");--> statement-breakpoint
CREATE INDEX "customer_verifications_tenant_channel_idx" ON "customer_verifications" USING btree ("tenant_id","channel","created_at");--> statement-breakpoint
CREATE INDEX "customer_verifications_expires_idx" ON "customer_verifications" USING btree ("expires_at");
