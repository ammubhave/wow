import { trpc } from "./trpc";

export function useRoundsUpdateMutation(
  {
    workspaceId,
  }: {
    workspaceId: string;
  },
  callbacks?: {
    onMutate?: () => Promise<void> | void;
    onSettled?: () => Promise<void> | void;
  },
) {
  const utils = trpc.useUtils();
  return trpc.rounds.update.useMutation({
    onMutate: async (variables) => {
      await callbacks?.onMutate?.();
      await utils.rounds.list.cancel({ workspaceId });
      const previousRounds = utils.rounds.list.getData({ workspaceId });
      const newRounds = structuredClone(previousRounds);
      if (newRounds) {
        for (const round of newRounds) {
          if (round.id === variables.id) {
            Object.assign(round, variables);
            break;
          }
        }
        utils.rounds.list.setData({ workspaceId }, newRounds);
      }
      return { previousRounds };
    },
    onError: (_error, _variables, context) => {
      if (context) {
        utils.rounds.list.setData({ workspaceId }, context.previousRounds);
      }
    },
    onSettled: async () => {
      await callbacks?.onSettled?.();
      utils.rounds.list.invalidate({ workspaceId });
    },
  });
}
