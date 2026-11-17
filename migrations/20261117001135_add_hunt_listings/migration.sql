CREATE TABLE `hunt_listings` (
	`id` text PRIMARY KEY,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`source` text NOT NULL,
	`sourceId` text NOT NULL,
	`name` text NOT NULL,
	`note` text,
	`url` text,
	`location` text,
	`isOnline` integer NOT NULL,
	`allDay` integer NOT NULL,
	`startsAt` integer NOT NULL,
	`endsAt` integer NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`syncedAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hunt_listings_source_sourceId_idx` ON `hunt_listings` (`source`,`sourceId`);--> statement-breakpoint
CREATE INDEX `hunt_listings_endsAt_idx` ON `hunt_listings` (`endsAt`);