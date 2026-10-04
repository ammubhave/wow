import {sql} from "drizzle-orm";
import {
  AnySQLiteColumn,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import {v7 as uuid7} from "uuid";

export * from "./auth-schema";
import type {JSONContent} from "@tiptap/react";

import * as auth from "./auth-schema";

const base = {
  id: text()
    .primaryKey()
    .$defaultFn(() => uuid7()),
  createdAt: integer({mode: "timestamp_ms"})
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer({mode: "timestamp_ms"})
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
};

export const round = sqliteTable(
  "round",
  {
    ...base,
    workspaceId: text()
      .notNull()
      .references(() => auth.organization.id, {onDelete: "cascade", onUpdate: "cascade"}),
    name: text().notNull(),
    status: text(),
  },
  t => [index("round_workspaceId_idx").on(t.workspaceId)]
);

export const puzzle = sqliteTable(
  "puzzle",
  {
    ...base,
    roundId: text()
      .notNull()
      .references(() => round.id, {onDelete: "cascade", onUpdate: "cascade"}),
    name: text().notNull(),
    link: text(),
    googleSpreadsheetId: text(),
    googleDrawingId: text(),
    answer: text(),
    status: text(),
    importance: text(),
    comment: text(),
    commentUpdatedAt: integer({mode: "timestamp"}),
    commentUpdatedBy: text(),
    isMetaPuzzle: integer({mode: "boolean"}).default(false).notNull(),
    parentPuzzleId: text().references((): AnySQLiteColumn => puzzle.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    tags: text({mode: "json"}).$type<string[]>().default([]).notNull(),
  },
  t => [
    index("puzzle_roundId_idx").on(t.roundId),
    index("puzzle_parentPuzzleId_idx").on(t.parentPuzzleId),
  ]
);

export const activityLogEntry = sqliteTable(
  "activity_log_entry",
  {
    ...base,
    workspaceId: text()
      .notNull()
      .references(() => auth.organization.id, {onDelete: "cascade", onUpdate: "cascade"}),
    userId: text()
      .notNull()
      .references(() => auth.user.id, {onDelete: "cascade", onUpdate: "cascade"}),
  },
  t => [
    // Serves the workspace activity feed: WHERE workspaceId ORDER BY createdAt DESC.
    index("activity_log_entry_workspaceId_createdAt_idx").on(t.workspaceId, t.createdAt),
    index("activity_log_entry_userId_idx").on(t.userId),
  ]
);

export const roundActivityLogEntry = sqliteTable(
  "round_activity_log_entry",
  {
    activityLogEntryId: text()
      .primaryKey()
      .references(() => activityLogEntry.id, {onDelete: "cascade", onUpdate: "cascade"}),
    subType: text({enum: ["create", "delete"]}).notNull(),
    roundId: text().references(() => round.id, {onDelete: "set null", onUpdate: "cascade"}),
    roundName: text().notNull(),
  },
  t => [index("round_activity_log_entry_roundId_idx").on(t.roundId)]
);

export const puzzleActivityLogEntry = sqliteTable(
  "puzzle_activity_log_entry",
  {
    activityLogEntryId: text()
      .primaryKey()
      .references(() => activityLogEntry.id, {onDelete: "cascade", onUpdate: "cascade"}),
    subType: text({
      enum: ["create", "delete", "updateStatus", "updateImportance", "updateAnswer"],
    }).notNull(),
    puzzleId: text().references(() => puzzle.id, {onDelete: "set null", onUpdate: "cascade"}),
    puzzleName: text().notNull(),
    field: text(),
  },
  t => [index("puzzle_activity_log_entry_puzzleId_idx").on(t.puzzleId)]
);

export const workspaceActivityLogEntry = sqliteTable("workspace_activity_log_entry", {
  activityLogEntryId: text()
    .primaryKey()
    .references(() => activityLogEntry.id, {onDelete: "cascade", onUpdate: "cascade"}),
  subType: text({enum: ["join"]}).notNull(),
});

/**
 * How long each person was actively on each puzzle (its page in the focused tab, not idle), by hour,
 * so stats can say both how long and when.
 */
export const puzzleTime = sqliteTable(
  "puzzle_time",
  {
    userId: text()
      .notNull()
      .references(() => auth.user.id, {onDelete: "cascade", onUpdate: "cascade"}),
    puzzleId: text()
      .notNull()
      .references(() => puzzle.id, {onDelete: "cascade", onUpdate: "cascade"}),
    // Denormalized (a puzzle never changes workspace) so a workspace's stats are one lookup.
    workspaceId: text()
      .notNull()
      .references(() => auth.organization.id, {onDelete: "cascade", onUpdate: "cascade"}),
    /** The hour (UTC, in hours since the epoch) the time was spent in. */
    hour: integer().notNull(),
    /** That hour as the time of day (0–23) where the solver was, for "night owl" style stats. */
    localHour: integer().notNull(),
    seconds: integer().default(0).notNull(),
    updatedAt: base.updatedAt,
  },
  t => [
    primaryKey({columns: [t.userId, t.puzzleId, t.hour]}),
    index("puzzle_time_workspaceId_userId_idx").on(t.workspaceId, t.userId),
    index("puzzle_time_puzzleId_idx").on(t.puzzleId),
  ]
);

/** Who says they helped solve a puzzle (self-reported: the team's honor code). */
export const puzzleContributor = sqliteTable(
  "puzzle_contributor",
  {
    puzzleId: text()
      .notNull()
      .references(() => puzzle.id, {onDelete: "cascade", onUpdate: "cascade"}),
    userId: text()
      .notNull()
      .references(() => auth.user.id, {onDelete: "cascade", onUpdate: "cascade"}),
    createdAt: base.createdAt,
  },
  t => [
    primaryKey({columns: [t.puzzleId, t.userId]}),
    index("puzzle_contributor_userId_idx").on(t.userId),
  ]
);

// Hunts

export const hunts = sqliteTable("hunts", {
  ...base,
  draft: integer({mode: "boolean"}).default(true).notNull(),
  name: text().notNull(),
});

export const huntPuzzles = sqliteTable(
  "hunt_puzzles",
  {
    ...base,
    huntId: text()
      .notNull()
      .references(() => hunts.id, {onDelete: "cascade", onUpdate: "cascade"}),
    draft: integer({mode: "boolean"}).default(true).notNull(),
    title: text().notNull(),
    contents: text({mode: "json"}).$type<JSONContent>(),
    answer: text().notNull(),
    partials: text({mode: "json"}).$type<{answer: string; message: string}[]>(),
    hints: text({mode: "json"}).$type<{title: string; message: string}[]>(),
    solution: text({mode: "json"}).$type<JSONContent>(),
  },
  t => [index("hunt_puzzles_huntId_idx").on(t.huntId)]
);
