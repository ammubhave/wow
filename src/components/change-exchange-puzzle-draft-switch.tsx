import {Switch} from "@heroui/react";
import {useMutation, useSuspenseQuery} from "@tanstack/react-query";
import {toast} from "sonner";

import {orpc} from "@/lib/orpc";

export function ChangeExchangePuzzleDraftSwitch({huntPuzzleId}: {huntPuzzleId: string}) {
  const puzzle = useSuspenseQuery(
    orpc.exchange.puzzles.get.queryOptions({input: {huntPuzzleId}})
  ).data;
  const mutation = useMutation(orpc.exchange.puzzles.update.mutationOptions());
  return (
    <Switch
      isDisabled={mutation.isPending}
      isSelected={!puzzle.hunt_puzzles.draft}
      onChange={checked =>
        mutation.mutate(
          {huntPuzzleId, draft: !checked},
          {onError: () => toast.error("Oops! Something went wrong.")}
        )
      }>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        {puzzle.hunt_puzzles.draft ? "Draft" : "Published"}
      </Switch.Content>
    </Switch>
  );
}
