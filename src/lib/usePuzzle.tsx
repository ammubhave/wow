import {useWorkspace} from "@/components/use-workspace";

export function usePuzzle(
  {workspaceId, puzzleId}: {workspaceId: string; puzzleId: string},
  opts?: {enabled?: boolean}
) {
  const workspace = useWorkspace({workspaceId, ...opts});
  const puzzle =
    workspace.get.data?.rounds &&
    (() => {
      for (const round of workspace.get.data.rounds) {
        for (const puzzle of round.puzzles) {
          if (puzzle.id === puzzleId) {
            return puzzle;
          }
        }
      }
    })();
  return {
    ...workspace.get.data?.rounds,
    isError: workspace.get.isError || puzzle === undefined,
    data: puzzle,
  };
}
