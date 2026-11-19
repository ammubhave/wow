CREATE TABLE `puzzle_guess` (
	`id` text PRIMARY KEY,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`workspaceId` text NOT NULL,
	`puzzleId` text NOT NULL,
	`answer` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`response` text,
	`retryAt` integer,
	`createdBy` text NOT NULL,
	`updatedBy` text,
	CONSTRAINT `fk_puzzle_guess_workspaceId_organization_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_puzzle_guess_puzzleId_puzzle_id_fk` FOREIGN KEY (`puzzleId`) REFERENCES `puzzle`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_puzzle_guess_createdBy_user_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `user`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `puzzle` ADD `answerCount` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `puzzle_guess_workspaceId_idx` ON `puzzle_guess` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `puzzle_guess_puzzleId_idx` ON `puzzle_guess` (`puzzleId`);