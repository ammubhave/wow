CREATE TABLE `usage_imports` (
	`hour` text PRIMARY KEY,
	`importedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
