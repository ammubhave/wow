import {defineRelations} from "drizzle-orm";

import {authRelations} from "./auth-schema";
import * as schema from "./schema";

const appRelations = defineRelations(schema, r => ({
  round: {puzzles: r.many.puzzle()},
  puzzle: {
    round: r.one.round({from: r.puzzle.roundId, to: r.round.id, optional: false}),
    parentPuzzle: r.one.puzzle({
      from: r.puzzle.parentPuzzleId,
      to: r.puzzle.id,
      alias: "puzzle_parentPuzzle",
    }),
    childPuzzles: r.many.puzzle({
      from: r.puzzle.id,
      to: r.puzzle.parentPuzzleId,
      alias: "puzzle_parentPuzzle",
    }),
  },
  hunts: {hunt_puzzles: r.many.huntPuzzles()},
  huntPuzzles: {hunt: r.one.hunts({from: r.huntPuzzles.huntId, to: r.hunts.id, optional: false})},
}));

export const relations = {...appRelations, ...authRelations};
