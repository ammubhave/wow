import { trpc } from "./trpc";

export function usePuzzle(
  {
    workspaceId,
    puzzleId,
  }: {
    workspaceId: string;
    puzzleId: string;
  },
  opts?: {
    enabled?: boolean;
  },
) {
  const rounds = trpc.rounds.list.useQuery(
    { workspaceId },
    {
      enabled: opts?.enabled,
    },
  );
  const puzzle =
    rounds.data &&
    (() => {
      for (const round of rounds.data) {
        for (const metaPuzzle of round.metaPuzzles) {
          if (metaPuzzle.id === puzzleId) {
            return metaPuzzle;
          }
          for (const puzzle of metaPuzzle.puzzles) {
            if (puzzle.id === puzzleId) {
              return puzzle;
            }
          }
        }
        for (const unassignedPuzzle of round.unassignedPuzzles) {
          if (unassignedPuzzle.id === puzzleId) {
            return unassignedPuzzle;
          }
        }
      }
    })();
  return {
    ...rounds,
    isError: rounds.isError || puzzle === undefined,
    data: puzzle,
  };
}
