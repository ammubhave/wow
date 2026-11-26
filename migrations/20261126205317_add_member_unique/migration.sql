-- One membership per person per workspace: two quick joins (a double click, two tabs) could
-- otherwise both add one. Not in auth-schema.ts, which Better Auth generates.
CREATE UNIQUE INDEX IF NOT EXISTS `member_organization_id_user_id_unique` ON `member` (`organization_id`, `user_id`);
