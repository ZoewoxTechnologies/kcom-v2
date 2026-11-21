ALTER TABLE "events" ADD COLUMN "all_day" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "online_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "programme" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "related_post_id" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_related_post_id_blog_posts_id_fk" FOREIGN KEY ("related_post_id") REFERENCES "public"."blog_posts"("id") ON DELETE set null ON UPDATE no action;