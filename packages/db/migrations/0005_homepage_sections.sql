CREATE TABLE "homepage_sections" (
	"key" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "homepage_sections_key_valid" CHECK ("homepage_sections"."key" IN ('todays_capsule','current_series','past_series','blog','events_books','email_signup')),
	CONSTRAINT "homepage_sections_capsule_pinned" CHECK ("homepage_sections"."key" <> 'todays_capsule' OR ("homepage_sections"."position" = 0 AND "homepage_sections"."visible"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "homepage_sections_position_idx" ON "homepage_sections" USING btree ("position");
--> statement-breakpoint
INSERT INTO "homepage_sections" ("key", "position", "visible") VALUES
  ('todays_capsule', 0, true),
  ('current_series', 1, true),
  ('past_series', 2, true),
  ('blog', 3, true),
  ('events_books', 4, true),
  ('email_signup', 5, true);
