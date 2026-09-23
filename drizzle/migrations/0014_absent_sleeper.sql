CREATE TYPE "public"."tenant_plan" AS ENUM('free', 'standard', 'pro');--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "plan" "tenant_plan" DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "plan_started_at" timestamp with time zone;