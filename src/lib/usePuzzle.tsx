import {useWorkspace} from "@/hooks/use-workspace";

export function usePuzzle({puzzleId}: {puzzleId: string}) {
  const workspace = useWorkspace();
  const puzzle = (() => {
    for (const round of workspace.rounds) {
      for (const puzzle of round.puzzles) {
        if (puzzle.id === puzzleId) {
          return puzzle;
        }
      }
    }
  })();
  return {isError: puzzle === undefined, data: puzzle};
}
