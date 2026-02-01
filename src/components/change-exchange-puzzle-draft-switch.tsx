import {useMutation, useSuspenseQuery} from "@tanstack/react-query";

import {orpc} from "@/lib/orpc";

import {Label} from "./ui/label";
import {Switch} from "./ui/switch";

export function ChangeExchangePuzzleDraftSwitch({huntPuzzleId}: {huntPuzzleId: string}) {
  const puzzle = useSuspenseQuery(
    orpc.exchange.puzzles.get.queryOptions({input: {huntPuzzleId}})
  ).data;
  const mutation = useMutation(orpc.exchange.puzzles.update.mutationOptions());
  return (
    <div className="flex items-center space-x-2">
      <Switch
        checked={!puzzle.hunt_puzzles.draft}
        onCheckedChange={checked => mutation.mutate({huntPuzzleId, draft: !checked})}
      />
      <Label>{puzzle.hunt_puzzles.draft ? "Draft" : "Published"}</Label>
    </div>
  );
}
