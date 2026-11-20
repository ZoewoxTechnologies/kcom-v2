CREATE TYPE "public"."contact_message_status" AS ENUM('new', 'read');--> statement-breakpoint
CREATE TYPE "public"."contact_topic" AS ENUM('question', 'prayer', 'testimony', 'invitation', 'other');--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" "contact_topic" NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"message" text NOT NULL,
	"keep_private" boolean DEFAULT false NOT NULL,
	"status" "contact_message_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "contact_messages_status_created_at_idx" ON "contact_messages" USING btree ("status","created_at");