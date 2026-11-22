ALTER TABLE `organization` ADD `sheets_tool` text DEFAULT 'builtin' NOT NULL;--> statement-breakpoint
ALTER TABLE `organization` ADD `voice_tool` text DEFAULT 'builtin' NOT NULL;--> statement-breakpoint
-- Workspaces already connected keep using what they connected.
UPDATE `organization` SET `sheets_tool` = 'google' WHERE `google_access_token` IS NOT NULL;--> statement-breakpoint
UPDATE `organization` SET `voice_tool` = 'discord' WHERE `discord_guild_id` IS NOT NULL;
