import {useMutation, useSuspenseQuery} from "@tanstack/react-query";

import {orpc} from "@/lib/orpc";

import {Label} from "./ui/label";
import {Switch} from "./ui/switch";

export function ChangeExchangeHuntDraftSwitch({huntId}: {huntId: string}) {
  const hunt = useSuspenseQuery(orpc.exchange.hunts.get.queryOptions({input: {huntId}})).data;
  const mutation = useMutation(orpc.exchange.hunts.update.mutationOptions());
  return (
    <div className="flex items-center space-x-2">
      <Switch
        checked={!hunt.draft}
        onCheckedChange={checked => mutation.mutate({huntId, draft: !checked})}
      />
      <Label>{hunt.draft ? "Draft" : "Published"}</Label>
    </div>
  );
}
