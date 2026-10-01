import {Switch} from "@heroui/react";
import {useMutation, useSuspenseQuery} from "@tanstack/react-query";
import {toast} from "sonner";

import {orpc} from "@/lib/orpc";

export function ChangeExchangeHuntDraftSwitch({huntId}: {huntId: string}) {
  const hunt = useSuspenseQuery(orpc.exchange.hunts.get.queryOptions({input: {huntId}})).data;
  const mutation = useMutation(orpc.exchange.hunts.update.mutationOptions());
  return (
    <Switch
      isDisabled={mutation.isPending}
      isSelected={!hunt.draft}
      onChange={checked =>
        mutation.mutate(
          {huntId, draft: !checked},
          {onError: () => toast.error("Oops! Something went wrong.")}
        )
      }>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        {hunt.draft ? "Draft" : "Published"}
      </Switch.Content>
    </Switch>
  );
}
