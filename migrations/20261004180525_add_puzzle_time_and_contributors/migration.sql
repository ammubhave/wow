CREATE TABLE `puzzle_contributor` (
	`puzzleId` text NOT NULL,
	`userId` text NOT NULL,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `puzzle_contributor_pk` PRIMARY KEY(`puzzleId`, `userId`),
	CONSTRAINT `fk_puzzle_contributor_puzzleId_puzzle_id_fk` FOREIGN KEY (`puzzleId`) REFERENCES `puzzle`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_puzzle_contributor_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `puzzle_time` (
	`userId` text NOT NULL,
	`puzzleId` text NOT NULL,
	`workspaceId` text NOT NULL,
	`hour` integer NOT NULL,
	`localHour` integer NOT NULL,
	`seconds` integer DEFAULT 0 NOT NULL,
	`updatedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `puzzle_time_pk` PRIMARY KEY(`userId`, `puzzleId`, `hour`),
	CONSTRAINT `fk_puzzle_time_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_puzzle_time_puzzleId_puzzle_id_fk` FOREIGN KEY (`puzzleId`) REFERENCES `puzzle`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_puzzle_time_workspaceId_organization_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `puzzle_contributor_userId_idx` ON `puzzle_contributor` (`userId`);--> statement-breakpoint
CREATE INDEX `puzzle_time_workspaceId_userId_idx` ON `puzzle_time` (`workspaceId`,`userId`);--> statement-breakpoint
CREATE INDEX `puzzle_time_puzzleId_idx` ON `puzzle_time` (`puzzleId`);