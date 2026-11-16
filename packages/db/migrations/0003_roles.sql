UPDATE "users" SET "role" = 'editor' WHERE "role" IS NULL OR "role" NOT IN ('admin', 'editor');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'editor';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_valid" CHECK ("users"."role" IN ('admin', 'editor'));