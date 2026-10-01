import {Label, Switch} from "@heroui/react";
import {useMutation, useSuspenseQuery} from "@tanstack/react-query";
import {toast} from "sonner";

import {orpc} from "@/lib/orpc";

export function ChangeExchangePuzzleDraftSwitch({huntPuzzleId}: {huntPuzzleId: string}) {
  const puzzle = useSuspenseQuery(
    orpc.exchange.puzzles.get.queryOptions({input: {huntPuzzleId}})
  ).data;
  const mutation = useMutation(orpc.exchange.puzzles.update.mutationOptions());
  return (
    <div className="flex items-center space-x-2">
      <Switch
        isDisabled={mutation.isPending}
        isSelected={!puzzle.hunt_puzzles.draft}
        onChange={checked =>
          mutation.mutate(
            {huntPuzzleId, draft: !checked},
            {onError: () => toast.error("Oops! Something went wrong.")}
          )
        }
        aria-label={puzzle.hunt_puzzles.draft ? "Draft" : "Published"}>
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Content>
      </Switch>
      <Label>{puzzle.hunt_puzzles.draft ? "Draft" : "Published"}</Label>
    </div>
  );
}
