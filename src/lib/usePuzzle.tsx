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
        for (const puzzle of round.puzzles) {
          if (puzzle.id === puzzleId) {
            return puzzle;
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
