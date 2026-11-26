CREATE TABLE `workspace_cost` (
	`workspaceId` text NOT NULL,
	`hour` text NOT NULL,
	`service` text NOT NULL,
	`usd` real NOT NULL,
	CONSTRAINT `workspace_cost_pk` PRIMARY KEY(`workspaceId`, `hour`, `service`)
);
--> statement-breakpoint
ALTER TABLE `usage_imports` ADD `costedAt` integer;