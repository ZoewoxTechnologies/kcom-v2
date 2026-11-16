UPDATE "capsules" SET "publish_at" = ("date"::timestamp AT TIME ZONE 'Africa/Lagos') WHERE "publish_at" IS NULL;--> statement-breakpoint
DROP INDEX "capsules_status_date_idx";--> statement-breakpoint
ALTER TABLE "capsules" ALTER COLUMN "publish_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "capsules" ADD COLUMN "bible_meditation" text;--> statement-breakpoint
ALTER TABLE "capsules" ADD COLUMN "author_source" text;--> statement-breakpoint
CREATE INDEX "capsules_status_publish_at_idx" ON "capsules" USING btree ("status","publish_at");--> statement-breakpoint
ALTER TABLE "capsules" DROP COLUMN "date";--> statement-breakpoint
ALTER TABLE "capsules" ADD CONSTRAINT "capsules_slug_format" CHECK ("capsules"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');--> statement-breakpoint
ALTER TABLE "capsules" ADD CONSTRAINT "capsules_title_not_blank" CHECK (btrim("capsules"."title") <> '');