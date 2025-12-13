import {useMutation, useQueryClient} from "@tanstack/react-query";

import type {RouterInputs} from "@/server/router";

import {orpc} from "./orpc";

function sanitizePuzzle(puzzle: RouterInputs["puzzles"]["update"]) {
  puzzle.answer =
    puzzle.answer === undefined || puzzle.answer === null
      ? puzzle.answer
      : puzzle.answer.length === 0
        ? null
        : puzzle.answer.trim().toUpperCase();
  puzzle.status = puzzle.status === "none" ? null : puzzle.status;
  if (
    puzzle.status !== "solved" &&
    puzzle.status !== "backsolved" &&
    puzzle.status !== "obsolete" &&
    puzzle.answer !== null &&
    puzzle.answer !== undefined
  ) {
    puzzle.status = "solved";
  }
  return puzzle;
}

export function usePuzzlesUpdateMutation(
  {workspaceId}: {workspaceId: string},
  callbacks?: {onMutate?: () => Promise<void> | void; onSettled?: () => Promise<void> | void}
) {
  const queryClient = useQueryClient();
  const mutation = useMutation(
    orpc.puzzles.update.mutationOptions({
      onMutate: async variables => {
        await callbacks?.onMutate?.();
        Object.keys(variables).forEach(
          key => (variables as any)[key] === undefined && delete (variables as any)[key]
        );
        await queryClient.cancelQueries({
          queryKey: orpc.rounds.list.queryKey({input: {workspaceId}}),
        });
        const previousRounds = queryClient.getQueryData(
          orpc.rounds.list.queryKey({input: {workspaceId}})
        );
        const newRounds = structuredClone(previousRounds);
        if (newRounds) {
          (() => {
            for (const round of newRounds) {
              for (const metaPuzzle of round.metaPuzzles) {
                if (metaPuzzle.id === variables.id) {
                  Object.assign(metaPuzzle, variables);
                  return;
                }
                for (const puzzle of metaPuzzle.childPuzzles) {
                  if (puzzle.id === variables.id) {
                    Object.assign(puzzle, variables);
                    return;
                  }
                }
              }
              for (const unassignedPuzzle of round.unassignedPuzzles) {
                if (unassignedPuzzle.id === variables.id) {
                  Object.assign(unassignedPuzzle, variables);
                  return;
                }
              }
              for (const metaPuzzle of round.metaPuzzles) {
                if (metaPuzzle.id === variables.id) {
                  Object.assign(metaPuzzle, variables);
                  return;
                }
              }
            }
          })();
          queryClient.setQueryData(orpc.rounds.list.queryKey({input: {workspaceId}}), newRounds);
        }
        return {previousRounds, newRounds};
      },
      onError: (_error, _variables, context) => {
        if (context) {
          queryClient.setQueryData(
            orpc.rounds.list.queryKey({input: {workspaceId}}),
            context.previousRounds
          );
        }
      },
      onSettled: async (_data, _error) => {
        await callbacks?.onSettled?.();
        await queryClient.invalidateQueries({
          queryKey: orpc.rounds.list.queryKey({input: {workspaceId}}),
        });
      },
    })
  );
  return {
    ...mutation,
    mutateAsync: (variables: RouterInputs["puzzles"]["update"]) => {
      return mutation.mutateAsync(sanitizePuzzle(variables));
    },
    mutate: (variables: RouterInputs["puzzles"]["update"]) => {
      return mutation.mutate(sanitizePuzzle(variables));
    },
  };
}
