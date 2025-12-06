import {useMutation, useQueryClient} from "@tanstack/react-query";

import {orpc} from "./orpc";

export function useRoundsUpdateMutation(
  {workspaceId}: {workspaceId: string},
  callbacks?: {onMutate?: () => Promise<void> | void; onSettled?: () => Promise<void> | void}
) {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.rounds.update.mutationOptions({
      onMutate: async variables => {
        await callbacks?.onMutate?.();
        await queryClient.cancelQueries({
          queryKey: orpc.rounds.list.queryKey({input: {workspaceId}}),
        });
        const previousRounds = queryClient.getQueryData(
          orpc.rounds.list.queryKey({input: {workspaceId}})
        );
        const newRounds = structuredClone(previousRounds);
        if (newRounds) {
          for (const round of newRounds) {
            if (round.id === variables.id) {
              Object.assign(round, variables);
              break;
            }
          }
          queryClient.setQueryData(orpc.rounds.list.queryKey({input: {workspaceId}}), newRounds);
        }
        return {previousRounds};
      },
      onError: (_error, _variables, context) => {
        if (context) {
          queryClient.setQueryData(
            orpc.rounds.list.queryKey({input: {workspaceId}}),
            context.previousRounds
          );
        }
      },
      onSettled: async () => {
        await callbacks?.onSettled?.();
        queryClient.invalidateQueries({
          queryKey: orpc.rounds.list.queryKey({input: {workspaceId}}),
        });
      },
    })
  );
}
