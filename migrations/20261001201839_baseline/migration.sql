CREATE TABLE `activity_log_entry` (
	`id` text PRIMARY KEY,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`workspaceId` text NOT NULL,
	`userId` text NOT NULL,
	CONSTRAINT `fk_activity_log_entry_workspaceId_organization_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_activity_log_entry_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `hunt_puzzles` (
	`id` text PRIMARY KEY,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`huntId` text NOT NULL,
	`draft` integer DEFAULT true NOT NULL,
	`title` text NOT NULL,
	`contents` text,
	`answer` text NOT NULL,
	`partials` text,
	`hints` text,
	`solution` text,
	CONSTRAINT `fk_hunt_puzzles_huntId_hunts_id_fk` FOREIGN KEY (`huntId`) REFERENCES `hunts`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `hunts` (
	`id` text PRIMARY KEY,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`draft` integer DEFAULT true NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `puzzle` (
	`id` text PRIMARY KEY,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`roundId` text NOT NULL,
	`name` text NOT NULL,
	`link` text,
	`googleSpreadsheetId` text,
	`googleDrawingId` text,
	`answer` text,
	`status` text,
	`importance` text,
	`comment` text,
	`commentUpdatedAt` integer,
	`commentUpdatedBy` text,
	`isMetaPuzzle` integer DEFAULT false NOT NULL,
	`parentPuzzleId` text,
	`tags` text DEFAULT '[]' NOT NULL,
	CONSTRAINT `fk_puzzle_roundId_round_id_fk` FOREIGN KEY (`roundId`) REFERENCES `round`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_puzzle_parentPuzzleId_puzzle_id_fk` FOREIGN KEY (`parentPuzzleId`) REFERENCES `puzzle`(`id`) ON UPDATE CASCADE ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `puzzle_activity_log_entry` (
	`activityLogEntryId` text PRIMARY KEY,
	`subType` text NOT NULL,
	`puzzleId` text,
	`puzzleName` text NOT NULL,
	`field` text,
	CONSTRAINT `fk_puzzle_activity_log_entry_activityLogEntryId_activity_log_entry_id_fk` FOREIGN KEY (`activityLogEntryId`) REFERENCES `activity_log_entry`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_puzzle_activity_log_entry_puzzleId_puzzle_id_fk` FOREIGN KEY (`puzzleId`) REFERENCES `puzzle`(`id`) ON UPDATE CASCADE ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `round` (
	`id` text PRIMARY KEY,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`workspaceId` text NOT NULL,
	`name` text NOT NULL,
	`status` text,
	CONSTRAINT `fk_round_workspaceId_organization_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `round_activity_log_entry` (
	`activityLogEntryId` text PRIMARY KEY,
	`subType` text NOT NULL,
	`roundId` text,
	`roundName` text NOT NULL,
	CONSTRAINT `fk_round_activity_log_entry_activityLogEntryId_activity_log_entry_id_fk` FOREIGN KEY (`activityLogEntryId`) REFERENCES `activity_log_entry`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_round_activity_log_entry_roundId_round_id_fk` FOREIGN KEY (`roundId`) REFERENCES `round`(`id`) ON UPDATE CASCADE ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `workspace_activity_log_entry` (
	`activityLogEntryId` text PRIMARY KEY,
	`subType` text NOT NULL,
	CONSTRAINT `fk_workspace_activity_log_entry_activityLogEntryId_activity_log_entry_id_fk` FOREIGN KEY (`activityLogEntryId`) REFERENCES `activity_log_entry`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `invitation` (
	`id` text PRIMARY KEY,
	`organization_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`inviter_id` text NOT NULL,
	CONSTRAINT `fk_invitation_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_invitation_inviter_id_user_id_fk` FOREIGN KEY (`inviter_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `member` (
	`id` text PRIMARY KEY,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL,
	`favorite_puzzle_ids` text,
	CONSTRAINT `fk_member_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_member_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `organization` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo` text,
	`created_at` integer NOT NULL,
	`metadata` text,
	`team_name` text,
	`event_name` text,
	`password` text,
	`comment` text,
	`comment_updated_at` integer,
	`comment_updated_by` text,
	`google_access_token` text,
	`google_refresh_token` text,
	`google_token_expires_at` integer,
	`google_folder_id` text,
	`google_template_file_id` text,
	`discord_guild_id` text,
	`tags` text,
	`links` text
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL UNIQUE,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`active_organization_id` text,
	CONSTRAINT `fk_session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`notifications_disabled` integer DEFAULT false
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `activity_log_entry_workspaceId_createdAt_idx` ON `activity_log_entry` (`workspaceId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `activity_log_entry_userId_idx` ON `activity_log_entry` (`userId`);--> statement-breakpoint
CREATE INDEX `hunt_puzzles_huntId_idx` ON `hunt_puzzles` (`huntId`);--> statement-breakpoint
CREATE INDEX `puzzle_roundId_idx` ON `puzzle` (`roundId`);--> statement-breakpoint
CREATE INDEX `puzzle_parentPuzzleId_idx` ON `puzzle` (`parentPuzzleId`);--> statement-breakpoint
CREATE INDEX `puzzle_activity_log_entry_puzzleId_idx` ON `puzzle_activity_log_entry` (`puzzleId`);--> statement-breakpoint
CREATE INDEX `round_workspaceId_idx` ON `round` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `round_activity_log_entry_roundId_idx` ON `round_activity_log_entry` (`roundId`);--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `invitation_organizationId_idx` ON `invitation` (`organization_id`);--> statement-breakpoint
CREATE INDEX `invitation_email_idx` ON `invitation` (`email`);--> statement-breakpoint
CREATE INDEX `member_organizationId_idx` ON `member` (`organization_id`);--> statement-breakpoint
CREATE INDEX `member_userId_idx` ON `member` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `organization_slug_uidx` ON `organization` (`slug`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);