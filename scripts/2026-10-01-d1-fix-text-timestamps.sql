-- Repair timestamps stored as TEXT.
--
-- Rows written before commit 932b142 ("change type of created and updated at") got the old
-- CURRENT_TIMESTAMP default, so their timestamp columns hold UTC text like '2026-01-13 14:59:41'
-- instead of epoch milliseconds. SQLite orders TEXT after every INTEGER, so these rows sort as the
-- newest activity, and drizzle's timestamp_ms mode reads them as Invalid Date (null over JSON).
--
-- This converts them in place to epoch ms (no rows are added or removed). Safe to re-run: every
-- statement only touches rows whose value is still TEXT. Independent of the reconcile script;
-- run it before or after.
--
-- 1. Preview (should list the affected columns; run again after step 2 to confirm 0 rows):
--      wrangler d1 execute wow-production --env production --remote --command "
--        SELECT 'activity_log_entry', count(*) FROM activity_log_entry WHERE typeof(createdAt)='text' OR typeof(updatedAt)='text'
--        UNION ALL SELECT 'puzzle', count(*) FROM puzzle WHERE typeof(createdAt)='text' OR typeof(updatedAt)='text' OR typeof(commentUpdatedAt)='text'
--        UNION ALL SELECT 'round', count(*) FROM round WHERE typeof(createdAt)='text' OR typeof(updatedAt)='text'
--        UNION ALL SELECT 'hunts', count(*) FROM hunts WHERE typeof(createdAt)='text' OR typeof(updatedAt)='text'
--        UNION ALL SELECT 'hunt_puzzles', count(*) FROM hunt_puzzles WHERE typeof(createdAt)='text' OR typeof(updatedAt)='text'"
-- 2. Apply (atomic: D1 runs the file in one transaction):
--      wrangler d1 execute wow-production --env production --remote --file scripts/2026-10-01-d1-fix-text-timestamps.sql
--
-- A value that isn't a parseable date would become NULL and violate NOT NULL, which aborts the
-- whole file with nothing changed, so a bad value can't be silently lost.

UPDATE activity_log_entry SET createdAt = cast(unixepoch(createdAt, 'subsec') * 1000 AS integer) WHERE typeof(createdAt) = 'text';
UPDATE activity_log_entry SET updatedAt = cast(unixepoch(updatedAt, 'subsec') * 1000 AS integer) WHERE typeof(updatedAt) = 'text';

UPDATE puzzle SET createdAt = cast(unixepoch(createdAt, 'subsec') * 1000 AS integer) WHERE typeof(createdAt) = 'text';
UPDATE puzzle SET updatedAt = cast(unixepoch(updatedAt, 'subsec') * 1000 AS integer) WHERE typeof(updatedAt) = 'text';
UPDATE puzzle SET commentUpdatedAt = cast(unixepoch(commentUpdatedAt, 'subsec') * 1000 AS integer) WHERE typeof(commentUpdatedAt) = 'text';

UPDATE round SET createdAt = cast(unixepoch(createdAt, 'subsec') * 1000 AS integer) WHERE typeof(createdAt) = 'text';
UPDATE round SET updatedAt = cast(unixepoch(updatedAt, 'subsec') * 1000 AS integer) WHERE typeof(updatedAt) = 'text';

UPDATE hunts SET createdAt = cast(unixepoch(createdAt, 'subsec') * 1000 AS integer) WHERE typeof(createdAt) = 'text';
UPDATE hunts SET updatedAt = cast(unixepoch(updatedAt, 'subsec') * 1000 AS integer) WHERE typeof(updatedAt) = 'text';

UPDATE hunt_puzzles SET createdAt = cast(unixepoch(createdAt, 'subsec') * 1000 AS integer) WHERE typeof(createdAt) = 'text';
UPDATE hunt_puzzles SET updatedAt = cast(unixepoch(updatedAt, 'subsec') * 1000 AS integer) WHERE typeof(updatedAt) = 'text';
