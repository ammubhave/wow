import {useMutation, useQueryClient, useSuspenseQuery} from "@tanstack/react-query";

import {orpc} from "@/lib/orpc";

export function useWorkspace({workspaceId}: {workspaceId: string}) {
  const queryClient = useQueryClient();
  const query = useSuspenseQuery(orpc.workspaces.get.queryOptions({input: workspaceId}));
  const updateMutation = useMutation(
    orpc.workspaces.update.mutationOptions({
      onSuccess: () => {
        void query.refetch();
        void queryClient.invalidateQueries();
      },
    })
  );
  const deleteMutation = useMutation(
    orpc.workspaces.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries();
      },
    })
  );
  const leaveMutation = useMutation(
    orpc.workspaces.leave.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries();
      },
    })
  );
  const roundCreateMutation = useMutation(
    orpc.rounds.create.mutationOptions({
      onSuccess: () => {
        void query.refetch();
        void queryClient.invalidateQueries();
      },
    })
  );
  const roundDeleteMutation = useMutation(
    orpc.rounds.delete.mutationOptions({
      onSuccess: () => {
        void query.refetch();
        void queryClient.invalidateQueries();
      },
    })
  );
  const roundUpdateMutation = useMutation(
    orpc.rounds.update.mutationOptions({
      onSuccess: () => {
        void query.refetch();
        void queryClient.invalidateQueries();
      },
    })
  );
  const puzzleCreateMutation = useMutation(
    orpc.puzzles.create.mutationOptions({
      onSuccess: () => {
        void query.refetch();
        void queryClient.invalidateQueries();
      },
    })
  );
  const puzzleDeleteMutation = useMutation(
    orpc.puzzles.delete.mutationOptions({
      onSuccess: () => {
        void query.refetch();
        void queryClient.invalidateQueries();
      },
    })
  );
  const puzzleUpdateMutation = useMutation(
    orpc.puzzles.update.mutationOptions({
      onSuccess: () => {
        void query.refetch();
        void queryClient.invalidateQueries();
      },
    })
  );
  const shareGoogleDriveFolderMutation = useMutation(
    orpc.workspaces.shareGoogleDriveFolder.mutationOptions()
  );
  const roundsQuery = useSuspenseQuery(orpc.rounds.list.queryOptions({input: {workspaceId}}));
  const linksQuery = useSuspenseQuery(
    orpc.workspaces.links.list.queryOptions({input: {workspaceId}})
  );
  const linksUpdateMutation = useMutation(
    orpc.workspaces.links.update.mutationOptions({
      onSuccess: () => {
        void query.refetch();
        void queryClient.invalidateQueries();
      },
    })
  );
  const roundAssignUnassignedPuzzlesMutation = useMutation(
    orpc.rounds.assignUnassignedPuzzles.mutationOptions({
      onSuccess: () => {
        void query.refetch();
        void queryClient.invalidateQueries();
      },
    })
  );
  return {
    get: query,
    shareGoogleDriveFolder: shareGoogleDriveFolderMutation,
    update: updateMutation,
    delete: deleteMutation,
    leave: leaveMutation,
    rounds: {
      list: roundsQuery,
      create: roundCreateMutation,
      delete: roundDeleteMutation,
      update: roundUpdateMutation,
      assignUnassignedPuzzles: roundAssignUnassignedPuzzlesMutation,
    },
    links: {list: linksQuery, update: linksUpdateMutation},
    puzzles: {
      create: puzzleCreateMutation,
      delete: puzzleDeleteMutation,
      update: puzzleUpdateMutation,
    },
  };
}
