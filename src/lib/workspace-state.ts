import type {WorkspaceRoomWireState} from "@/server/do/workspace";

/**
 * The workspace room sends each puzzle once (flat `round.puzzles`). This rebuilds the derived views
 * the UI uses — `childPuzzles` on every puzzle, plus each round's `metaPuzzles` and
 * `unassignedPuzzles` — instead of sending every puzzle up to three times over the websocket.
 */
export function expandWorkspaceState(wire: WorkspaceRoomWireState) {
  type Puzzle = WorkspaceRoomWireState["rounds"][number]["puzzles"][number];
  const childrenOf = new Map<string, Puzzle[]>();
  for (const round of wire.rounds) {
    for (const puzzle of round.puzzles) {
      if (puzzle.parentPuzzleId === null) continue;
      const siblings = childrenOf.get(puzzle.parentPuzzleId);
      if (siblings) siblings.push(puzzle);
      else childrenOf.set(puzzle.parentPuzzleId, [puzzle]);
    }
  }
  return {
    ...wire,
    rounds: wire.rounds.map(round => {
      const puzzles = round.puzzles.map(puzzle => ({
        ...puzzle,
        childPuzzles: childrenOf.get(puzzle.id) ?? [],
      }));
      return {
        ...round,
        puzzles,
        unassignedPuzzles: puzzles.filter(p => !p.isMetaPuzzle && p.parentPuzzleId === null),
        metaPuzzles: puzzles.filter(p => p.isMetaPuzzle),
      };
    }),
  };
}

export type WorkspaceRoomState = ReturnType<typeof expandWorkspaceState>;
