CREATE TYPE "public"."incident_severity" AS ENUM('info', 'warning', 'error');--> statement-breakpoint
CREATE TABLE "platform_incidents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid,
	"severity" "incident_severity" DEFAULT 'error' NOT NULL,
	"kind" varchar(60) NOT NULL,
	"summary" text NOT NULL,
	"detail" jsonb,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "platform_incidents_created_idx" ON "platform_incidents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "platform_incidents_kind_created_idx" ON "platform_incidents" USING btree ("kind","created_at");--> statement-breakpoint
CREATE INDEX "platform_incidents_tenant_created_idx" ON "platform_incidents" USING btree ("tenant_id","created_at");