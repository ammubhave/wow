CREATE TABLE `deleted_puzzle` (
	`id` text PRIMARY KEY,
	`workspaceId` text NOT NULL,
	`googleFileId` text,
	`deletedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`cleanedAt` integer
);
--> statement-breakpoint
CREATE INDEX `deleted_puzzle_cleanedAt_idx` ON `deleted_puzzle` (`cleanedAt`);