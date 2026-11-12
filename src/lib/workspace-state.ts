import type {WorkspaceRoomWireState} from "@/server/do/workspace";

import {compareBoardOrder} from "./board-order";

/**
 * The workspace room sends each puzzle once (flat `round.puzzles`). This rebuilds the derived views
 * the UI uses — `childPuzzles` on every puzzle, plus each round's `metaPuzzles` and
 * `unassignedPuzzles` — instead of sending every puzzle up to three times over the websocket.
 */
export function expandWorkspaceState(wire: WorkspaceRoomWireState) {
  type Puzzle = WorkspaceRoomWireState["rounds"][number]["puzzles"][number];
  type ExpandedPuzzle = Puzzle & {childPuzzles: ExpandedPuzzle[]};
  // Each puzzle once, linked to its children (a meta can feed another meta, in any round).
  const byId = new Map<string, ExpandedPuzzle>();
  for (const round of wire.rounds) {
    // oxlint-disable-next-line oxc/no-map-spread -- must not mutate: the server state is shared.
    for (const puzzle of round.puzzles) byId.set(puzzle.id, {...puzzle, childPuzzles: []});
  }
  // In board order (see board-order.ts), so each list below is too.
  for (const puzzle of [...byId.values()].toSorted(compareBoardOrder)) {
    if (puzzle.parentPuzzleId !== null) byId.get(puzzle.parentPuzzleId)?.childPuzzles.push(puzzle);
  }
  return {
    ...wire,
    // oxlint-disable-next-line oxc/no-map-spread -- a new shape (the derived lists below).
    rounds: wire.rounds.toSorted(compareBoardOrder).map(round => {
      const puzzles = round.puzzles.map(puzzle => byId.get(puzzle.id)!).toSorted(compareBoardOrder);
      return {
        ...round,
        puzzles,
        unassignedPuzzles: puzzles.filter(p => !p.isMetaPuzzle && p.parentPuzzleId === null),
        metaPuzzles: puzzles.filter(p => p.isMetaPuzzle),
        /** Metas not feeding another meta: the round's top-level rows on the board. */
        topLevelMetaPuzzles: puzzles.filter(
          p => p.isMetaPuzzle && (p.parentPuzzleId === null || !byId.has(p.parentPuzzleId))
        ),
      };
    }),
  };
}

export type WorkspaceRoomState = ReturnType<typeof expandWorkspaceState>;
