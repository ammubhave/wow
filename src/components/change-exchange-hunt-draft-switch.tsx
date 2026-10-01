import {Label, Switch} from "@heroui/react";
import {useMutation, useSuspenseQuery} from "@tanstack/react-query";
import {toast} from "sonner";

import {orpc} from "@/lib/orpc";

export function ChangeExchangeHuntDraftSwitch({huntId}: {huntId: string}) {
  const hunt = useSuspenseQuery(orpc.exchange.hunts.get.queryOptions({input: {huntId}})).data;
  const mutation = useMutation(orpc.exchange.hunts.update.mutationOptions());
  return (
    <div className="flex items-center space-x-2">
      <Switch
        isDisabled={mutation.isPending}
        isSelected={!hunt.draft}
        onChange={checked =>
          mutation.mutate(
            {huntId, draft: !checked},
            {onError: () => toast.error("Oops! Something went wrong.")}
          )
        }
        aria-label={hunt.draft ? "Draft" : "Published"}>
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Content>
      </Switch>
      <Label>{hunt.draft ? "Draft" : "Published"}</Label>
    </div>
  );
}
