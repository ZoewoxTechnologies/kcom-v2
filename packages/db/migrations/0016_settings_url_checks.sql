ALTER TABLE "site_settings" DROP CONSTRAINT "site_settings_email_format";--> statement-breakpoint
ALTER TABLE "site_settings" DROP CONSTRAINT "site_settings_facebook_url";--> statement-breakpoint
ALTER TABLE "site_settings" DROP CONSTRAINT "site_settings_youtube_url";--> statement-breakpoint
ALTER TABLE "site_settings" DROP CONSTRAINT "site_settings_instagram_url";--> statement-breakpoint
ALTER TABLE "site_settings" DROP CONSTRAINT "site_settings_x_url";--> statement-breakpoint
ALTER TABLE "site_settings" DROP CONSTRAINT "site_settings_whatsapp_url";--> statement-breakpoint
ALTER TABLE "site_settings" DROP CONSTRAINT "site_settings_telegram_url";--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_email_format" CHECK ("site_settings"."contact_email" IS NULL OR "site_settings"."contact_email" ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_facebook_url" CHECK ("site_settings"."facebook_url" IS NULL OR "site_settings"."facebook_url" ~ '^https?://[^\s]+$');--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_youtube_url" CHECK ("site_settings"."youtube_url" IS NULL OR "site_settings"."youtube_url" ~ '^https?://[^\s]+$');--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_instagram_url" CHECK ("site_settings"."instagram_url" IS NULL OR "site_settings"."instagram_url" ~ '^https?://[^\s]+$');--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_x_url" CHECK ("site_settings"."x_url" IS NULL OR "site_settings"."x_url" ~ '^https?://[^\s]+$');--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_whatsapp_url" CHECK ("site_settings"."whatsapp_channel_url" IS NULL OR "site_settings"."whatsapp_channel_url" ~ '^https?://[^\s]+$');--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_telegram_url" CHECK ("site_settings"."telegram_url" IS NULL OR "site_settings"."telegram_url" ~ '^https?://[^\s]+$');