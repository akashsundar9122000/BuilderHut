CREATE TABLE "analytics_daily_rollups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"day" date NOT NULL,
	"visitors" integer DEFAULT 0 NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"page_views" integer DEFAULT 0 NOT NULL,
	"product_views" integer DEFAULT 0 NOT NULL,
	"add_to_carts" integer DEFAULT 0 NOT NULL,
	"checkout_starts" integer DEFAULT 0 NOT NULL,
	"orders" integer DEFAULT 0 NOT NULL,
	"revenue_minor" bigint DEFAULT 0 NOT NULL,
	"currency" varchar(3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(40) NOT NULL,
	"visitor_id" varchar(40),
	"session_id" varchar(40),
	"path" text,
	"product_id" uuid,
	"referrer_host" text,
	"utm_source" varchar(60),
	"utm_medium" varchar(60),
	"utm_campaign" varchar(60),
	"device" varchar(10),
	"value_minor" bigint,
	"currency" varchar(3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_daily_rollups" ADD CONSTRAINT "analytics_daily_rollups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_rollups_tenant_day_key" ON "analytics_daily_rollups" USING btree ("tenant_id","day");--> statement-breakpoint
CREATE INDEX "analytics_rollups_tenant_day_idx" ON "analytics_daily_rollups" USING btree ("tenant_id","day");--> statement-breakpoint
CREATE INDEX "analytics_events_tenant_created_idx" ON "analytics_events" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_tenant_name_created_idx" ON "analytics_events" USING btree ("tenant_id","name","created_at");