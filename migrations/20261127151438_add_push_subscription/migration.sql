CREATE TABLE `push_subscription` (
	`id` text PRIMARY KEY,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`userId` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`kinds` text DEFAULT '[]' NOT NULL,
	CONSTRAINT `fk_push_subscription_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscription_endpoint_idx` ON `push_subscription` (`endpoint`);--> statement-breakpoint
CREATE INDEX `push_subscription_userId_idx` ON `push_subscription` (`userId`);