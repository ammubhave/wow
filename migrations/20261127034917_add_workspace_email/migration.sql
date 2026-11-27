CREATE TABLE `workspace_email` (
	`id` text PRIMARY KEY,
	`workspaceId` text NOT NULL,
	`receivedAt` integer NOT NULL,
	`fromAddress` text NOT NULL,
	`fromName` text,
	`subject` text,
	`text` text,
	`html` text,
	`attachments` text DEFAULT '[]' NOT NULL,
	`rawKey` text NOT NULL,
	CONSTRAINT `fk_workspace_email_workspaceId_organization_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `workspace_email_workspaceId_receivedAt_idx` ON `workspace_email` (`workspaceId`,`receivedAt`);