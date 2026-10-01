import {useWorkspace} from "@/hooks/use-workspace";

export function usePuzzle({puzzleId}: {puzzleId: string}) {
  const workspace = useWorkspace();
  const puzzle = workspace.rounds
    .flatMap(round => round.puzzles)
    .find(candidate => candidate.id === puzzleId);
  return {isError: puzzle === undefined, data: puzzle};
}
