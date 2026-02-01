import {relations, sql} from "drizzle-orm";
import {AnySQLiteColumn, integer, sqliteTable, text} from "drizzle-orm/sqlite-core";
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

export const round = sqliteTable("round", {
  ...base,
  workspaceId: text()
    .notNull()
    .references(() => auth.organization.id, {onDelete: "cascade", onUpdate: "cascade"}),
  name: text().notNull(),
  status: text(),
});

export const roundRelations = relations(round, ({many}) => ({puzzles: many(puzzle)}));

export const puzzle = sqliteTable("puzzle", {
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
});

export const puzzleRelations = relations(puzzle, ({one, many}) => ({
  round: one(round, {fields: [puzzle.roundId], references: [round.id]}),
  parentPuzzle: one(puzzle, {
    fields: [puzzle.parentPuzzleId],
    references: [puzzle.id],
    relationName: "puzzle_parentPuzzle",
  }),
  childPuzzles: many(puzzle, {relationName: "puzzle_parentPuzzle"}),
}));

export const activityLogEntry = sqliteTable("activity_log_entry", {
  ...base,
  workspaceId: text()
    .notNull()
    .references(() => auth.organization.id, {onDelete: "cascade", onUpdate: "cascade"}),
  userId: text()
    .notNull()
    .references(() => auth.user.id, {onDelete: "cascade", onUpdate: "cascade"}),
});

export const roundActivityLogEntry = sqliteTable("round_activity_log_entry", {
  activityLogEntryId: text()
    .primaryKey()
    .references(() => activityLogEntry.id, {onDelete: "cascade", onUpdate: "cascade"}),
  subType: text({enum: ["create", "delete"]}).notNull(),
  roundId: text().references(() => round.id, {onDelete: "set null", onUpdate: "cascade"}),
  roundName: text().notNull(),
});

export const puzzleActivityLogEntry = sqliteTable("puzzle_activity_log_entry", {
  activityLogEntryId: text()
    .primaryKey()
    .references(() => activityLogEntry.id, {onDelete: "cascade", onUpdate: "cascade"}),
  subType: text({
    enum: ["create", "delete", "updateStatus", "updateImportance", "updateAnswer"],
  }).notNull(),
  puzzleId: text().references(() => puzzle.id, {onDelete: "set null", onUpdate: "cascade"}),
  puzzleName: text().notNull(),
  field: text(),
});

export const workspaceActivityLogEntry = sqliteTable("workspace_activity_log_entry", {
  activityLogEntryId: text()
    .primaryKey()
    .references(() => activityLogEntry.id, {onDelete: "cascade", onUpdate: "cascade"}),
  subType: text({enum: ["join"]}).notNull(),
});

// Hunts

export const hunts = sqliteTable("hunts", {...base, name: text().notNull()});

export const huntsRelations = relations(hunts, ({many}) => ({hunt_puzzles: many(huntPuzzles)}));

export const huntPuzzles = sqliteTable("hunt_puzzles", {
  ...base,
  huntId: text()
    .notNull()
    .references(() => hunts.id, {onDelete: "cascade", onUpdate: "cascade"}),
  title: text().notNull(),
  contents: text({mode: "json"}).$type<JSONContent>(),
  answer: text().notNull(),
  partials: text({mode: "json"}).$type<{answer: string; message: string}[]>(),
  hints: text({mode: "json"}).$type<{title: string; message: string}[]>(),
  solution: text({mode: "json"}).$type<JSONContent>(),
});

export const huntPuzzlesRelations = relations(huntPuzzles, ({one}) => ({
  hunt: one(hunts, {fields: [huntPuzzles.huntId], references: [hunts.id]}),
}));
